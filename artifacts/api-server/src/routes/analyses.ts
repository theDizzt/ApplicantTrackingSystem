import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, analysesTable, resumesTable, companiesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { openai } from "../lib/openai";
import { logger } from "../lib/logger";
import { extractUrls, analyzeUrls, formatUrlAnalysisForPrompt } from "../lib/url-analyzer";

const router: IRouter = Router();

// 2026년 최저시급 기준 (단위: 원)
const MIN_WAGE_2026_HOURLY = 10_030;
const MONTHLY_HOURS = 209;
const MIN_WAGE_ANNUAL_WAN = Math.round((MIN_WAGE_2026_HOURLY * MONTHLY_HOURS * 12) / 10_000); // 만원

function serializeAnalysis(
  a: typeof analysesTable.$inferSelect,
  resumeTitle?: string | null,
  companyName?: string | null
) {
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

  const resumeIds  = [...new Set(analyses.map(a => a.resumeId))];
  const companyIds = [...new Set(analyses.map(a => a.companyId))];

  const resumes   = resumeIds.length  > 0 ? await db.select({ id: resumesTable.id,   title: resumesTable.title  }).from(resumesTable).where(eq(resumesTable.userId,   req.session.userId!)) : [];
  const companies = companyIds.length > 0 ? await db.select({ id: companiesTable.id, name:  companiesTable.name  }).from(companiesTable).where(eq(companiesTable.userId, req.session.userId!)) : [];

  const resumeMap  = Object.fromEntries(resumes.map(r   => [r.id,  r.title]));
  const companyMap = Object.fromEntries(companies.map(c => [c.id,  c.name]));

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

  const [resume]  = await db.select({ title: resumesTable.title  }).from(resumesTable).where(eq(resumesTable.id,   analysis.resumeId));
  const [company] = await db.select({ name:  companiesTable.name  }).from(companiesTable).where(eq(companiesTable.id, analysis.companyId));

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
  const today = new Date();
  const currentYear = today.getFullYear();
  const threeYearsAgo = currentYear - 3; // 3년 전 기준년도

  const desiredSalaryNote = resume.desiredSalary
    ? `지원자 희망 연봉: ${resume.desiredSalary.toLocaleString()}만원`
    : "희망 연봉: 미기재";

  const resumeText = [
    resume.title,
    resume.content ? `[이력서 내용]\n${resume.content}` : "",
    resume.coverLetter ? `[자기소개서]\n${resume.coverLetter}` : "",
  ].filter(Boolean).join("\n\n");

  const companyText = [
    `회사명: ${company.name}`,
    company.siteUrl       ? `홈페이지: ${company.siteUrl}`        : "",
    company.jobPostingUrl ? `채용공고: ${company.jobPostingUrl}`   : "",
    company.talentProfile ? `인재상: ${company.talentProfile}`     : "",
    company.jobDescription? `채용공고 내용: ${company.jobDescription}` : "",
  ].filter(Boolean).join("\n");

  // URL 분석
  const allText = [resume.content ?? "", resume.coverLetter ?? ""].join("\n");
  const urls = extractUrls(allText);
  let urlAnalysisResult: string | null = null;
  let urlContextForPrompt = "";
  if (urls.length > 0) {
    const results = await analyzeUrls(urls);
    urlAnalysisResult = JSON.stringify(results);
    urlContextForPrompt = "\n\n" + formatUrlAnalysisForPrompt(results);
  }

  const userContent = `이력서:\n${resumeText}\n\n지원 회사 정보:\n${companyText}${urlContextForPrompt}\n\n${desiredSalaryNote}`;

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

  // ── 심사 2: 인성 분석 (자기소개서 기반) ─────────────────────────────────
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

  // ── 심사 3: 직무·조직 적합도 + 연봉 산정 + 예상 직급 + 졸업년도 격차 + 지원 동기 매칭 ──
  const prompt3System = `당신은 채용 심사 전문가입니다. 이력서를 분석하여 아래 모든 항목을 평가하세요.
오늘 날짜: ${today.toISOString().split("T")[0]}
2026년 최저시급: ${MIN_WAGE_2026_HOURLY.toLocaleString()}원/시간, 월 ${MONTHLY_HOURS}시간 기준 연 최저연봉: 약 ${MIN_WAGE_ANNUAL_WAN.toLocaleString()}만원

오직 JSON만 반환하세요:
{
  "jobMatchScore": 0-100,
  "jobMatchFeedback": "직무 적합도 피드백 (한국어, 3~5문장)",
  "organizationalFit": {
    "score": 0-100,
    "reasoning": "조직 적합도 근거 (한국어, 3~5문장)"
  },
  "urlAiEvaluation": "온라인 기술 역량 종합 평가 (한국어, 3~5문장, URL 없으면 빈 문자열)",
  "overallScore": 0-100,
  "overallResult": "pass 또는 fail (70점 이상 pass)",
  "improvementSuggestions": "핵심 개선사항 (줄바꿈 구분, 각 항목 앞 '• ')",
  "salaryAnalysis": {
    "estimatedMin": 숫자(만원),
    "estimatedMax": 숫자(만원),
    "byField": [{"field": "직군명", "min": 숫자, "max": 숫자}],
    "desiredSalaryComment": "희망 연봉과 예상 연봉 비교 의견 (한국어 1~2문장, 희망 연봉 미기재 시 빈 문자열)",
    "basis": "2026 최저시급(${MIN_WAGE_2026_HOURLY.toLocaleString()}원/시간) 및 업계 평균 기준 산정"
  },
  "expectedRank": {
    "applicable": true/false (경력자인 경우 true),
    "rank": "직급명 (신입이면 빈 문자열)",
    "yearsOfExperience": 경력년수(숫자),
    "reasoning": "직급 산정 근거 (한국어 1~2문장)"
  },
  "graduationGap": {
    "detected": true/false,
    "graduationYear": 최종학력 졸업연도(숫자, 모르면 0),
    "gapYears": 졸업년도 기준 현재까지 년수(숫자),
    "isLongGap": 졸업년도가 ${threeYearsAgo}년 이하이면 true,
    "copingStrategy": "졸업 후 공백이 긴 경우 면접 대응 방안 (한국어, 3~5문장. isLongGap이 false면 빈 문자열)",
    "sampleQuestions": ["면접 질문 예시 (isLongGap이 false면 빈 배열)"]
  },
  "motivationMatch": {
    "score": 0-100,
    "feedback": "자기소개서의 지원 동기·입사 포부가 실제 지원 회사(채용 공고·인재상·사업 분야)와 얼마나 구체적으로 매칭되는지 종합 피드백 (한국어, 3~5문장). 자기소개서 내용이 없으면 '자기소개서 내용이 없어 평가가 어렵습니다.'",
    "highlights": ["잘 매칭된 구체적 내용 (최대 3개, 없으면 빈 배열)"],
    "weaknesses": ["실제 회사와 연관성이 부족하거나 개선이 필요한 부분 (최대 3개, 없으면 빈 배열)"],
    "hasCoverLetter": true/false (자기소개서 내용 존재 여부)
  }
}`;

  // 3개 AI 모델 병렬 실행
  const [r1, r2, r3] = await Promise.all([
    callAI([{ role: "system", content: prompt1System }, { role: "user", content: userContent }]),
    callAI([{ role: "system", content: prompt2System }, { role: "user", content: userContent }]),
    callAI([{ role: "system", content: prompt3System }, { role: "user", content: userContent }]),
  ]);

  const orgFit = r3.organizationalFit as Record<string, unknown> | undefined;
  const salaryRaw = r3.salaryAnalysis as Record<string, unknown> | undefined;
  const rankRaw   = r3.expectedRank   as Record<string, unknown> | undefined;
  const gapRaw    = r3.graduationGap  as Record<string, unknown> | undefined;

  const motivRaw = r3.motivationMatch as Record<string, unknown> | undefined;

  const richAnalysisResult = JSON.stringify({
    technicalSkills:     Array.isArray(r1.technicalSkills) ? r1.technicalSkills : [],
    personalityAnalysis: {
      score:      typeof r2.personalityScore === "number" ? r2.personalityScore : 0,
      dimensions: Array.isArray(r2.dimensions) ? r2.dimensions : [],
      strengths:  typeof r2.strengths === "string" ? r2.strengths : "",
      concerns:   typeof r2.concerns  === "string" ? r2.concerns  : "",
      summary:    typeof r2.summary   === "string" ? r2.summary   : "",
    },
    organizationalFit: {
      score:     typeof orgFit?.score     === "number" ? orgFit.score     : 0,
      reasoning: typeof orgFit?.reasoning === "string" ? orgFit.reasoning : "",
    },
    urlAiEvaluation: typeof r3.urlAiEvaluation === "string" ? r3.urlAiEvaluation : "",
    salaryAnalysis: {
      estimatedMin:          typeof salaryRaw?.estimatedMin          === "number" ? salaryRaw.estimatedMin          : 0,
      estimatedMax:          typeof salaryRaw?.estimatedMax          === "number" ? salaryRaw.estimatedMax          : 0,
      byField:               Array.isArray(salaryRaw?.byField)       ? salaryRaw.byField       : [],
      desiredSalaryComment:  typeof salaryRaw?.desiredSalaryComment  === "string" ? salaryRaw.desiredSalaryComment  : "",
      basis:                 typeof salaryRaw?.basis                 === "string" ? salaryRaw.basis                 : "",
    },
    expectedRank: {
      applicable:        typeof rankRaw?.applicable        === "boolean" ? rankRaw.applicable        : false,
      rank:              typeof rankRaw?.rank              === "string"  ? rankRaw.rank              : "",
      yearsOfExperience: typeof rankRaw?.yearsOfExperience === "number"  ? rankRaw.yearsOfExperience : 0,
      reasoning:         typeof rankRaw?.reasoning         === "string"  ? rankRaw.reasoning         : "",
    },
    graduationGap: {
      detected:       typeof gapRaw?.detected       === "boolean" ? gapRaw.detected       : false,
      graduationYear: typeof gapRaw?.graduationYear === "number"  ? gapRaw.graduationYear : 0,
      gapYears:       typeof gapRaw?.gapYears       === "number"  ? gapRaw.gapYears       : 0,
      isLongGap:      typeof gapRaw?.isLongGap      === "boolean" ? gapRaw.isLongGap      : false,
      copingStrategy: typeof gapRaw?.copingStrategy === "string"  ? gapRaw.copingStrategy : "",
      sampleQuestions: Array.isArray(gapRaw?.sampleQuestions)     ? gapRaw.sampleQuestions : [],
    },
    motivationMatch: {
      score:          typeof motivRaw?.score          === "number"  ? motivRaw.score          : 0,
      feedback:       typeof motivRaw?.feedback       === "string"  ? motivRaw.feedback       : "",
      highlights:     Array.isArray(motivRaw?.highlights)           ? motivRaw.highlights     : [],
      weaknesses:     Array.isArray(motivRaw?.weaknesses)           ? motivRaw.weaknesses     : [],
      hasCoverLetter: typeof motivRaw?.hasCoverLetter === "boolean" ? motivRaw.hasCoverLetter : false,
    },
  });

  await db.update(analysesTable).set({
    status: "completed",
    overallResult:          String(r3.overallResult ?? "fail"),
    overallScore:           typeof r3.overallScore    === "number" ? r3.overallScore    : null,
    aiWritingScore:         typeof r1.aiWritingScore  === "number" ? r1.aiWritingScore  : null,
    aiWritingFeedback:      typeof r1.aiWritingFeedback === "string" ? r1.aiWritingFeedback : null,
    languageScore:          typeof r1.languageScore   === "number" ? r1.languageScore   : null,
    languageFeedback:       typeof r1.languageFeedback === "string" ? r1.languageFeedback : null,
    jobMatchScore:          typeof r3.jobMatchScore   === "number" ? r3.jobMatchScore   : null,
    jobMatchFeedback:       typeof r3.jobMatchFeedback === "string" ? r3.jobMatchFeedback : null,
    improvementSuggestions: typeof r3.improvementSuggestions === "string" ? r3.improvementSuggestions : null,
    urlAnalysisResult,
    richAnalysisResult,
    completedAt: new Date(),
  }).where(eq(analysesTable.id, analysisId));

  logger.info({ analysisId }, "Analysis completed");
}

export default router;
