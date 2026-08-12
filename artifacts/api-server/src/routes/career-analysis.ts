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
function clampScore(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
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
interface CareerAnalysisResult {
  strengths: CareerStrength[];
  ncsCategories: CareerNcsCategory[];
  recommendedJobs: CareerRecommendedJob[];
  summary: string;
}

function sanitizeCareer(data: Record<string, unknown>): CareerAnalysisResult {
  const strengths: CareerStrength[] = Array.isArray(data.strengths)
    ? (data.strengths as unknown[]).map((s) => {
        const o = (s ?? {}) as Record<string, unknown>;
        return { title: str(o.title), evidence: str(o.evidence) };
      })
    : [];

  const ncsCategories: CareerNcsCategory[] = Array.isArray(data.ncsCategories)
    ? (data.ncsCategories as unknown[]).map((c) => {
        const o = (c ?? {}) as Record<string, unknown>;
        return { major: str(o.major), middle: str(o.middle), fitReason: str(o.fitReason) };
      })
    : [];

  const recommendedJobs: CareerRecommendedJob[] = Array.isArray(data.recommendedJobs)
    ? (data.recommendedJobs as unknown[]).map((j) => {
        const o = (j ?? {}) as Record<string, unknown>;
        return {
          job: str(o.job),
          ncsCategory: str(o.ncsCategory),
          fitScore: clampScore(o.fitScore),
          reason: str(o.reason),
          outlook: str(o.outlook),
          outlookScore: clampScore(o.outlookScore),
        };
      })
    : [];

  return {
    strengths,
    ncsCategories,
    recommendedJobs,
    summary: str(data.summary),
  };
}

// ─── AI 프롬프트 ──────────────────────────────────────────────────────────
const CAREER_SYSTEM = `당신은 국가직무능력표준(NCS) 기반 커리어 컨설턴트입니다. 이력서를 분석해 오직 JSON만 반환하세요:
{
  "strengths": [{"title": "강점명", "evidence": "이력서 근거 (한국어 1~2문장)"}, ...] (3~5개),
  "ncsCategories": [{"major": "NCS 대분류(예: 20. 정보통신)", "middle": "중분류", "fitReason": "적합 이유 1~2문장"}, ...] (1~3개),
  "recommendedJobs": [{"job": "직업명", "ncsCategory": "해당 NCS 분류", "fitScore": 0-100, "reason": "추천 이유 2~3문장", "outlook": "해당 직업·직업군의 미래 전망 (시장 성장성·자동화 영향·수요 전망 포함, 한국어 3~4문장)", "outlookScore": 0-100 (높을수록 전망 밝음)}, ...] (3개),
  "summary": "종합 커리어 조언 (한국어 4~6문장)"
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
    max_completion_tokens: 2000,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new InvalidAnalysisError();
  }

  const result = sanitizeCareer(data);

  // 최소 구조 검증 — 강점·추천 직업·종합 조언이 모두 채워져야 유효
  if (
    result.strengths.length === 0 ||
    result.recommendedJobs.length === 0 ||
    result.summary.trim().length === 0
  ) {
    throw new InvalidAnalysisError();
  }

  return result;
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

  // AI 연결 사전 점검 — 로컬 LLM이 죽어 있으면 시작하지 않고 즉시 안내
  const health = await checkAIHealth();
  if (!health.ok) {
    careerJobs.delete(id); // 예약 해제
    logger.error({ reason: health.error }, "AI health check failed before career analysis");
    res.status(503).json({ error: health.error });
    return;
  }

  res.status(202).json({ inProgress: true });

  runCareerAnalysis(resume)
    .then(async (result) => {
      await db.update(resumesTable).set({
        careerAnalysisResult: JSON.stringify(result),
        careerAnalyzedAt: new Date(),
      }).where(and(eq(resumesTable.id, id), eq(resumesTable.userId, resume.userId)));
      careerJobs.set(id, { inProgress: false, error: null });
    })
    .catch((err) => {
      logger.error({ err, resumeId: id }, "Career analysis failed");
      const error = err instanceof InvalidAnalysisError
        ? INVALID_ANALYSIS_MESSAGE
        : `커리어 분석 중 오류가 발생했습니다. 관리자에게 문의해주세요. (원인: ${err instanceof Error ? err.message : String(err)})`;
      careerJobs.set(id, { inProgress: false, error });
    });
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
