// 서류 심사 점수의 근거(가점·감점 요인, 공고 요건 충족 여부)를 정제하고
// AI가 인용한 문장이 실제 이력서 원문에 있는지 대조한다.

export const SCORE_AREAS = [
  "technical",
  "language",
  "aiWriting",
  "personality",
  "jobMatch",
  "motivation",
] as const;
export type ScoreArea = (typeof SCORE_AREAS)[number];

export interface ScoreFactor {
  area: ScoreArea;
  effect: "plus" | "minus";
  reason: string;
  quote: string;
  /** quote가 이력서·자기소개서 원문에서 확인되었는지 */
  quoteVerified: boolean;
}

export interface RequirementCheck {
  requirement: string;
  kind: "required" | "preferred";
  status: "met" | "partial" | "unmet";
  evidence: string;
  evidenceVerified: boolean;
  comment: string;
}

const MAX_FACTORS_PER_AREA = 5;
const MAX_REQUIREMENTS = 12;
const MIN_QUOTE_LENGTH = 4;

/** 프롬프트에 붙이는 근거 작성 규칙 */
export const EVIDENCE_RULES = `근거 작성 규칙:
- scoreFactors는 점수를 올리거나(plus) 깎은(minus) 구체적 이유입니다. 지정된 area마다 2~4개 작성하세요.
- reason은 한국어 1문장으로, 점수에 어떤 영향을 줬는지 분명히 쓰세요.
- quote는 이력서·자기소개서에서 그 판단의 근거가 된 부분을 **원문 그대로** 짧게(80자 이내) 인용하세요. 요약하거나 바꿔 쓰지 마세요.
- 근거가 '내용이 없다'는 것이면(예: 경력 기술 부재) quote는 빈 문자열로 두세요.`;

function normalizeForMatch(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s"'“”‘’`.,·…:;!?()[\]{}<>~\-–—_*#|/\\]+/g, "");
}

/** 인용문이 원문(정규화 후)에 포함되는지 확인한다. 너무 짧은 인용은 확인하지 않는다. */
export function isQuoteInSource(quote: string, normalizedSource: string): boolean {
  const q = normalizeForMatch(quote);
  if (q.length < MIN_QUOTE_LENGTH) return false;
  return normalizedSource.includes(q);
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function sanitizeScoreFactors(
  raw: unknown,
  allowedAreas: readonly ScoreArea[],
  sourceText: string,
): ScoreFactor[] {
  if (!Array.isArray(raw)) return [];
  const source = normalizeForMatch(sourceText);
  const perArea = new Map<ScoreArea, number>();
  const out: ScoreFactor[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const area = r.area as ScoreArea;
    if (!allowedAreas.includes(area)) continue;
    const effect = r.effect === "plus" || r.effect === "minus" ? r.effect : null;
    const reason = str(r.reason);
    if (!effect || !reason) continue;

    const count = perArea.get(area) ?? 0;
    if (count >= MAX_FACTORS_PER_AREA) continue;
    perArea.set(area, count + 1);

    const quote = str(r.quote);
    out.push({ area, effect, reason, quote, quoteVerified: quote !== "" && isQuoteInSource(quote, source) });
  }
  return out;
}

export function sanitizeRequirementChecks(raw: unknown, sourceText: string): RequirementCheck[] {
  if (!Array.isArray(raw)) return [];
  const source = normalizeForMatch(sourceText);
  const out: RequirementCheck[] = [];

  for (const item of raw) {
    if (out.length >= MAX_REQUIREMENTS) break;
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const requirement = str(r.requirement);
    if (!requirement) continue;
    const status = r.status === "met" || r.status === "partial" || r.status === "unmet" ? r.status : null;
    if (!status) continue;

    const evidence = status === "unmet" ? "" : str(r.evidence);
    out.push({
      requirement,
      kind: r.kind === "preferred" ? "preferred" : "required",
      status,
      evidence,
      evidenceVerified: evidence !== "" && isQuoteInSource(evidence, source),
      comment: str(r.comment),
    });
  }
  return out;
}
