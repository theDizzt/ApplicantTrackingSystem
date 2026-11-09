// 꼬리 질문 면접: 서류 심사 약점을 면접 질문으로 연결하고, 답변에 따라 꼬리 질문을 이어간다.

/** 기본 질문(depth 0) 아래로 이어지는 꼬리 질문의 최대 단계 */
export const MAX_FOLLOW_UP_DEPTH = 2;
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

export const FOLLOW_UP_ANSWER_SYSTEM = `당신은 채용 면접관입니다. 아래 지원 회사 정보와 지금까지의 질문·답변 흐름을 보고, 마지막 꼬리 질문에 대한 답변을 평가하세요.
0~100 정수 점수와 한국어 피드백 2~3문장(잘한 점과 더 보완할 점)을 주세요. JSON만 반환하세요:
{ "score": 0, "feedback": "피드백", "followUp": "다음 꼬리 질문 또는 빈 문자열" }

${FOLLOW_UP_RULES}`;
