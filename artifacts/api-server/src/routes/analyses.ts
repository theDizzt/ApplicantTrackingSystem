import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, analysesTable, resumesTable, companiesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { openai } from "../lib/openai";
import { logger } from "../lib/logger";
import { extractUrls, analyzeUrls, formatUrlAnalysisForPrompt } from "../lib/url-analyzer";

const router: IRouter = Router();

function serializeAnalysis(a: typeof analysesTable.$inferSelect, resumeTitle?: string | null, companyName?: string | null) {
  return {
    id: a.id,
    userId: a.userId,
    resumeId: a.resumeId,
    companyId: a.companyId,
    status: a.status,
    overallResult: a.overallResult ?? null,
    overallScore: a.overallScore ?? null,
    aiWritingScore: a.aiWritingScore ?? null,
    aiWritingFeedback: a.aiWritingFeedback ?? null,
    languageScore: a.languageScore ?? null,
    languageFeedback: a.languageFeedback ?? null,
    jobMatchScore: a.jobMatchScore ?? null,
    jobMatchFeedback: a.jobMatchFeedback ?? null,
    physiognomyScore: a.physiognomyScore ?? null,
    physiognomyFeedback: a.physiognomyFeedback ?? null,
    improvementSuggestions: a.improvementSuggestions ?? null,
    urlAnalysisResult: a.urlAnalysisResult ?? null,
    resumeTitle: resumeTitle ?? null,
    companyName: companyName ?? null,
    createdAt: a.createdAt.toISOString(),
    completedAt: a.completedAt ? a.completedAt.toISOString() : null,
  };
}

router.get("/analyses", requireAuth, async (req, res): Promise<void> => {
  const analyses = await db.select().from(analysesTable)
    .where(eq(analysesTable.userId, req.session.userId!))
    .orderBy(analysesTable.createdAt);

  const resumeIds = [...new Set(analyses.map(a => a.resumeId))];
  const companyIds = [...new Set(analyses.map(a => a.companyId))];

  const resumes = resumeIds.length > 0
    ? await db.select({ id: resumesTable.id, title: resumesTable.title }).from(resumesTable).where(eq(resumesTable.userId, req.session.userId!))
    : [];
  const companies = companyIds.length > 0
    ? await db.select({ id: companiesTable.id, name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.userId, req.session.userId!))
    : [];

  const resumeMap = Object.fromEntries(resumes.map(r => [r.id, r.title]));
  const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));

  res.json(analyses.map(a => serializeAnalysis(a, resumeMap[a.resumeId], companyMap[a.companyId])));
});

router.post("/analyses", requireAuth, async (req, res): Promise<void> => {
  const { resumeId, companyId } = req.body;
  if (!resumeId || !companyId) {
    res.status(400).json({ error: "이력서와 회사를 선택해주세요." });
    return;
  }

  const [resume] = await db.select().from(resumesTable)
    .where(and(eq(resumesTable.id, resumeId), eq(resumesTable.userId, req.session.userId!)));
  if (!resume) { res.status(400).json({ error: "이력서를 찾을 수 없습니다." }); return; }

  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, companyId), eq(companiesTable.userId, req.session.userId!)));
  if (!company) { res.status(400).json({ error: "회사를 찾을 수 없습니다." }); return; }

  const [analysis] = await db.insert(analysesTable)
    .values({ userId: req.session.userId!, resumeId, companyId, status: "processing" })
    .returning();

  res.status(201).json(serializeAnalysis(analysis, resume.title, company.name));

  // Run AI analysis asynchronously
  runAnalysis(analysis.id, resume, company).catch(err => {
    logger.error({ err, analysisId: analysis.id }, "Analysis failed");
  });
});

router.get("/analyses/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const [analysis] = await db.select().from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, req.session.userId!)));
  if (!analysis) { res.status(404).json({ error: "분석을 찾을 수 없습니다." }); return; }

  const [resume] = await db.select({ title: resumesTable.title }).from(resumesTable).where(eq(resumesTable.id, analysis.resumeId));
  const [company] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, analysis.companyId));

  res.json(serializeAnalysis(analysis, resume?.title, company?.name));
});

async function runAnalysis(
  analysisId: number,
  resume: typeof resumesTable.$inferSelect,
  company: typeof companiesTable.$inferSelect
) {
  const resumeText = [
    resume.title,
    resume.content ? `[이력서 내용]\n${resume.content}` : "",
    resume.coverLetter ? `[자기소개서]\n${resume.coverLetter}` : "",
  ].filter(Boolean).join("\n\n");

  const companyText = [
    `회사명: ${company.name}`,
    company.siteUrl ? `홈페이지: ${company.siteUrl}` : "",
    company.jobPostingUrl ? `채용공고: ${company.jobPostingUrl}` : "",
    company.talentProfile ? `인재상: ${company.talentProfile}` : "",
    company.jobDescription ? `채용공고 내용: ${company.jobDescription}` : "",
  ].filter(Boolean).join("\n");

  // === URL / GitHub 분석 ===
  const allText = [resume.content ?? "", resume.coverLetter ?? ""].join("\n");
  const urls = extractUrls(allText);
  let urlAnalysisResult: string | null = null;
  let urlContextForPrompt = "";
  if (urls.length > 0) {
    const urlResults = await analyzeUrls(urls);
    urlAnalysisResult = JSON.stringify(urlResults);
    urlContextForPrompt = "\n\n" + formatUrlAnalysisForPrompt(urlResults);
  }

  const hasPhoto = !!resume.photoUrl;

  const systemPrompt = `당신은 경험 많은 채용 심사관입니다. 구직자의 이력서를 분석하여 JSON 형식으로 결과를 반환하세요.

반환 형식:
{
  "aiWritingScore": 0-100 (낮을수록 AI 작성 의심, 높을수록 인간 작성),
  "aiWritingFeedback": "피드백 문장 (한국어)",
  "languageScore": 0-100,
  "languageFeedback": "피드백 문장 (한국어)",
  "jobMatchScore": 0-100,
  "jobMatchFeedback": "피드백 문장 (한국어)",
  "physiognomyScore": ${hasPhoto ? "0-100" : "null"},
  "physiognomyFeedback": "${hasPhoto ? "피드백 문장 (한국어)" : "null (사진 없음)"}",
  "overallScore": 0-100,
  "overallResult": "pass" 또는 "fail",
  "improvementSuggestions": "개선사항 목록 (줄바꿈으로 구분, 각 항목 앞에 '• ')"
}

평가 기준:
1. AI 작성 탐지: 문장 패턴, 반복적 표현, 비자연적 문체를 분석하여 AI 생성 여부를 판단
2. 국어 품질: 문법, 맞춤법, 논리적 흐름, 설득력을 평가
3. 직무 적합도: 이력서 내용이 회사 인재상 및 채용공고와 얼마나 일치하는지 분석
4. 관상 분석: ${hasPhoto ? "사진을 바탕으로 전문성, 신뢰감, 친화력을 평가" : "사진이 없어 분석 불가"}
5. 종합: 70점 이상이면 pass, 미만이면 fail
6. URL/GitHub 분석: 이력서에 링크가 있다면 해당 사이트의 접근 가능 여부와 GitHub 기술 스택, 프로젝트 품질을 직무 적합도 평가에 반영하세요.

오직 JSON만 반환하세요. 마크다운 코드 블록 없이.`;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  if (hasPhoto) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: `이력서:\n${resumeText}\n\n지원 회사 정보:\n${companyText}${urlContextForPrompt}` },
        { type: "image_url", image_url: { url: resume.photoUrl! } },
      ],
    });
  } else {
    messages.push({
      role: "user",
      content: `이력서:\n${resumeText}\n\n지원 회사 정보:\n${companyText}${urlContextForPrompt}`,
    });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    messages,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(raw);
  } catch {
    logger.error({ raw }, "Failed to parse AI analysis JSON");
    await db.update(analysesTable).set({ status: "failed" }).where(eq(analysesTable.id, analysisId));
    return;
  }

  await db.update(analysesTable).set({
    status: "completed",
    overallResult: String(result.overallResult ?? "fail"),
    overallScore: typeof result.overallScore === "number" ? result.overallScore : null,
    aiWritingScore: typeof result.aiWritingScore === "number" ? result.aiWritingScore : null,
    aiWritingFeedback: typeof result.aiWritingFeedback === "string" ? result.aiWritingFeedback : null,
    languageScore: typeof result.languageScore === "number" ? result.languageScore : null,
    languageFeedback: typeof result.languageFeedback === "string" ? result.languageFeedback : null,
    jobMatchScore: typeof result.jobMatchScore === "number" ? result.jobMatchScore : null,
    jobMatchFeedback: typeof result.jobMatchFeedback === "string" ? result.jobMatchFeedback : null,
    physiognomyScore: typeof result.physiognomyScore === "number" ? result.physiognomyScore : null,
    physiognomyFeedback: typeof result.physiognomyFeedback === "string" ? result.physiognomyFeedback : null,
    improvementSuggestions: typeof result.improvementSuggestions === "string" ? result.improvementSuggestions : null,
    urlAnalysisResult,
    completedAt: new Date(),
  }).where(eq(analysesTable.id, analysisId));

  // Increment analyses used count
  await db.select().from(usersTable).where(eq(usersTable.id,
    (await db.select({ userId: analysesTable.userId }).from(analysesTable).where(eq(analysesTable.id, analysisId)))[0]?.userId ?? 0
  ));
}

export default router;
