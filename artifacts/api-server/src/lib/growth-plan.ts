// 취업 역량 강화 계획: 서류 심사 결과(부족한 요건·불합격 원인·보완점)를 바탕으로
// 지금 바로 시작해 4~8주 안에 마칠 수 있는 단기 계획을 주차별 과제·결과물·완료 기준으로 만든다
// (회의 #8 참고 화면 2). 지원자의 현재 단계와 주당 가능 시간에 맞춰 사람마다 다르게 만든다.

import { isQuoteInSource, normalizeForMatch } from "./score-evidence";
import { resumeHtmlToText } from "./resume-text";

export const LEARNER_STAGES = ["student", "senior", "graduate"] as const;
export type LearnerStage = (typeof LEARNER_STAGES)[number];

export const LEARNER_STAGE_LABELS: Record<LearnerStage, string> = {
  student: "1~3학년 재학생",
  senior: "4학년·졸업 예정자",
  graduate: "졸업 후 구직 중",
};

const STAGE_GUIDE: Record<LearnerStage, string> = {
  student:
    "지원자는 1~3학년 재학생입니다. 학기 중에도 병행할 수 있는 활동을 고르고, 수업 과제·동아리·팀 프로젝트를 직무 경험으로 키우는 방향을 우선하세요. 당장 지원할 서류보다 다음 지원 시즌에 쓸 결과물을 만드는 계획입니다.",
  senior:
    "지원자는 4학년·졸업 예정자로 지원 시즌이 가깝습니다. 새 경험을 크게 벌이기보다, 이미 한 경험을 증빙할 수 있는 결과물(정리 문서·저장소·발표 자료)로 만드는 것을 우선하세요. 기간 안에 끝나지 않는 자격증·장기 과정은 넣지 마세요.",
  graduate:
    "지원자는 졸업 후 구직 중입니다. 면접에서 공백 기간에 무엇을 했는지 설명할 수 있도록, 실무와 비슷한 결과물이 남는 활동을 우선하세요. 주당 시간을 비교적 많이 쓸 수 있다고 보되, 아래 주당 가능 시간은 지키세요.",
};

export const MIN_WEEKS = 4;
export const MAX_WEEKS = 8;
export const MAX_PLAN_ITEMS = 3;
export const WEEKLY_HOURS_RANGE = { min: 2, max: 20, default: 6 } as const;
const RESUME_LIMIT = 5000;
const COMPANY_LIMIT = 1500;
const QUOTE_LIMIT = 120;

export interface GrowthTask {
  week: number;
  task: string;
  deliverable: string;
}

export interface GrowthPlanItem {
  title: string;
  quote: string;
  quoteVerified: boolean;
  whyHelpful: string;
  totalWeeks: number;
  hoursPerWeek: number;
  weeklyTasks: GrowthTask[];
  completionCriteria: string;
}

export interface GrowthPlan {
  stage: LearnerStage;
  weeklyHours: number;
  items: GrowthPlanItem[];
  createdAt: string;
}

export function parseLearnerStage(value: unknown): LearnerStage | null {
  return typeof value === "string" && (LEARNER_STAGES as readonly string[]).includes(value) ? (value as LearnerStage) : null;
}

export function parseWeeklyHours(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return WEEKLY_HOURS_RANGE.default;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < WEEKLY_HOURS_RANGE.min || n > WEEKLY_HOURS_RANGE.max) return null;
  return n;
}

export function buildGrowthPlanSystem(stage: LearnerStage, weeklyHours: number): string {
  return `당신은 대학생·취업 준비생을 돕는 커리어 코치입니다. 아래 서류 심사 결과에서 드러난 부족한 점을 보고, 지금 바로 시작해 ${MIN_WEEKS}~${MAX_WEEKS}주 안에 마칠 수 있는 단기 역량 강화 계획을 만드세요.
오직 JSON만 반환하세요:
{
  "items": [{
    "title": "계획 제목 (35자 이내, 예: RPA 자동화 성과를 검증 가능한 업무 사례로 정리)",
    "quote": "이 계획의 근거가 된 이력서 원문을 그대로 짧게 인용 (80자 이내, 근거가 '내용이 없음'이면 빈 문자열)",
    "whyHelpful": "이 활동이 이 회사 지원에 도움이 되는 이유 (한국어 1~2문장)",
    "totalWeeks": ${MIN_WEEKS}~${MAX_WEEKS} 사이 정수,
    "hoursPerWeek": 주당 시간 (정수),
    "weeklyTasks": [{"week": 1, "task": "이번 주에 할 일 (1문장)", "deliverable": "이번 주 결과물 (예: 프로젝트 경험 정리표 1부)"}],
    "completionCriteria": "무엇을 설명·제출할 수 있으면 끝난 것인지 (한국어 1~2문장)"
  }]
}

지원자 상황:
- ${STAGE_GUIDE[stage]}
- 주당 쓸 수 있는 시간은 모두 합쳐 ${weeklyHours}시간입니다. 계획들의 hoursPerWeek 합이 ${weeklyHours}시간을 넘지 않게 나누세요.

작성 규칙:
- items는 효과가 큰 순서로 1~${MAX_PLAN_ITEMS}개입니다.
- weeklyTasks는 1주차부터 totalWeeks주차까지 주마다 하나씩, 빠짐없이 쓰세요. 매주 눈에 보이는 결과물이 남아야 합니다.
- 공고 요건·불합격 원인·보완점과 직접 연결된 활동만 고르세요. 스펙을 무작정 늘리라는 계획 대신, 이미 가진 경험을 공고에 맞춰 증빙하는 활동을 우선하세요.
- 특정 강의·공모전·시험의 이름이나 일정을 지어내지 마세요. "공식 문서 튜토리얼", "학교 공모전"처럼 종류로만 쓰세요.
- 이력서에 없는 경험·성과를 이미 한 것처럼 쓰지 마세요.
- 학생 수준에서 혼자 또는 팀 프로젝트로 할 수 있는 활동만 제안하세요.`;
}

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

interface StoredRich {
  rejectionReport?: { reasons?: { title?: unknown; detail?: unknown }[] };
  scoreEvidence?: { requirements?: { requirement?: unknown; kind?: unknown; status?: unknown; comment?: unknown }[] };
  interviewPrep?: { points?: { title?: unknown }[] };
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** AI 입력: 이력서(글자 수 제한) + 회사 정보 + 서류 심사에서 찾은 부족한 점 */
export function buildGrowthPlanInput(opts: {
  resumeContent: string | null | undefined;
  coverLetter: string | null | undefined;
  companyText: string;
  rich: StoredRich;
}): string {
  const resume = resumeHtmlToText([opts.resumeContent ?? "", opts.coverLetter ?? ""].join("\n"));
  const lines: string[] = [`[지원 회사]\n${clip(opts.companyText, COMPANY_LIMIT)}`];
  if (resume) lines.push(`[이력서·자기소개서]\n${clip(resume, RESUME_LIMIT)}`);

  const reasons = (opts.rich.rejectionReport?.reasons ?? []).map((r) => {
    const title = s(r.title);
    const detail = s(r.detail);
    return title ? `- ${title}${detail ? ` — ${detail}` : ""}` : "";
  }).filter(Boolean);
  if (reasons.length) lines.push(`[불합격 예상 원인]\n${reasons.join("\n")}`);

  const reqs = (opts.rich.scoreEvidence?.requirements ?? [])
    .filter((r) => r.status === "unmet" || r.status === "partial")
    .map((r) => {
      const name = s(r.requirement);
      if (!name) return "";
      const st = r.status === "unmet" ? "미충족" : "부분 충족";
      const comment = s(r.comment);
      return `- (${r.kind === "preferred" ? "우대" : "필수"}) ${name}: ${st}${comment ? ` — ${comment}` : ""}`;
    })
    .filter(Boolean);
  if (reqs.length) lines.push(`[부족한 공고 요건]\n${reqs.join("\n")}`);

  const prep = (opts.rich.interviewPrep?.points ?? []).map((p) => s(p.title)).filter(Boolean);
  if (prep.length) lines.push(`[면접 대비 보완점]\n${prep.map((t) => `- ${t}`).join("\n")}`);

  return lines.join("\n\n");
}

function toInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * AI 응답을 정제한다.
 * - 주차 과제는 1~8주차만, 주차마다 하나씩 남기고 정렬한다. 4개 미만이면 그 계획은 버린다.
 * - 총 기간은 남은 과제 수로 맞추고, 주당 시간은 1시간~지원자의 주당 가능 시간으로 제한한다.
 * - 인용문은 이력서 원문과 대조해 quoteVerified를 붙인다.
 */
export function sanitizeGrowthPlan(
  raw: Record<string, unknown>,
  sourceText: string,
  opts: { stage: LearnerStage; weeklyHours: number; now?: Date },
): GrowthPlan {
  const source = normalizeForMatch(sourceText);
  const items: GrowthPlanItem[] = [];
  const seen = new Set<string>();

  for (const item of Array.isArray(raw.items) ? raw.items : []) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const title = s(r.title);
    const whyHelpful = s(r.whyHelpful);
    const completionCriteria = s(r.completionCriteria);
    if (!title || !whyHelpful || !completionCriteria || seen.has(title)) continue;

    const byWeek = new Map<number, GrowthTask>();
    for (const t of Array.isArray(r.weeklyTasks) ? r.weeklyTasks : []) {
      if (!t || typeof t !== "object") continue;
      const tt = t as Record<string, unknown>;
      const week = toInt(tt.week);
      const task = s(tt.task);
      if (week === null || week < 1 || week > MAX_WEEKS || !task || byWeek.has(week)) continue;
      byWeek.set(week, { week, task, deliverable: s(tt.deliverable) });
    }
    // 빠진 주차가 있으면 순서대로 다시 번호를 매긴다 (예: 1·2·4·5주차 → 1~4주차)
    const weeklyTasks = [...byWeek.values()]
      .sort((a, b) => a.week - b.week)
      .map((t, i) => ({ ...t, week: i + 1 }));
    if (weeklyTasks.length < MIN_WEEKS) continue;

    const hours = toInt(r.hoursPerWeek);
    const quote = clip(s(r.quote), QUOTE_LIMIT);
    seen.add(title);
    items.push({
      title,
      quote,
      quoteVerified: quote !== "" && isQuoteInSource(quote, source),
      whyHelpful,
      totalWeeks: weeklyTasks.length,
      hoursPerWeek: Math.min(Math.max(hours ?? 1, 1), opts.weeklyHours),
      weeklyTasks,
      completionCriteria,
    });
    if (items.length >= MAX_PLAN_ITEMS) break;
  }

  return {
    stage: opts.stage,
    weeklyHours: opts.weeklyHours,
    items,
    createdAt: (opts.now ?? new Date()).toISOString(),
  };
}
