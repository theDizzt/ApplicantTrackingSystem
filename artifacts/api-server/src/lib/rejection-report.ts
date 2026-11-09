// 불합격 예상 원인 리포트: 1단계 심사 결과(점수·요건 충족·감점 요인)를 모아
// "떨어질 수 있는 이유 Top 3"와 "이렇게 어필하세요"를 만든다.
// AI 요약이 실패하면 규칙 기반으로 같은 형태의 리포트를 만든다.

import type { RequirementCheck, ScoreArea, ScoreFactor } from "./score-evidence";

export type Severity = "high" | "medium" | "low";

export interface RejectionReason {
  title: string;
  severity: Severity;
  detail: string;
  fix: string;
}

export interface AppealPoint {
  strength: string;
  howToAppeal: string;
}

export interface RejectionReport {
  summary: string;
  reasons: RejectionReason[];
  appealPoints: AppealPoint[];
  source: "ai" | "rules";
}

export interface RejectionSignals {
  overallScore: number | null;
  passed: boolean;
  scores: Partial<Record<ScoreArea, number | null>>;
  requirements: RequirementCheck[];
  factors: ScoreFactor[];
  documentChecks: { photoMissing: boolean; coverLetterTooShort: boolean; coverLetterLength: number };
  jobSimilarity: { score: number | null; threshold: number };
  graduationGap: { isLongGap: boolean; gapType: string; gapYears: number };
}

const MAX_REASONS = 3;
const MAX_APPEALS = 3;

const AREA_LABELS: Record<ScoreArea, string> = {
  jobMatch: "직무 적합도", technical: "기술 역량", motivation: "지원 동기",
  personality: "인성", language: "국어 품질", aiWriting: "진정성(AI 작성 탐지)",
};

export const REJECTION_REPORT_SYSTEM = `당신은 채용 담당자 출신의 취업 컨설턴트입니다. 아래 서류 심사 결과를 보고, 이 지원자가 서류에서 떨어질 수 있는 가장 큰 이유와 보완·어필 전략을 정리하세요.
오직 JSON만 반환하세요:
{
  "summary": "현재 서류의 합격 가능성과 가장 큰 문제를 요약 (한국어 1~2문장)",
  "reasons": [{"title": "탈락 원인 (15자 이내)", "severity": "high" | "medium" | "low", "detail": "왜 탈락 원인이 되는지, 심사 결과의 어떤 근거에서 나왔는지 (한국어 1~2문장)", "fix": "지원 전에 서류를 어떻게 고치면 되는지 구체적 행동 (한국어 1~2문장)"}],
  "appealPoints": [{"strength": "지원자의 강점 (15자 이내)", "howToAppeal": "이 회사에 맞춰 자기소개서·면접에서 어떻게 어필할지 (한국어 1~2문장)"}]
}

작성 규칙:
- reasons는 탈락에 미치는 영향이 큰 순서로 최대 3개입니다. 미충족 필수 요건, 낮은 점수 영역, 감점 요인을 우선 보세요. 서로 겹치는 원인은 하나로 합치세요.
- severity: 필수 요건 미충족·핵심 점수 50점 미만처럼 그것만으로 탈락할 수 있으면 high, 감점은 크지만 보완 가능하면 medium, 사소하면 low입니다.
- [공고 미기재 · AI 추정] 표시가 붙은 요건은 회사가 실제로 요구한다는 근거가 없습니다. 이 요건의 미충족은 high로 두지 말고, 원인으로 쓸 때는 detail에 "공고에 명시되지 않은 추정 요건"임을 밝히세요. 공고에 적힌 요건을 우선하세요.
- 심사 결과에 없는 사실을 지어내지 마세요. 스펙을 새로 쌓으라는 조언보다, 이미 가진 경험을 공고 요건에 맞춰 다시 쓰는 방법을 우선 제시하세요.
- appealPoints는 가점 요인·충족 요건에서 찾은 강점 최대 3개입니다. 회사의 요건·인재상과 연결해 어필 방법을 쓰세요.`;

/** AI 요약 호출에 넘길 심사 결과 요약문. 이력서 전문 대신 1단계 결과만 넘겨 토큰을 아낀다. */
export function buildRejectionReportInput(signals: RejectionSignals, companyText: string): string {
  const lines: string[] = [`[지원 회사]\n${companyText}`, ""];
  lines.push(`[종합] ${signals.overallScore ?? "?"}점 · ${signals.passed ? "합격권" : "불합격권"} (70점 이상 합격)`);

  const scoreLine = (Object.entries(signals.scores) as [ScoreArea, number | null][])
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => `${AREA_LABELS[k]} ${v}`)
    .join(", ");
  if (scoreLine) lines.push(`[영역별 점수] ${scoreLine}`);

  if (signals.requirements.length > 0) {
    lines.push("", "[공고 요건 충족 여부]");
    for (const r of signals.requirements) {
      const st = r.status === "met" ? "충족" : r.status === "partial" ? "부분 충족" : "미충족";
      const origin = r.source === "inferred" ? " [공고 미기재 · AI 추정]" : "";
      lines.push(`- (${r.kind === "required" ? "필수" : "우대"}) ${r.requirement}${origin}: ${st}${r.comment ? ` — ${r.comment}` : ""}`);
    }
  }

  const fmt = (f: ScoreFactor) => `- [${AREA_LABELS[f.area]}] ${f.reason}${f.quote ? ` (근거: "${f.quote}")` : ""}`;
  const minus = signals.factors.filter((f) => f.effect === "minus");
  const plus = signals.factors.filter((f) => f.effect === "plus");
  if (minus.length > 0) lines.push("", "[감점 요인]", ...minus.map(fmt));
  if (plus.length > 0) lines.push("", "[가점 요인]", ...plus.map(fmt));

  const extra: string[] = [];
  if (signals.documentChecks.coverLetterTooShort) extra.push(`자기소개서 분량 부족(공백 제외 ${signals.documentChecks.coverLetterLength}자)`);
  if (signals.documentChecks.photoMissing) extra.push("이력서 사진 미등록");
  const sim = signals.jobSimilarity;
  if (sim.score !== null && sim.score <= sim.threshold) extra.push(`공고 직무 내용과 자기소개서의 문장 유사도 낮음(${sim.score}점)`);
  if (signals.graduationGap.isLongGap) {
    extra.push(`${signals.graduationGap.gapType === "employment" ? "경력" : "졸업 후"} 공백 약 ${signals.graduationGap.gapYears}년`);
  }
  if (extra.length > 0) lines.push("", "[서류 점검]", ...extra.map((e) => `- ${e}`));

  return lines.join("\n");
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** AI 응답을 정제한다. 쓸 만한 원인이 하나도 없으면 null을 반환해 규칙 기반으로 넘긴다. */
export function sanitizeRejectionReport(raw: Record<string, unknown>): RejectionReport | null {
  const reasons: RejectionReason[] = (Array.isArray(raw.reasons) ? raw.reasons : [])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      title: str(r.title),
      severity: (r.severity === "high" || r.severity === "low" ? r.severity : "medium") as Severity,
      detail: str(r.detail),
      fix: str(r.fix),
    }))
    .filter((r) => r.title && r.detail)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, MAX_REASONS);

  if (reasons.length === 0) return null;

  const appealPoints: AppealPoint[] = (Array.isArray(raw.appealPoints) ? raw.appealPoints : [])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({ strength: str(r.strength), howToAppeal: str(r.howToAppeal) }))
    .filter((r) => r.strength && r.howToAppeal)
    .slice(0, MAX_APPEALS);

  return { summary: str(raw.summary), reasons, appealPoints, source: "ai" };
}

/** AI 요약 없이 심사 결과만으로 만드는 리포트 */
export function buildRuleBasedReport(signals: RejectionSignals): RejectionReport {
  const candidates: (RejectionReason & { weight: number })[] = [];

  for (const r of signals.requirements) {
    if (r.status === "met") continue;
    const required = r.kind === "required";
    const unmet = r.status === "unmet";
    const inferred = r.source === "inferred";
    // 공고에 없는 AI 추정 요건은 회사가 실제로 요구한다는 근거가 없으므로 최고 위험도로 올리지 않는다.
    const severity: Severity = required && unmet && !inferred ? "high" : required || unmet ? "medium" : "low";
    const baseDetail = r.comment || (inferred
      ? `직무상 필요할 것으로 보이는 '${r.requirement}'을(를) 서류에서 충분히 확인할 수 없습니다.`
      : `공고의 ${required ? "필수" : "우대"} 요건인 '${r.requirement}'을(를) 서류에서 충분히 확인할 수 없습니다.`);
    candidates.push({
      title: `${r.requirement} ${unmet ? "미충족" : "부분 충족"}`,
      severity,
      detail: inferred ? `${baseDetail} (공고에 명시되지 않은 AI 추정 요건)` : baseDetail,
      fix: `'${r.requirement}'과(와) 관련된 경험이 있다면 이력서·자기소개서에 구체적인 사례와 성과로 드러내세요.`,
      weight: (required ? 20 : 10) + (unmet ? 10 : 0) - (inferred ? 15 : 0),
    });
  }

  for (const [area, score] of Object.entries(signals.scores) as [ScoreArea, number | null][]) {
    if (typeof score !== "number" || score >= 60) continue;
    const minus = signals.factors.find((f) => f.area === area && f.effect === "minus");
    candidates.push({
      title: `${AREA_LABELS[area]} 낮음 (${score}점)`,
      severity: score < 50 ? "high" : "medium",
      detail: minus?.reason || `${AREA_LABELS[area]} 점수가 ${score}점으로 합격 기준에 못 미칩니다.`,
      fix: `${AREA_LABELS[area]} 항목의 감점 요인을 확인하고 해당 부분을 보완하세요.`,
      weight: 60 - score,
    });
  }

  if (signals.documentChecks.coverLetterTooShort) {
    candidates.push({
      title: "자기소개서 분량 부족",
      severity: "medium",
      detail: `자기소개서가 공백 제외 ${signals.documentChecks.coverLetterLength}자로, 지원 동기와 경험을 판단하기에 짧습니다.`,
      fix: "지원 동기, 직무 관련 경험, 입사 후 계획을 각각 구체적인 사례로 보완하세요.",
      weight: 12,
    });
  }

  const sim = signals.jobSimilarity;
  if (sim.score !== null && sim.score <= sim.threshold) {
    candidates.push({
      title: "공고와 자기소개서 연관성 낮음",
      severity: "medium",
      detail: `공고의 직무 내용과 자기소개서의 문장 유사도가 ${sim.score}점으로 낮습니다.`,
      fix: "공고의 주요 업무·요건 표현을 기준으로 자신의 경험을 다시 연결해 쓰세요.",
      weight: 11,
    });
  }

  candidates.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.weight - a.weight);
  const reasons = candidates.slice(0, MAX_REASONS).map(({ weight: _w, ...r }) => r);

  const appealPoints: AppealPoint[] = [];
  for (const r of signals.requirements) {
    if (appealPoints.length >= MAX_APPEALS) break;
    if (r.status !== "met") continue;
    appealPoints.push({
      strength: r.requirement,
      howToAppeal: r.source === "inferred"
        ? `직무에 필요한 '${r.requirement}' 역량을 갖췄으므로, 자기소개서와 면접에서 관련 경험을 앞세워 강조하세요.`
        : `공고 요건인 '${r.requirement}'을(를) 충족하므로, 자기소개서와 면접에서 관련 경험을 앞세워 강조하세요.`,
    });
  }
  for (const f of signals.factors) {
    if (appealPoints.length >= MAX_APPEALS) break;
    if (f.effect !== "plus") continue;
    appealPoints.push({ strength: AREA_LABELS[f.area], howToAppeal: f.reason });
  }

  const summary = reasons.length === 0
    ? "뚜렷한 탈락 요인이 발견되지 않았습니다. 아래 강점을 중심으로 어필하세요."
    : `${signals.passed ? "합격권이지만" : "현재 불합격권이며"}, '${reasons[0]!.title}'이(가) 가장 큰 위험 요인입니다.`;

  return { summary, reasons, appealPoints, source: "rules" };
}
