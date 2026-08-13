import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, analysesTable, resumesTable, companiesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getAI, getSecondaryAIs, checkAIHealth } from "../lib/openai";
import { logger } from "../lib/logger";
import { extractUrls, analyzeUrls, formatUrlAnalysisForPrompt } from "../lib/url-analyzer";
import { jobSimilarityScore } from "../lib/similarity";
import type OpenAI from "openai";

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
    errorMessage: a.errorMessage ?? null,
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

  // AI 연결 사전 점검 — 로컬 LLM이 죽어 있으면 심사를 시작하지 않고 즉시 안내
  const health = await checkAIHealth();
  if (!health.ok) {
    logger.error({ reason: health.error }, "AI health check failed before analysis");
    res.status(503).json({ error: health.error });
    return;
  }

  const [analysis] = await db.insert(analysesTable)
    .values({ userId: req.session.userId!, resumeId, companyId, status: "processing" })
    .returning();

  res.status(201).json(serializeAnalysis(analysis, resume.title, company.name));

  runAnalysis(analysis.id, resume, company).catch(async (err) => {
    logger.error({ err, analysisId: analysis.id }, "Analysis failed");
    const detail = err instanceof Error ? err.message : String(err);
    try {
      await db.update(analysesTable).set({
        status: "failed",
        errorMessage: `AI 심사 중 오류가 발생했습니다. 관리자에게 문의해주세요. (원인: ${detail})`,
        completedAt: new Date(),
      }).where(eq(analysesTable.id, analysis.id));
    } catch (updateErr) {
      logger.error({ err: updateErr, analysisId: analysis.id }, "Failed to record analysis failure");
    }
  });
});

router.post("/analyses/:id/retry", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const [analysis] = await db.select().from(analysesTable)
    .where(and(eq(analysesTable.id, id), eq(analysesTable.userId, req.session.userId!)));
  if (!analysis) { res.status(404).json({ error: "분석을 찾을 수 없습니다." }); return; }

  if (analysis.status !== "failed") {
    res.status(400).json({ error: "실패한 심사만 다시 시도할 수 있습니다." });
    return;
  }

  const [resume] = await db.select().from(resumesTable)
    .where(and(eq(resumesTable.id, analysis.resumeId), eq(resumesTable.userId, req.session.userId!)));
  if (!resume) { res.status(400).json({ error: "이력서를 찾을 수 없습니다." }); return; }

  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, analysis.companyId), eq(companiesTable.userId, req.session.userId!)));
  if (!company) { res.status(400).json({ error: "회사를 찾을 수 없습니다." }); return; }

  // AI 연결 사전 점검 — 로컬 LLM이 죽어 있으면 심사를 시작하지 않고 즉시 안내
  const health = await checkAIHealth();
  if (!health.ok) {
    logger.error({ reason: health.error }, "AI health check failed before analysis retry");
    res.status(503).json({ error: health.error });
    return;
  }

  // 원자적 상태 전이(compare-and-set): failed 상태일 때만 processing으로 전환
  // — 동시 요청이 들어와도 단 한 건만 재심사를 시작하도록 보장
  const [updated] = await db.update(analysesTable).set({
    status: "processing",
    errorMessage: null,
    completedAt: null,
  }).where(and(
    eq(analysesTable.id, analysis.id),
    eq(analysesTable.userId, req.session.userId!),
    eq(analysesTable.status, "failed"),
  )).returning();

  if (!updated) {
    res.status(409).json({ error: "이미 재시도가 진행 중이거나 재시도할 수 없는 상태입니다." });
    return;
  }

  res.json(serializeAnalysis(updated, resume.title, company.name));

  runAnalysis(analysis.id, resume, company).catch(async (err) => {
    logger.error({ err, analysisId: analysis.id }, "Analysis retry failed");
    const detail = err instanceof Error ? err.message : String(err);
    try {
      await db.update(analysesTable).set({
        status: "failed",
        errorMessage: `AI 심사 중 오류가 발생했습니다. 관리자에게 문의해주세요. (원인: ${detail})`,
        completedAt: new Date(),
      }).where(eq(analysesTable.id, analysis.id));
    } catch (updateErr) {
      logger.error({ err: updateErr, analysisId: analysis.id }, "Failed to record analysis retry failure");
    }
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

interface AIResult {
  data: Record<string, unknown>;
  inputTokens: number;
  outputTokens: number;
}

async function callAI(messages: ChatCompletionMessageParam[]): Promise<AIResult> {
  const ai = await getAI();
    const response = await ai.openai.chat.completions.create({
    model: ai.model,
    messages,
    response_format: { type: "json_object" },
  });
  const raw = response.choices[0]?.message?.content ?? "{}";
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  return {
    data,
    inputTokens:  response.usage?.prompt_tokens     ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

// ── 모델별 의견 (Task3) ────────────────────────────────────────────────────
const MODEL_OPINION_SYSTEM =
  '당신은 채용 서류 심사관입니다. 이력서와 지원 회사 정보를 보고 JSON만 반환하세요: {"score": 0-100, "opinion": "종합 심사 의견 (한국어 4~6문장)", "verdict": "추천" | "보류" | "비추천"}';

interface ModelOpinion {
  label: string;
  model: string;
  score: number;
  opinion: string;
  verdict: string;
}

interface OpinionRaw {
  opinion: ModelOpinion;
  inputTokens: number;
  outputTokens: number;
}

function sanitizeOpinion(
  data: Record<string, unknown>,
  label: string,
  model: string,
): ModelOpinion {
  const rawScore = typeof data.score === "number" ? data.score : 0;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const opinion = typeof data.opinion === "string" ? data.opinion : "";
  const verdict =
    data.verdict === "추천" || data.verdict === "보류" || data.verdict === "비추천"
      ? data.verdict
      : "보류";
  return { label, model, score, opinion, verdict };
}

async function callModelOpinion(
  client: OpenAI,
  model: string,
  label: string,
  userContent: string,
): Promise<OpinionRaw> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: MODEL_OPINION_SYSTEM },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 4000,
  });
  const raw = response.choices[0]?.message?.content ?? "{}";
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {
    opinion: sanitizeOpinion(data, label, model),
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
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
  const prompt1System = `당신은 기술 역량 평가 전문가입니다. 지원 회사(채용 공고)가 요구하는 기술을 기준으로 지원자의 실증된 수준을 채점하세요.
오직 JSON만 반환하세요:
{
  "technicalSkills": [{"name": "기술명", "score": 0-100}, ...],
  "techTermIssues": [{"term": "이력서에 적힌 표기", "issue": "문제 설명 (한국어, 1문장)", "suggestion": "올바른 표기 또는 권장 표현"}, ...],
  "languageScore": 0-100,
  "languageFeedback": "국어 품질 피드백 (한국어, 3~5문장)",
  "aiWritingScore": 0-100 (높을수록 인간 작성),
  "aiWritingFeedback": "진정성 피드백 (한국어, 2~3문장)"
}

technicalSkills 구성 규칙 (반드시 순서대로 적용):
1. 지원 회사 정보(채용 공고)에 요구 기술이 명시되어 있으면, 그 기술들을 항목으로 구성하세요.
2. 공고에 기술이 명시되어 있지 않으면, 공고의 직무 내용·사업 분야를 파악해 해당 직무 수행에 필요한 관련 기술을 정리하여 항목으로 구성하세요.
3. 각 항목의 score는 이력서에서 확인되는 실증 근거(프로젝트 경험, 경력 활용, 자격증 등) 기준으로 0~100점으로 채점하세요. 이력서에 근거가 전혀 없으면 0점입니다.
4. 구체적인 기술명(언어·프레임워크·도구·표준 등)으로 작성하고, "ICT"·"PC" 같은 포괄적 분야명은 항목으로 쓰지 마세요. 최소 5개~최대 15개로 구성하세요.

techTermIssues는 이력서의 기술 스택·보유 기술 항목에 적힌 용어를 검증한 결과입니다. 오탈자(예: "Pyhton"), 잘못되거나 존재하지 않는 기술명, 대소문자·공식 표기 오류(예: "nodejs" → "Node.js")를 찾아서 보고하세요.
다음은 검증 대상에서 제외하세요 (지적 금지):
- 학력 사항의 전공·학과 명칭 (예: "컴퓨터공학과", "정보과학", "정보통신학부")
- 부서명·소속·직무 분야 명칭 (예: "ICT 사업부", "이동통신", "네트워크팀")
- 분야·역량을 나타내는 포괄적 표현 (예: "ICT", "PC 능력", "이동통신") — 구체성이 부족하다는 이유로 지적하지 마세요. 표기 자체가 틀린 경우만 보고합니다.
문제가 없으면 빈 배열 []을 반환하세요.`;

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
  "jobMatchFeedback": "직무 적합도 피드백 (한국어, 3~5문장). NCS(국가직무능력표준) 기반으로 평가: 지원 직무에 해당하는 NCS 직무 분류(대분류·중분류·세분류)를 식별하고, 해당 직무의 NCS 능력단위(필요 지식·기술·태도) 대비 지원자의 보유 역량을 비교 분석하세요. 지원자의 경력년수에 따른 직급(신입/주니어/시니어 등) 수준에서 요구되는 NCS 수준(1~8수준)과 실제 역량 수준을 함께 평가하세요. 피드백에 NCS 직무명과 요구 수준을 명시하세요.",
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
    "gapType": "graduation 또는 employment (아래 규칙 참조, detected가 false면 빈 문자열)",
    "graduationYear": 최종학력 졸업연도(숫자, 모르면 0),
    "gapYears": 공백 기간 년수(숫자, 아래 규칙 참조),
    "isLongGap": true/false (아래 규칙 참조),
    "copingStrategy": "공백이 긴 경우 면접 대응 방안 (한국어, 3~5문장. isLongGap이 false면 빈 문자열)",
    "sampleQuestions": ["면접 질문 예시 (isLongGap이 false면 빈 배열)"]
  },
  "motivationMatch": {
    "score": 0-100,
    "feedback": "자기소개서의 지원 동기·입사 포부가 실제 지원 회사(채용 공고·인재상·사업 분야)와 얼마나 구체적으로 매칭되는지 종합 피드백 (한국어, 3~5문장). 자기소개서 내용이 없으면 '자기소개서 내용이 없어 평가가 어렵습니다.'",
    "highlights": ["잘 매칭된 구체적 내용 (최대 3개, 없으면 빈 배열)"],
    "weaknesses": ["실제 회사와 연관성이 부족하거나 개선이 필요한 부분 (최대 3개, 없으면 빈 배열)"],
    "hasCoverLetter": true/false (자기소개서 내용 존재 여부)
  }
}

graduationGap 판정 규칙 (반드시 순서대로 적용):
1. 이력서에 경력사항(회사 근무 이력)이 있는 경우: 졸업 후 공백 분석은 하지 않습니다.
   - 단, 마지막 회사의 퇴사일(근무 종료일)로부터 오늘까지 1년이 넘는 경우에만 경력 공백으로 판단하여 detected=true, gapType="employment", isLongGap=true, gapYears=퇴사 후 경과 년수로 설정하고, 경력 공백에 대한 면접 대응 방안(copingStrategy)과 예상 질문(sampleQuestions)을 제시하세요.
   - 마지막 퇴사일로부터 1년 이내이거나 현재 재직 중이면 detected=false, gapType="", isLongGap=false, copingStrategy는 빈 문자열, sampleQuestions는 빈 배열로 설정하세요.
2. 경력사항이 전혀 없는 경우(신입): 최종학력 졸업연도를 확실히 알 수 있고 그 연도가 ${threeYearsAgo}년 이하이면 detected=true, gapType="graduation", isLongGap=true, gapYears=졸업 후 경과 년수로 설정하고 졸업 공백에 대한 대응 방안을 제시하세요.
   - 졸업연도를 알 수 없는 경우(graduationYear=0)에는 공백으로 판정하지 마세요: detected=false, gapType="", isLongGap=false로 설정하세요.`;

  // 3개 AI 모델 병렬 실행
  const [res1, res2, res3] = await Promise.all([
    callAI([{ role: "system", content: prompt1System }, { role: "user", content: userContent }]),
    callAI([{ role: "system", content: prompt2System }, { role: "user", content: userContent }]),
    callAI([{ role: "system", content: prompt3System }, { role: "user", content: userContent }]),
  ]);

  const r1 = res1.data;
  const r2 = res2.data;
  const r3 = res3.data;
  let totalInputTokens  = res1.inputTokens  + res2.inputTokens  + res3.inputTokens;
  let totalOutputTokens = res1.outputTokens + res2.outputTokens + res3.outputTokens;

  const overallScoreNum = typeof r3.overallScore === "number" ? r3.overallScore : 0;

  // ── 모델별 의견 (Task3) ──────────────────────────────────────────────────
  // 주 모델(모델 1)에도 동일한 단일 프롬프트를 실행하여 의견을 확보한다.
  // (이 함수에는 주 모델용 단일 스칼라 종합 피드백이 없으므로 별도 호출)
  const primaryAI = await getAI();
  const secondaryAIs = await getSecondaryAIs();

  const opinionResults = await Promise.allSettled([
    callModelOpinion(primaryAI.openai, primaryAI.model, "모델 1(주 모델)", userContent),
    ...secondaryAIs.map((s) =>
      callModelOpinion(s.openai, s.model, s.label, userContent),
    ),
  ]);

  const modelOpinions: ModelOpinion[] = [];
  opinionResults.forEach((r, idx) => {
    if (r.status === "fulfilled") {
      totalInputTokens += r.value.inputTokens;
      totalOutputTokens += r.value.outputTokens;
      const op = r.value.opinion;
      if (idx === 0) {
        // 주 모델: score는 overallScore로, opinion은 확보된 종합 의견 사용
        modelOpinions.push({ ...op, score: Math.max(0, Math.min(100, Math.round(overallScoreNum))) });
      } else {
        modelOpinions.push(op);
      }
    } else {
      logger.warn({ analysisId, err: r.reason }, "Model opinion failed (tolerated)");
    }
  });

  // ── 직무 문장 유사도 (Task4) ─────────────────────────────────────────────
  const applicantText =
    (resume.coverLetter && resume.coverLetter.trim())
      ? resume.coverLetter
      : (resume.content ?? "");
  const jobSimScore = company.jobDescription
    ? await jobSimilarityScore(company.jobDescription, applicantText)
    : null;
  const jobSimilarity: { score: number | null; threshold: number; opinion: string | null } = {
    score: jobSimScore,
    threshold: 60,
    opinion:
      jobSimScore !== null && jobSimScore <= 60
        ? `공고의 직무 내용과 지원자의 자기소개서(입사 후 포부 등)의 직무 관련성이 낮습니다 (유사도 ${jobSimScore}점). 지원 직무 이해도를 면접에서 확인해 보세요.`
        : null,
  };

  const orgFit = r3.organizationalFit as Record<string, unknown> | undefined;
  const salaryRaw = r3.salaryAnalysis as Record<string, unknown> | undefined;
  const rankRaw   = r3.expectedRank   as Record<string, unknown> | undefined;
  const gapRaw    = r3.graduationGap  as Record<string, unknown> | undefined;

  const motivRaw = r3.motivationMatch as Record<string, unknown> | undefined;

  // ── 서류 기본 점검 (규칙 기반) ──────────────────────────────────────────
  // 자기소개서 분량: 공백 제외 글자 수 기준 300자 미만이면 부족으로 판단
  const coverLetterCharCount = (resume.coverLetter ?? "").replace(/\s/g, "").length;
  const documentChecks = {
    photoMissing: !resume.photoUrl,
    coverLetterLength: coverLetterCharCount,
    coverLetterTooShort: coverLetterCharCount < 300,
  };

  // AI가 반환한 기술 용어 검증 결과를 문자열 필드만 남기고 정제
  const techTermIssues = (Array.isArray(r1.techTermIssues) ? r1.techTermIssues : [])
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({
      term:       typeof t.term       === "string" ? t.term       : "",
      issue:      typeof t.issue      === "string" ? t.issue      : "",
      suggestion: typeof t.suggestion === "string" ? t.suggestion : "",
    }))
    .filter((t) => t.term !== "" || t.issue !== "");

  const richAnalysisResult = JSON.stringify({
    documentChecks,
    technicalSkills:     Array.isArray(r1.technicalSkills) ? r1.technicalSkills : [],
    techTermIssues,
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
      gapType:        gapRaw?.gapType === "graduation" || gapRaw?.gapType === "employment" ? gapRaw.gapType : "",
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
    modelOpinions,
    jobSimilarity,
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
    inputTokens:  totalInputTokens,
    outputTokens: totalOutputTokens,
    completedAt: new Date(),
  }).where(eq(analysesTable.id, analysisId));

  logger.info({ analysisId }, "Analysis completed");
}

export default router;
