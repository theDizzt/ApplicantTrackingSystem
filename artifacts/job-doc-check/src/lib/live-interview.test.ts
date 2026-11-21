import { describe, expect, it } from "vitest"
import { liveProgress, nextLiveQuestion, splitForSpeech } from "./live-interview"

const q = (id: number, order: number, answer: string | null, parentQuestionId: number | null = null) =>
  ({ id, question: `질문 ${id}`, order, answer, parentQuestionId })

describe("nextLiveQuestion", () => {
  it("starts with the first base question by order", () => {
    expect(nextLiveQuestion([q(2, 2, null), q(1, 1, null)])?.id).toBe(1)
  })

  it("asks an unanswered follow-up before moving to the next base question", () => {
    const questions = [q(1, 1, "답"), q(2, 2, null), q(3, 1, "답", 1), q(4, 1, null, 3)]
    expect(nextLiveQuestion(questions)?.id).toBe(4)
  })

  it("moves on when the follow-up chain is fully answered", () => {
    const questions = [q(1, 1, "답"), q(2, 2, null), q(3, 1, "답", 1)]
    expect(nextLiveQuestion(questions)?.id).toBe(2)
  })

  it("returns null when everything is answered and survives a cycle", () => {
    expect(nextLiveQuestion([q(1, 1, "답"), q(2, 1, "답", 1)])).toBeNull()
    expect(nextLiveQuestion([q(1, 1, "답", null), { ...q(2, 1, "답", 1) }, { ...q(1, 1, "답", 2), id: 1 }])).toBeNull()
  })
})

describe("liveProgress", () => {
  it("counts only base questions", () => {
    expect(liveProgress([q(1, 1, "답"), q(2, 2, null), q(3, 1, null, 1)])).toEqual({ answered: 1, total: 2 })
  })
})

describe("splitForSpeech", () => {
  it("splits sentences and drops empty parts", () => {
    expect(splitForSpeech("좋습니다.  그럼 역할은 무엇이었나요? 구체적으로\n말해 주세요.")).toEqual([
      "좋습니다.",
      "그럼 역할은 무엇이었나요?",
      "구체적으로 말해 주세요.",
    ])
  })
})
