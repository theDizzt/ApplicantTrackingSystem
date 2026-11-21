// 꼬리 질문 면접: 서류 심사 약점을 면접 질문으로 연결하고, 답변에 따라 꼬리 질문을 이어간다.

/** 기본 질문(depth 0) 아래로 이어지는 꼬리 질문의 최대 단계 (난이도별 값의 상한) */
export const MAX_FOLLOW_UP_DEPTH = 2;

// ── 면접 난이도 · 꼬리 질문 말투 ─────────────────────────────────────────────
export type Difficulty = "easy" | "normal" | "hard";
export type FollowUpTone = "pressure" | "neutral" | "positive";

interface DifficultyRule {
  label: string;
  /** 질문 하나 아래로 이어지는 꼬리 질문 최대 단계 */
  maxDepth: number;
  /** 면접 전체 꼬리 질문 최대 개수 (AI 호출 수 상한) */
  maxFollowUps: number;
  /** 기본 질문을 만들 때의 지시 */
  questionStyle: string;
  /** 채점 기준 */
  scoringStyle: string;
}

const GUARDRAIL = "외모·나이·성별·가족·종교·출신 지역 등 사적인 질문, 인신공격, 모욕적인 표현은 어떤 난이도에서도 금지입니다.";

export const DIFFICULTY_RULES: Record<Difficulty, DifficultyRule> = {
  easy: {
    label: "하",
    maxDepth: 1,
    maxFollowUps: 3,
    questionStyle: "난이도 '하': 지원 동기, 경험 소개, 배운 점처럼 준비하면 답할 수 있는 기본 질문 위주로, 부드럽고 격려하는 말투로 만드세요. 압박 질문은 넣지 마세요.",
    scoringStyle: "난이도 '하': 처음 면접을 연습하는 지원자로 보고, 핵심을 전달했다면 너그럽게 채점하세요.",
  },
  normal: {
    label: "중",
    maxDepth: 2,
    maxFollowUps: 5,
    questionStyle: "난이도 '중': 경험을 검증하는 질문과 직무 역량 질문을 균형 있게, 실제 면접관처럼 정중하고 담백한 말투로 만드세요.",
    scoringStyle: "난이도 '중': 실제 면접 기준으로 채점하세요.",
  },
  hard: {
    label: "상",
    maxDepth: 2,
    maxFollowUps: 7,
    questionStyle: "난이도 '상': 5개 중 2개 이상은 지원자의 멘탈을 흔드는 압박 질문으로 만드세요. 이력서의 약점·공백·과장 가능성을 정면으로 짚거나, \"그 성과는 팀 덕분 아닌가요?\"처럼 반박하거나, 답하기 곤란한 가정 상황을 던지세요. 말투는 정중하되 날카롭게.",
    scoringStyle: "난이도 '상': 엄격하게 채점하세요. 근거 없는 주장, 모호한 역할, 압박에 흔들려 논리가 무너진 답변은 크게 감점하세요.",
  },
};

export function parseDifficulty(value: unknown): Difficulty {
  return value === "easy" || value === "hard" ? value : "normal";
}

/**
 * 답변 점수와 난이도로 꼬리 질문 말투를 정한다. AI에게도 같은 기준을 알려 주고,
 * 저장하는 값은 서버가 점수로 다시 계산한 것을 쓴다(AI가 기준을 어겨도 표시는 일관되게).
 */
const TONE_THRESHOLDS: Record<Difficulty, { pressureBelow: number; positiveFrom: number }> = {
  easy: { pressureBelow: 0, positiveFrom: 70 },
  normal: { pressureBelow: 60, positiveFrom: 80 },
  hard: { pressureBelow: 80, positiveFrom: 90 },
};

export function followUpTone(score: number, difficulty: Difficulty): FollowUpTone {
  const { pressureBelow, positiveFrom } = TONE_THRESHOLDS[difficulty];
  if (score < pressureBelow) return "pressure";
  if (score >= positiveFrom) return "positive";
  return "neutral";
}

const TONE_GUIDE: Record<FollowUpTone, string> = {
  pressure: "압박형 — 답변의 허점·모순·근거 부족을 정면으로 짚고 반례나 반박으로 몰아붙이는 질문 (예: \"방금 말씀은 결국 지시받은 일을 한 것 아닌가요?\")",
  neutral: "중립형 — 모호한 부분을 담담하게 구체적인 사실·수치·역할로 확인하는 질문",
  positive: "긍정형 — 잘한 점을 짧게 인정한 뒤(\"좋습니다. 그럼…\") 한 단계 더 깊은 응용·확장 역량을 묻는 질문",
};

/** 꼬리 질문 말투 규칙 (AI가 매긴 점수에 맞춰 고르게 한다) */
export function toneInstruction(difficulty: Difficulty): string {
  const { pressureBelow, positiveFrom } = TONE_THRESHOLDS[difficulty];
  const lines = [
    pressureBelow > 0 ? `- 점수 ${pressureBelow}점 미만: ${TONE_GUIDE.pressure}` : null,
    `- 점수 ${pressureBelow > 0 ? `${pressureBelow}~${positiveFrom - 1}점` : `${positiveFrom}점 미만`}: ${TONE_GUIDE.neutral}`,
    `- 점수 ${positiveFrom}점 이상: ${TONE_GUIDE.positive}`,
  ].filter(Boolean);
  return `꼬리 질문 말투는 이 답변에 매긴 점수에 따라 정하세요 (${DIFFICULTY_RULES[difficulty].scoringStyle}):\n${lines.join("\n")}\n${GUARDRAIL}`;
}

export function questionStyleInstruction(difficulty: Difficulty): string {
  return `\n${DIFFICULTY_RULES[difficulty].questionStyle}\n${GUARDRAIL}`;
}

/**
 * 꼬리 질문을 더 만들 수 있는지. 질문당 단계 제한과 면접 전체 개수 제한을 함께 본다.
 * existingFollowUps에는 이번에 지워질 꼬리 질문을 빼고 센 값을 넣는다.
 */
export function canAddFollowUp(depth: number, existingFollowUps: number, difficulty: Difficulty): boolean {
  const rule = DIFFICULTY_RULES[difficulty];
  return depth < rule.maxDepth && existingFollowUps < rule.maxFollowUps;
}

/** 답변마다 반복해서 보내는 회사 정보는 길이를 제한해 토큰을 아낀다. */
export const COMPANY_CONTEXT_LIMITS = { talentProfile: 600, jobDescription: 1500 } as const;

export function truncateForPrompt(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…(이하 생략)` : clean;
}
const MAX_WEAKNESSES = 3;
const MAX_QUESTION_LENGTH = 300;

export interface Weakness {
  title: string;
  detail: string;
}

interface StoredRejectionReport {
  reasons?: { title?: unknown; detail?: unknown }[];
}
interface StoredRequirement {
  requirement?: unknown;
  kind?: unknown;
  status?: unknown;
  comment?: unknown;
}

/**
 * 서류 심사 결과(richAnalysisResult JSON)에서 면접에서 확인할 약점을 뽑는다.
 * 불합격 예상 원인 리포트를 우선 쓰고, 없으면(이전 버전 심사) 미충족 필수 요건을 쓴다.
 */
export function extractWeaknesses(richAnalysisResult: string | null | undefined): Weakness[] {
  if (!richAnalysisResult) return [];
  let rich: { rejectionReport?: StoredRejectionReport; scoreEvidence?: { requirements?: StoredRequirement[] } };
  try {
    rich = JSON.parse(richAnalysisResult);
  } catch {
    return [];
  }

  const fromReport = (rich.rejectionReport?.reasons ?? [])
    .map((r) => ({
      title: typeof r.title === "string" ? r.title.trim() : "",
      detail: typeof r.detail === "string" ? r.detail.trim() : "",
    }))
    .filter((w) => w.title);
  if (fromReport.length > 0) return fromReport.slice(0, MAX_WEAKNESSES);

  return (rich.scoreEvidence?.requirements ?? [])
    .filter((r) => r.status === "unmet" && r.kind !== "preferred" && typeof r.requirement === "string" && r.requirement.trim())
    .map((r) => ({
      title: `${String(r.requirement).trim()} 미충족`,
      detail: typeof r.comment === "string" ? r.comment.trim() : "",
    }))
    .slice(0, MAX_WEAKNESSES);
}

export function weaknessInstruction(weaknesses: Weakness[]): string {
  if (weaknesses.length === 0) return "";
  const list = weaknesses.map((w, i) => `${i + 1}. ${w.title}${w.detail ? ` — ${w.detail}` : ""}`).join("\n");
  return `\n\n서류 심사에서 찾은 지원자의 약점(탈락 예상 원인):\n${list}
위 약점 중 중요한 것을 면접관이 실제로 파고들 질문으로 2개 포함하세요. 약점을 그대로 지적하기보다, 지원자가 그 우려를 어떻게 해소하는지 확인하는 질문으로 만드세요. 이 질문들은 source를 weakness로, focus에 해당 약점 제목을 그대로 적으세요.`;
}

/** AI가 준 꼬리 질문 문자열을 정리한다. 쓸 수 없으면 null. */
export function cleanFollowUpQuestion(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const q = raw.replace(/\s+/g, " ").trim();
  if (q.length < 5) return null;
  return q.length > MAX_QUESTION_LENGTH ? `${q.slice(0, MAX_QUESTION_LENGTH)}…` : q;
}

export interface ChainQuestion {
  id: number;
  question: string;
  answer: string | null;
  parentQuestionId: number | null;
}

/** 기본 질문부터 대상 꼬리 질문까지의 질문·답변 사슬(오래된 것부터). 순환이나 끊긴 고리는 거기서 멈춘다. */
export function buildChain<T extends ChainQuestion>(questions: T[], questionId: number): T[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const chain: T[] = [];
  const seen = new Set<number>();
  let current = byId.get(questionId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentQuestionId == null ? undefined : byId.get(current.parentQuestionId);
  }
  return chain;
}

/** 기본 질문과 그 아래로 이어진 꼬리 질문들(얕은 것부터). 순환이 있으면 거기서 멈춘다. */
export function chainFrom<T extends { id: number; parentQuestionId: number | null }>(questions: T[], rootId: number): T[] {
  const chain: T[] = [];
  let current = questions.find((q) => q.id === rootId);
  while (current && !chain.includes(current)) {
    chain.push(current);
    const parentId = current.id;
    current = questions.find((q) => q.parentQuestionId === parentId);
  }
  return chain;
}

/** 어떤 질문 아래로 이어진 모든 꼬리 질문 ID (답변을 다시 하면 이전 꼬리는 무효가 된다) */
export function descendantIds(questions: { id: number; parentQuestionId: number | null }[], rootId: number): number[] {
  const out: number[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const parent = queue.shift()!;
    for (const q of questions) {
      if (q.parentQuestionId === parent && !out.includes(q.id)) {
        out.push(q.id);
        queue.push(q.id);
      }
    }
  }
  return out;
}

export const FOLLOW_UP_RULES = `꼬리 질문(followUp) 작성 규칙:
- 실제 면접관처럼 방금 답변에서 가장 모호하거나 근거가 부족한 부분, 또는 과장이 의심되는 부분을 한 가지만 콕 집어 더 깊이 묻는 질문 1개입니다.
- 답변에 나온 구체적 표현(프로젝트명, 수치, 역할 등)을 인용해 이어지는 질문으로 만드세요. 처음 질문을 반복하거나 새 주제로 넘어가지 마세요.
- 답변이 이미 충분히 구체적이고 검증 가능하면 빈 문자열("")로 두세요.`;

/** 기본 질문부터 이어진 질문·답변 흐름을 프롬프트용 글로 만든다. */
export function formatChain(chain: { question: string; answer: string | null }[]): string {
  return chain
    .map((question, index) => `${index === 0 ? "기본 질문" : `꼬리 질문 ${index}`}: ${question.question}\n답변: ${question.answer ?? "(답하지 않음)"}`)
    .join("\n\n");
}

const SPOKEN_ANSWER_RULE = `답변은 지원자의 음성을 자동으로 받아 적은 글입니다. 맞춤법·띄어쓰기·문장부호와 음성 인식 오류로 보이는 단어는 평가하지 말고 내용만 평가하세요.`;

/** 실시간(음성) 면접: 방금 한 답변 하나를 평가하고 다음 꼬리 질문을 정한다. */
export const LIVE_ANSWER_SYSTEM = `당신은 실시간 음성 면접을 진행하는 채용 면접관입니다. 아래 지원 회사 정보와 지금까지의 질문·답변 흐름을 보고, 마지막 질문에 대한 답변을 평가하세요.
${SPOKEN_ANSWER_RULE}
0~100 정수 점수와 한국어 피드백 2~3문장(잘한 점과 더 보완할 점)을 주세요. JSON만 반환하세요:
{ "score": 0, "feedback": "피드백", "followUp": "다음 꼬리 질문 또는 빈 문자열" }

${FOLLOW_UP_RULES}
- 꼬리 질문은 면접관이 소리 내어 읽습니다. 말하듯 자연스러운 한두 문장으로 짧게 쓰세요.`;

/** 실시간(음성) 면접을 마칠 때 전체 흐름으로 종합 평가한다. */
export const LIVE_SUMMARY_SYSTEM = `당신은 채용 면접관입니다. 방금 끝난 실시간 음성 면접의 모든 질문·답변 흐름을 보고, 반드시 제공된 회사명·인재상·채용공고 기준으로 종합 평가하세요.
${SPOKEN_ANSWER_RULE}
답하지 않은 질문이 있으면 그 점도 반영하세요. 종합 점수는 0~100 정수, 종합 피드백은 한국어 4~6문장(강점, 보완할 점, 다음 연습 방향)으로 쓰세요. JSON만 반환하세요:
{ "overallScore": 0, "overallFeedback": "종합 피드백" }`;

export const FOLLOW_UP_ANSWER_SYSTEM =`당신은 채용 면접관입니다. 아래 지원 회사 정보와 지금까지의 질문·답변 흐름을 보고, 마지막 꼬리 질문에 대한 답변을 평가하세요.
0~100 정수 점수와 한국어 피드백 2~3문장(잘한 점과 더 보완할 점)을 주세요. JSON만 반환하세요:
{ "score": 0, "feedback": "피드백", "followUp": "다음 꼬리 질문 또는 빈 문자열" }

${FOLLOW_UP_RULES}`;
