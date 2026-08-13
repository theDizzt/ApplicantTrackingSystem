import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, resumesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getAI, checkAIHealth } from "../lib/openai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// 이력서별 커리어 분석 진행 상태(메모리) — 동시 중복 실행 방지 및 오류 노출용
interface CareerJobState {
  inProgress: boolean;
  error?: string | null;
  // 진행 중 편집이 들어오면 true — 완료 시 최신 이력서로 즉시 재실행(coalesce)
  rerunRequested?: boolean;
}
const careerJobs = new Map<number, CareerJobState>();

const INVALID_ANALYSIS_MESSAGE = "분석 결과가 올바르지 않습니다. 다시 시도해주세요.";
class InvalidAnalysisError extends Error {
  constructor() {
    super(INVALID_ANALYSIS_MESSAGE);
    this.name = "InvalidAnalysisError";
  }
}

// ─── 응답 정제 ────────────────────────────────────────────────────────────
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
// 문자열 정제 + 길이 상한(PII·프롬프트 오염 방지)
function capStr(v: unknown, max: number): string {
  return str(v).slice(0, max);
}
function clampScore(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
function clampSalary(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  return Math.max(0, Math.min(100000, Math.round(n)));
}

interface CareerStrength {
  title: string;
  evidence: string;
}
interface CareerNcsCategory {
  major: string;
  middle: string;
  fitReason: string;
}
interface CareerRecommendedJob {
  job: string;
  ncsCategory: string;
  fitScore: number;
  reason: string;
  outlook: string;
  outlookScore: number;
}
interface CareerSalaryGuide {
  min: number;
  max: number;
  basis: string;
}
interface CareerTypoIssue {
  found: string;
  suggestion: string;
  note: string;
}
interface CareerDateIssue {
  found: string;
  issue: string;
  suggestion: string;
}
interface CareerAnalysisResult {
  strengths: CareerStrength[];
  ncsCategories: CareerNcsCategory[];
  recommendedJobs: CareerRecommendedJob[];
  summary: string;
  resumeSummary: string;
  salaryGuide: CareerSalaryGuide;
  typoIssues: CareerTypoIssue[];
  dateIssues: CareerDateIssue[];
}

const FIELD_MAX = 1000; // 일반 텍스트 필드 상한
const ISSUE_FIELD_MAX = 300; // 표기 점검 필드 상한
const MAX_ISSUES = 10; // typo/date 이슈 최대 개수

function sanitizeCareer(data: Record<string, unknown>): CareerAnalysisResult {
  const strengths: CareerStrength[] = (Array.isArray(data.strengths)
    ? (data.strengths as unknown[]).map((s) => {
        const o = (s ?? {}) as Record<string, unknown>;
        return { title: capStr(o.title, FIELD_MAX), evidence: capStr(o.evidence, FIELD_MAX) };
      })
    : []
  ).slice(0, 5);

  const ncsCategories: CareerNcsCategory[] = (Array.isArray(data.ncsCategories)
    ? (data.ncsCategories as unknown[]).map((c) => {
        const o = (c ?? {}) as Record<string, unknown>;
        return { major: capStr(o.major, FIELD_MAX), middle: capStr(o.middle, FIELD_MAX), fitReason: capStr(o.fitReason, FIELD_MAX) };
      })
    : []
  ).slice(0, 3);

  const recommendedJobs: CareerRecommendedJob[] = (Array.isArray(data.recommendedJobs)
    ? (data.recommendedJobs as unknown[]).map((j) => {
        const o = (j ?? {}) as Record<string, unknown>;
        return {
          job: capStr(o.job, FIELD_MAX),
          ncsCategory: capStr(o.ncsCategory, FIELD_MAX),
          fitScore: clampScore(o.fitScore),
          reason: capStr(o.reason, FIELD_MAX),
          outlook: capStr(o.outlook, FIELD_MAX),
          outlookScore: clampScore(o.outlookScore),
        };
      })
    : []
  ).slice(0, 3);

  const sg = (data.salaryGuide ?? {}) as Record<string, unknown>;
  let sgMin = clampSalary(sg.min);
  let sgMax = clampSalary(sg.max);
  if (sgMin > sgMax) { const t = sgMin; sgMin = sgMax; sgMax = t; } // min <= max 보장
  const salaryGuide: CareerSalaryGuide = {
    min: sgMin,
    max: sgMax,
    basis: capStr(sg.basis, FIELD_MAX),
  };

  const typoIssues: CareerTypoIssue[] = (Array.isArray(data.typoIssues)
    ? (data.typoIssues as unknown[]).map((t) => {
        const o = (t ?? {}) as Record<string, unknown>;
        return { found: capStr(o.found, ISSUE_FIELD_MAX), suggestion: capStr(o.suggestion, ISSUE_FIELD_MAX), note: capStr(o.note, ISSUE_FIELD_MAX) };
      })
    : []
  ).slice(0, MAX_ISSUES);

  const dateIssues: CareerDateIssue[] = (Array.isArray(data.dateIssues)
    ? (data.dateIssues as unknown[]).map((d) => {
        const o = (d ?? {}) as Record<string, unknown>;
        return { found: capStr(o.found, ISSUE_FIELD_MAX), issue: capStr(o.issue, ISSUE_FIELD_MAX), suggestion: capStr(o.suggestion, ISSUE_FIELD_MAX) };
      })
    : []
  ).slice(0, MAX_ISSUES);

  return {
    strengths,
    ncsCategories,
    recommendedJobs,
    summary: str(data.summary),
    resumeSummary: str(data.resumeSummary).slice(0, 100),
    salaryGuide,
    typoIssues,
    dateIssues,
  };
}

// ─── AI 프롬프트 ──────────────────────────────────────────────────────────
const CAREER_SYSTEM = `당신은 국가직무능력표준(NCS) 기반 커리어 컨설턴트입니다. 이력서를 분석해 오직 JSON만 반환하세요:
{
  "strengths": [{"title": "강점명", "evidence": "이력서 근거 (한국어 1~2문장)"}, ...] (3~5개),
  "ncsCategories": [{"major": "NCS 대분류(예: 20. 정보통신)", "middle": "중분류", "fitReason": "적합 이유 1~2문장"}, ...] (1~3개),
  "recommendedJobs": [{"job": "직업명", "ncsCategory": "해당 NCS 분류", "fitScore": 0-100, "reason": "추천 이유 2~3문장", "outlook": "해당 직업·직업군의 미래 전망 (시장 성장성·자동화 영향·수요 전망 포함, 한국어 3~4문장)", "outlookScore": 0-100 (높을수록 전망 밝음)}, ...] (3개),
  "summary": "종합 커리어 조언 (한국어 4~6문장)",
  "resumeSummary": "이력서 핵심 요약 (100자 이내, 한국어)",
  "salaryGuide": {"min": 만원 단위 연봉 하한(숫자), "max": 만원 단위 연봉 상한(숫자), "basis": "산정 근거 — 경력 수준·직무 시장 현황 반영 (한국어 2~3문장)"},
  "typoIssues": [{"found": "이력서 표기", "suggestion": "올바른 표기", "note": "설명 1문장"}, ...] (직무에서 흔히 쓰는 기술·직무 용어의 오탈자만, 없으면 빈 배열),
  "dateIssues": [{"found": "문제 구간 표기", "issue": "설명 — 예: 시작일이 종료일보다 늦음", "suggestion": "수정 제안"}, ...] (기간 표기(FROM-TO)에서 시작일/종료일이 뒤바뀐 경우·기간 중복·비상식적 연도 등, 없으면 빈 배열)
}
NCS 대분류는 실제 NCS 24개 대분류 체계(예: 01. 사업관리, 02. 경영·회계·사무, 20. 정보통신 등)를 따르도록 하세요.`;

async function runCareerAnalysis(resume: typeof resumesTable.$inferSelect): Promise<CareerAnalysisResult> {
  const resumeText = [
    resume.title,
    resume.content ? `[이력서 내용]\n${resume.content}` : "",
    resume.coverLetter ? `[자기소개서]\n${resume.coverLetter}` : "",
  ].filter(Boolean).join("\n\n");

  const ai = await getAI();
  const response = await ai.openai.chat.completions.create({
    model: ai.model,
    messages: [
      { role: "system", content: CAREER_SYSTEM },
      { role: "user", content: resumeText },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 16000,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    logger.warn({ resumeId: resume.id, category: "parse", contentLength: raw.length }, "Career analysis JSON parse failed");
    throw new InvalidAnalysisError();
  }

  const result = sanitizeCareer(data);

  // 최소 구조 검증 — 강점·추천 직업·종합 조언이 모두 채워져야 유효
  if (
    result.strengths.length === 0 ||
    result.recommendedJobs.length === 0 ||
    result.summary.trim().length === 0
  ) {
    logger.warn({ resumeId: resume.id, category: "schema", contentLength: raw.length }, "Career analysis validation failed");
    throw new InvalidAnalysisError();
  }

  return result;
}

// ─── 백그라운드 실행 (예약 + 실행) ───────────────────────────────────────
// 예약은 동기적으로 설정된 상태에서 호출한다(경합 차단은 호출부 책임).
function runCareerAnalysisBackground(resume: typeof resumesTable.$inferSelect): void {
  const id = resume.id;

  // 완료(성공·실패) 후, 진행 중 편집 요청이 있었다면 최신 이력서로 즉시 재실행한다.
  const maybeRerun = (): boolean => {
    const state = careerJobs.get(id);
    if (!state?.rerunRequested) return false;
    // 예약 유지(inProgress=true) + 플래그 초기화 후 DB에서 최신본을 다시 읽어 재실행
    careerJobs.set(id, { inProgress: true, error: null });
    void (async () => {
      const [fresh] = await db.select().from(resumesTable).where(eq(resumesTable.id, id));
      if (!fresh) { careerJobs.set(id, { inProgress: false, error: null }); return; }
      runCareerAnalysisBackground(fresh);
    })();
    return true;
  };

  runCareerAnalysis(resume)
    .then(async (result) => {
      await db.update(resumesTable).set({
        careerAnalysisResult: JSON.stringify(result),
        careerAnalyzedAt: new Date(),
      }).where(and(eq(resumesTable.id, id), eq(resumesTable.userId, resume.userId)));
      if (!maybeRerun()) careerJobs.set(id, { inProgress: false, error: null });
    })
    .catch((err) => {
      logger.error({ err, resumeId: id }, "Career analysis failed");
      const error = err instanceof InvalidAnalysisError
        ? INVALID_ANALYSIS_MESSAGE
        : `커리어 분석 중 오류가 발생했습니다. 관리자에게 문의해주세요. (원인: ${err instanceof Error ? err.message : String(err)})`;
      if (!maybeRerun()) careerJobs.set(id, { inProgress: false, error });
    });
}

// ─── 자동 커리어 분석 트리거 (업로드/생성/수정 후 재사용) ─────────────────
// 예약(inProgress) 설정 후 AI 상태 점검, 백그라운드 실행까지 캡슐화한다.
// 이미 진행 중이면 조용히 무시한다. Fire-and-forget 용도.
export async function startCareerAnalysis(resumeId: number): Promise<void> {
  const [resume] = await db.select().from(resumesTable)
    .where(eq(resumesTable.id, resumeId));
  if (!resume) return;

  const existing = careerJobs.get(resumeId);
  if (existing?.inProgress) {
    // 진행 중 편집 — 재실행을 예약해두고(coalesce) 현재 실행 완료 시 최신본으로 재실행
    careerJobs.set(resumeId, { ...existing, rerunRequested: true });
    return;
  }
  careerJobs.set(resumeId, { inProgress: true, error: null });

  const health = await checkAIHealth();
  if (!health.ok) {
    careerJobs.delete(resumeId); // 예약 해제
    logger.error({ reason: health.error, resumeId }, "AI health check failed before auto career analysis");
    careerJobs.set(resumeId, { inProgress: false, error: health.error });
    return;
  }

  runCareerAnalysisBackground(resume);
}

// ─── POST: 커리어 분석 시작 ────────────────────────────────────────────────
router.post("/resumes/:id/career-analysis", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const [resume] = await db.select().from(resumesTable)
    .where(and(eq(resumesTable.id, id), eq(resumesTable.userId, req.session.userId!)));
  if (!resume) { res.status(404).json({ error: "이력서를 찾을 수 없습니다." }); return; }

  // 중복 시작 방지 — 예약 설정을 동기적으로 수행(사이에 await 없음)해 경합 차단
  const existing = careerJobs.get(id);
  if (existing?.inProgress) {
    res.status(409).json({ error: "이미 커리어 분석이 진행 중입니다." });
    return;
  }
  careerJobs.set(id, { inProgress: true, error: null });

  // AI 연결 사전 점검 — AI 서버가 응답하지 않으면 시작하지 않고 즉시 안내
  const health = await checkAIHealth();
  if (!health.ok) {
    careerJobs.delete(id); // 예약 해제
    logger.error({ reason: health.error }, "AI health check failed before career analysis");
    res.status(503).json({ error: health.error });
    return;
  }

  res.status(202).json({ inProgress: true });

  runCareerAnalysisBackground(resume);
});

// ─── GET: 커리어 분석 상태/결과 ────────────────────────────────────────────
router.get("/resumes/:id/career-analysis", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const [resume] = await db.select().from(resumesTable)
    .where(and(eq(resumesTable.id, id), eq(resumesTable.userId, req.session.userId!)));
  if (!resume) { res.status(404).json({ error: "이력서를 찾을 수 없습니다." }); return; }

  const state = careerJobs.get(id);

  let result: CareerAnalysisResult | null = null;
  if (resume.careerAnalysisResult) {
    try { result = JSON.parse(resume.careerAnalysisResult) as CareerAnalysisResult; }
    catch { result = null; }
  }

  res.json({
    inProgress: state?.inProgress ?? false,
    error: state?.error ?? null,
    analyzedAt: resume.careerAnalyzedAt ? resume.careerAnalyzedAt.toISOString() : null,
    result,
  });
});

export default router;
