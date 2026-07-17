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
    improvementSuggestions: a.improvementSuggestions ?? null,
    urlAnalysisResult: a.urlAnalysisResult ?? null,
    richAnalysisResult: a.richAnalysisResult ?? null,
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

// ─── 3-parallel AI analysis ───────────────────────────────────────────────

async function callAI(messages: ChatCompletionMessageParam[]): Promise<Record<string, unknown>> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    messages,
    response_format: { type: "json_object" },
  });
  const raw = response.choices[0]?.message?.content ?? "{}";
  try { return JSON.parse(raw); } catch { return {}; }
}

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
  let urlResults: unknown[] = [];
  let urlContextForPrompt = "";
  if (urls.length > 0) {
    const results = await analyzeUrls(urls);
    urlResults = results;
    urlAnalysisResult = JSON.stringify(results);
    urlContextForPrompt = "\n\n" + formatUrlAnalysisForPrompt(results);
  }

  // ── 심사 1: 기술 역량 + 국어 품질 + 진정성 ─────────────────────────────
  const prompt1System = `당신은 기술 역량 평가 전문가입니다. 이력서에서 언급된 기술 스택을 추출하고 실증된 수준을 채점하세요.
오직 JSON만 반환하세요:
{
  "technicalSkills": [{"name": "기술명", "score": 0-100}, ...],
  "languageScore": 0-100,
  "languageFeedback": "국어 품질 피드백 (한국어, 3~5문장)",
  "aiWritingScore": 0-100 (높을수록 인간 작성),
  "aiWritingFeedback": "진정성 피드백 (한국어, 2~3문장)"
}
technicalSkills는 이력서에서 명시적으로 언급된 기술만 포함하며, 최소 5개~최대 15개로 구성하세요.`;

  // ── 심사 2: 인성 분석 (자기소개서 기반) ──────────────────────────────────
  const prompt2System = `당신은 인사 심리 평가 전문가입니다. 자기소개서와 이력서를 기반으로 지원자의 인성·태도를 분석하세요.
오직 JSON만 반환하세요:
{
  "personalityScore": 0-100,
  "dimensions": [
    {"name": "협업/소통", "score": 0-100},
    {"name": "성실성",    "score": 0-100},
    {"name": "책임감",    "score": 0-100},
    {"name": "도전정신",  "score": 0-100},
    {"name": "성장 의지", "score": 0-100},
    {"name": "조직 적합성", "score": 0-100}
  ],
  "strengths": "강점 요약 (한국어, 2~3문장)",
  "concerns": "확인 필요 사항 (한국어, 1~2문장)",
  "summary": "종합 인성 평가 (한국어, 3~5문장)"
}`;

  // ── 심사 3: 직무·조직 적합도 + 종합 ─────────────────────────────────────
  const prompt3System = `당신은 채용 심사 전문가입니다. 지원자의 이력서를 회사 요구사항과 비교하여 직무·조직 적합도를 평가하세요.
오직 JSON만 반환하세요:
{
  "jobMatchScore": 0-100,
  "jobMatchFeedback": "직무 적합도 피드백 (한국어, 3~5문장)",
  "organizationalFit": {
    "score": 0-100,
    "reasoning": "조직 적합도 근거 (한국어, 3~5문장)"
  },
  "urlAiEvaluation": "온라인 기술 역량 종합 평가 (한국어, 3~5문장, URL 분석 내용 없을 시 빈 문자열)",
  "overallScore": 0-100,
  "overallResult": "pass 또는 fail (70점 이상 pass)",
  "improvementSuggestions": "핵심 개선사항 목록 (줄바꿈으로 구분, 각 항목 앞에 '• ')"
}`;

  const userContent = `이력서:\n${resumeText}\n\n지원 회사 정보:\n${companyText}${urlContextForPrompt}`;

  // 3개 AI 모델 병렬 실행
  const [r1, r2, r3] = await Promise.all([
    callAI([{ role: "system", content: prompt1System }, { role: "user", content: userContent }]),
    callAI([{ role: "system", content: prompt2System }, { role: "user", content: userContent }]),
    callAI([{ role: "system", content: prompt3System }, { role: "user", content: userContent }]),
  ]);

  // richAnalysisResult 조립
  const richAnalysisResult = JSON.stringify({
    technicalSkills:      Array.isArray(r1.technicalSkills) ? r1.technicalSkills : [],
    personalityAnalysis: {
      score:      typeof r2.personalityScore === "number" ? r2.personalityScore : 0,
      dimensions: Array.isArray(r2.dimensions) ? r2.dimensions : [],
      strengths:  typeof r2.strengths === "string" ? r2.strengths : "",
      concerns:   typeof r2.concerns === "string" ? r2.concerns : "",
      summary:    typeof r2.summary === "string" ? r2.summary : "",
    },
    organizationalFit: {
      score:     typeof (r3.organizationalFit as Record<string,unknown>)?.score === "number"
                   ? (r3.organizationalFit as Record<string,unknown>).score as number : 0,
      reasoning: typeof (r3.organizationalFit as Record<string,unknown>)?.reasoning === "string"
                   ? (r3.organizationalFit as Record<string,unknown>).reasoning as string : "",
    },
    urlAiEvaluation: typeof r3.urlAiEvaluation === "string" ? r3.urlAiEvaluation : "",
  });

  await db.update(analysesTable).set({
    status: "completed",
    overallResult:          String(r3.overallResult ?? "fail"),
    overallScore:           typeof r3.overallScore === "number" ? r3.overallScore : null,
    aiWritingScore:         typeof r1.aiWritingScore === "number" ? r1.aiWritingScore : null,
    aiWritingFeedback:      typeof r1.aiWritingFeedback === "string" ? r1.aiWritingFeedback : null,
    languageScore:          typeof r1.languageScore === "number" ? r1.languageScore : null,
    languageFeedback:       typeof r1.languageFeedback === "string" ? r1.languageFeedback : null,
    jobMatchScore:          typeof r3.jobMatchScore === "number" ? r3.jobMatchScore : null,
    jobMatchFeedback:       typeof r3.jobMatchFeedback === "string" ? r3.jobMatchFeedback : null,
    improvementSuggestions: typeof r3.improvementSuggestions === "string" ? r3.improvementSuggestions : null,
    urlAnalysisResult,
    richAnalysisResult,
    completedAt: new Date(),
  }).where(eq(analysesTable.id, analysisId));

  logger.info({ analysisId }, "Analysis completed");
}

export default router;
