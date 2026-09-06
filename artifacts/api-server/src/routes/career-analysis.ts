import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, resumesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getAI, checkAIHealth } from "../lib/openai";
import { logger } from "../lib/logger";
import { resumeHtmlToText } from "../lib/resume-text";

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
  level: number;
  fitReason: string;
}
interface PaperVerificationRecord {
  source: "Crossref" | "OpenAlex";
  title: string;
  authors: string[];
  venue: string;
  doi: string;
  url: string;
}
interface PaperVerification {
  status: "verified" | "unverified" | "conflict";
  records: PaperVerificationRecord[];
  conflicts: string[];
}
interface CareerPaper {
  title: string;
  authors: string[];
  applicantAuthorOrder: number;
  venue: string;
  abstract: string;
  issues: string[];
  verification: PaperVerification;
}
interface CareerRecommendedJob {
  job: string;
  ncsCategory: string;
  fitScore: number;
  reason: string;
  outlook: string;
  outlookScore: number;
  salaryGuide: CareerSalaryGuide;
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
  papers: CareerPaper[];
}

const FIELD_MAX = 1000; // 일반 텍스트 필드 상한
const ISSUE_FIELD_MAX = 300; // 표기 점검 필드 상한
const MAX_ISSUES = 10; // typo/date 이슈 최대 개수

export function sanitizeCareer(data: Record<string, unknown>): CareerAnalysisResult {
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
        const rawLevel = typeof o.level === "number" ? Math.round(o.level) : 0;
        const level = rawLevel >= 1 && rawLevel <= 8 ? rawLevel : 0;
        return { major: capStr(o.major, FIELD_MAX), middle: capStr(o.middle, FIELD_MAX), level, fitReason: capStr(o.fitReason, FIELD_MAX) };
      })
    : []
  ).slice(0, 3);

  const recommendedJobs: CareerRecommendedJob[] = (Array.isArray(data.recommendedJobs)
    ? (data.recommendedJobs as unknown[]).map((j) => {
        const o = (j ?? {}) as Record<string, unknown>;
        const salary = (o.salaryGuide ?? {}) as Record<string, unknown>;
        let min = clampSalary(salary.min);
        let max = clampSalary(salary.max);
        if (min > max) [min, max] = [max, min];
        return {
          job: capStr(o.job, FIELD_MAX),
          ncsCategory: capStr(o.ncsCategory, FIELD_MAX),
          fitScore: clampScore(o.fitScore),
          reason: capStr(o.reason, FIELD_MAX),
          outlook: capStr(o.outlook, FIELD_MAX),
          outlookScore: clampScore(o.outlookScore),
          salaryGuide: { min, max, basis: capStr(salary.basis, FIELD_MAX) },
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

  const papers: CareerPaper[] = (Array.isArray(data.papers)
    ? (data.papers as unknown[]).map((paper) => {
        const o = (paper ?? {}) as Record<string, unknown>;
        const strings = (value: unknown, max: number) => Array.isArray(value)
          ? value.filter((item): item is string => typeof item === "string").map((item) => capStr(item, max)).slice(0, 30)
          : [];
        return {
          title: capStr(o.title, FIELD_MAX),
          authors: strings(o.authors, ISSUE_FIELD_MAX),
          applicantAuthorOrder: Math.max(0, Math.min(30, Math.round(typeof o.applicantAuthorOrder === "number" ? o.applicantAuthorOrder : 0))),
          venue: capStr(o.venue, FIELD_MAX),
          abstract: capStr(o.abstract, 5000),
          issues: strings(o.issues, FIELD_MAX).slice(0, 10),
          verification: { status: "unverified" as const, records: [], conflicts: [] },
        };
      })
    : []
  ).slice(0, 10);

  return {
    strengths,
    ncsCategories,
    recommendedJobs,
    summary: str(data.summary),
    resumeSummary: str(data.resumeSummary).slice(0, 100),
    salaryGuide,
    typoIssues,
    dateIssues,
    papers,
  };
}

// ─── AI 프롬프트 ──────────────────────────────────────────────────────────
const CAREER_SYSTEM = `당신은 국가직무능력표준(NCS) 기반 커리어 컨설턴트입니다. 이력서를 분석해 오직 JSON만 반환하세요:
{
  "strengths": [{"title": "강점명", "evidence": "이력서 근거 (한국어 1~2문장)"}, ...] (3~5개),
  "ncsCategories": [{"major": "NCS 대분류(예: 20. 정보통신)", "middle": "중분류", "level": NCS 능력단위 수준 1-8 정수, "fitReason": "적합 이유 1~2문장"}, ...] (1~3개),
  "recommendedJobs": [{"job": "직업명", "ncsCategory": "해당 NCS 분류", "fitScore": 0-100, "reason": "추천 이유 2~3문장", "outlook": "미래 전망 3~4문장", "outlookScore": 0-100, "salaryGuide": {"min": 만원 단위 하한, "max": 만원 단위 상한, "basis": "해당 직업의 경력·시장 기준"}}, ...] (3개),
  "summary": "종합 커리어 조언 (한국어 4~6문장)",
  "resumeSummary": "이력서 핵심 요약 (100자 이내, 한국어)",
  "salaryGuide": {"min": 만원 단위 연봉 하한(숫자), "max": 만원 단위 연봉 상한(숫자), "basis": "산정 근거 — 경력 수준·직무 시장 현황 반영 (한국어 2~3문장)"},
  "typoIssues": [{"found": "이력서 표기", "suggestion": "올바른 표기", "note": "설명 1문장"}, ...] (직무에서 흔히 쓰는 기술·직무 용어의 오탈자만, 없으면 빈 배열),
  "dateIssues": [{"found": "문제 구간 표기", "issue": "설명", "suggestion": "수정 제안"}, ...],
  "papers": [{"title": "이력서 원문 논문명", "authors": ["원문 저자 순서"], "applicantAuthorOrder": 지원자 저자순(1부터, 확인 불가 0), "venue": "제출·게재 학회/저널", "abstract": "이력서에 기재된 초록 또는 요약", "issues": ["이력서 내부에서 발견한 논문명·저자명·저자순·학회 표기 오류/불확실성"]}, ...] (논문이 없으면 빈 배열)
}
NCS 대분류는 실제 NCS 24개 대분류 체계를 따르세요. NCS level은 직무 수행의 복잡성·자율성에 따른 1~8 수준입니다.
논문 정보는 이력서에 있는 근거만 사용하고 추측하지 마세요. 저자 배열은 반드시 기재 순서를 보존하세요. 외부 학술 메타데이터 대조는 서버에서 별도로 수행합니다.`;

function normalizeBibliography(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function titleMatches(a: string, b: string): boolean {
  const left = normalizeBibliography(a);
  const right = normalizeBibliography(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  return shorter.length >= 12 && longer.includes(shorter);
}

interface CrossrefItem {
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  "container-title"?: string[];
  event?: { name?: string };
  DOI?: string;
}

interface OpenAlexWork {
  id?: string;
  display_name?: string;
  doi?: string;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: {
    landing_page_url?: string;
    source?: { display_name?: string; country_code?: string };
  };
  locations?: Array<{
    landing_page_url?: string;
    source?: { display_name?: string; country_code?: string };
  }>;
}

function safeAcademicUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function recordsConflict(left: PaperVerificationRecord, right: PaperVerificationRecord): string[] {
  const conflicts: string[] = [];
  if (!titleMatches(left.title, right.title)) conflicts.push("출처별 논문 제목이 다릅니다.");
  if (left.authors.length && right.authors.length) {
    const a = left.authors.map(normalizeBibliography);
    const b = right.authors.map(normalizeBibliography);
    if (a.length !== b.length || a.some((name, index) => name !== b[index])) {
      conflicts.push("출처별 저자명 또는 저자순이 다릅니다.");
    }
  }
  if (left.venue && right.venue && normalizeBibliography(left.venue) !== normalizeBibliography(right.venue)) {
    conflicts.push("출처별 학회·저널 정보가 다릅니다.");
  }
  return conflicts;
}

function paperIssuesForRecord(paper: CareerPaper, record: PaperVerificationRecord): string[] {
  const issues: string[] = [];
  if (paper.authors.length && record.authors.length) {
    const listed = paper.authors.map(normalizeBibliography);
    const verified = record.authors.map(normalizeBibliography);
    if (listed.length !== verified.length || listed.some((name, index) => name !== verified[index])) {
      issues.push(`이력서의 저자명 또는 저자순이 ${record.source} 공개 기록과 다릅니다.`);
    }
  }
  if (paper.venue && record.venue && normalizeBibliography(paper.venue) !== normalizeBibliography(record.venue)) {
    issues.push(`이력서의 제출·게재 학회/저널 표기가 ${record.source} 공개 기록과 다릅니다.`);
  }
  return issues;
}

async function findPaperWithCrossref(title: string): Promise<PaperVerificationRecord | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const url = new URL("https://api.crossref.org/works");
    url.searchParams.set("query.title", title);
    url.searchParams.set("rows", "3");
    url.searchParams.set("select", "title,author,container-title,event,DOI");
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AI-Resume-Reviewer/1.0 (bibliographic verification)" },
    }).finally(() => clearTimeout(timeout));
    if (!response.ok) return null;
    const payload = await response.json() as { message?: { items?: CrossrefItem[] } };
    const match = payload.message?.items?.find((item) => titleMatches(title, item.title?.[0] ?? ""));
    if (!match) return null;
    const verifiedAuthors = (match.author ?? [])
      .map((author) => [author.given, author.family].filter(Boolean).join(" ").trim())
      .filter(Boolean);
    const verifiedTitle = match.title?.[0] ?? "";
    const verifiedVenue = match["container-title"]?.[0] ?? match.event?.name ?? "";
    return {
      source: "Crossref",
      title: verifiedTitle,
      authors: verifiedAuthors,
      venue: verifiedVenue,
      doi: match.DOI ?? "",
      url: match.DOI ? `https://doi.org/${encodeURIComponent(match.DOI)}` : "",
    };
  } catch {
    return null;
  }
}

async function findPaperWithOpenAlex(title: string): Promise<PaperVerificationRecord | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("search", title);
    url.searchParams.set("per-page", "10");
    url.searchParams.set("select", "id,display_name,doi,authorships,primary_location,locations");
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AI-Resume-Reviewer/1.0 (bibliographic verification)" },
    }).finally(() => clearTimeout(timeout));
    if (!response.ok) return null;
    const payload = await response.json() as { results?: OpenAlexWork[] };
    const candidates = (payload.results ?? []).filter((work) => titleMatches(title, work.display_name ?? ""));
    const match = candidates.find((work) =>
      work.primary_location?.source?.country_code === "KR" ||
      work.locations?.some((location) => location.source?.country_code === "KR")
    ) ?? candidates[0];
    if (!match) return null;
    const koreanLocation = match.locations?.find((location) => location.source?.country_code === "KR");
    const location = koreanLocation ?? match.primary_location;
    const doi = match.doi?.replace(/^https?:\/\/doi\.org\//i, "") ?? "";
    return {
      source: "OpenAlex",
      title: match.display_name ?? "",
      authors: (match.authorships ?? []).map((item) => item.author?.display_name ?? "").filter(Boolean),
      venue: location?.source?.display_name ?? match.primary_location?.source?.display_name ?? "",
      doi,
      url: safeAcademicUrl(location?.landing_page_url) || safeAcademicUrl(match.doi) || safeAcademicUrl(match.id),
    };
  } catch {
    return null;
  }
}

export async function verifyPaper(paper: CareerPaper): Promise<CareerPaper> {
  if (!paper.title.trim()) return paper;
  const crossref = await findPaperWithCrossref(paper.title);
  const openAlex = await findPaperWithOpenAlex(paper.title);
  const records = [crossref, openAlex].filter((record): record is PaperVerificationRecord => record !== null);
  if (!records.length) {
    return {
      ...paper,
      issues: [...paper.issues, "Crossref와 OpenAlex 국내 학술 메타데이터에서 제목이 일치하는 공개 기록을 찾지 못했습니다. 학회·저널 원문 확인이 필요합니다."].slice(0, 10),
    };
  }
  const conflicts = crossref && openAlex ? recordsConflict(crossref, openAlex) : [];
  const issues = [...paper.issues, ...records.flatMap((record) => paperIssuesForRecord(paper, record))];
  if (!crossref && openAlex) issues.push("Crossref 미발견 후 OpenAlex 국내 학술 메타데이터에서 확인했습니다.");
  if (conflicts.length) issues.push("학술 데이터 출처가 서로 달라 자동 확정하지 않았습니다.");
  return {
    ...paper,
    issues: [...new Set(issues)].slice(0, 10),
    verification: {
      status: conflicts.length ? "conflict" : "verified",
      records,
      conflicts,
    },
  };
}

async function runCareerAnalysis(resume: typeof resumesTable.$inferSelect): Promise<CareerAnalysisResult> {
  const resumeText = [
    resume.title,
    resume.content ? `[이력서 내용]\n${resumeHtmlToText(resume.content)}` : "",
    resume.coverLetter ? `[자기소개서]\n${resumeHtmlToText(resume.coverLetter)}` : "",
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
  result.papers = await Promise.all(result.papers.map(verifyPaper));

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
