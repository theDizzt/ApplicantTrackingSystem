import { describe, expect, it } from "vitest";
import {
  buildChain,
  canAddFollowUp,
  cleanFollowUpQuestion,
  descendantIds,
  extractWeaknesses,
  FOLLOW_UP_ANSWER_SYSTEM,
  FOLLOW_UP_RULES,
  followUpTone,
  LIVE_ANSWER_SYSTEM,
  QUESTION_LENGTH_RULE,
  parseDifficulty,
  questionStyleInstruction,
  toneInstruction,
  truncateForPrompt,
  weaknessInstruction,
} from "./interview-followups";

describe("extractWeaknesses", () => {
  it("prefers rejection report reasons", () => {
    const rich = JSON.stringify({
      rejectionReport: { reasons: [{ title: "AWS 미충족", detail: "운영 경험 없음" }, { title: "" }] },
      scoreEvidence: { requirements: [{ requirement: "Java", kind: "required", status: "unmet" }] },
    });
    expect(extractWeaknesses(rich)).toEqual([{ title: "AWS 미충족", detail: "운영 경험 없음" }]);
  });

  it("falls back to unmet required requirements for older analyses", () => {
    const rich = JSON.stringify({
      scoreEvidence: { requirements: [
        { requirement: "Java", kind: "required", status: "unmet", comment: "근거 없음" },
        { requirement: "영어", kind: "preferred", status: "unmet" },
        { requirement: "Git", kind: "required", status: "met" },
      ] },
    });
    expect(extractWeaknesses(rich)).toEqual([{ title: "Java 미충족", detail: "근거 없음" }]);
  });

  it("handles missing or broken data", () => {
    expect(extractWeaknesses(null)).toEqual([]);
    expect(extractWeaknesses("{not json")).toEqual([]);
    expect(weaknessInstruction([])).toBe("");
  });
});

describe("cleanFollowUpQuestion", () => {
  it("normalizes whitespace and rejects empty or tiny questions", () => {
    expect(cleanFollowUpQuestion("  그 프로젝트에서\n 맡은 역할은?  ")).toBe("그 프로젝트에서 맡은 역할은?");
    expect(cleanFollowUpQuestion("")).toBeNull();
    expect(cleanFollowUpQuestion("네?")).toBeNull();
    expect(cleanFollowUpQuestion(42)).toBeNull();
  });
});

describe("question chains", () => {
  const qs = [
    { id: 1, question: "Q1", answer: "A1", parentQuestionId: null },
    { id: 2, question: "F1", answer: "A2", parentQuestionId: 1 },
    { id: 3, question: "F2", answer: null, parentQuestionId: 2 },
    { id: 4, question: "Q2", answer: "A4", parentQuestionId: null },
  ];

  it("builds the chain from the base question to the target", () => {
    expect(buildChain(qs, 3).map((q) => q.id)).toEqual([1, 2, 3]);
  });

  it("stops on cycles instead of looping forever", () => {
    const cyclic = [{ id: 1, question: "a", answer: null, parentQuestionId: 2 }, { id: 2, question: "b", answer: null, parentQuestionId: 1 }];
    expect(buildChain(cyclic, 1).map((q) => q.id)).toEqual([2, 1]);
  });

  it("finds every deeper follow-up of a question", () => {
    expect(descendantIds(qs, 1)).toEqual([2, 3]);
    expect(descendantIds(qs, 4)).toEqual([]);
  });
});

describe("difficulty rules", () => {
  it("picks the follow-up tone from the answer score per difficulty", () => {
    expect(followUpTone(40, "easy")).toBe("neutral");
    expect(followUpTone(75, "easy")).toBe("positive");
    expect(followUpTone(59, "normal")).toBe("pressure");
    expect(followUpTone(70, "normal")).toBe("neutral");
    expect(followUpTone(80, "normal")).toBe("positive");
    expect(followUpTone(79, "hard")).toBe("pressure");
    expect(followUpTone(90, "hard")).toBe("positive");
  });

  it("never asks the AI for pressure follow-ups on easy and always keeps the guardrail", () => {
    expect(toneInstruction("easy")).not.toContain("압박형");
    expect(toneInstruction("hard")).toContain("점수 80점 미만: 압박형");
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      expect(toneInstruction(difficulty)).toContain("인신공격");
      expect(questionStyleInstruction(difficulty)).toContain("사적인 질문");
    }
    expect(questionStyleInstruction("hard")).toContain("압박 질문");
  });

  it("asks for short single-topic questions in base and follow-up prompts", () => {
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      expect(questionStyleInstruction(difficulty)).toContain(QUESTION_LENGTH_RULE);
    }
    expect(FOLLOW_UP_RULES).toContain(QUESTION_LENGTH_RULE);
    expect(LIVE_ANSWER_SYSTEM).toContain(QUESTION_LENGTH_RULE);
    expect(FOLLOW_UP_ANSWER_SYSTEM).toContain(QUESTION_LENGTH_RULE);
  });

  it("limits follow-ups by depth and by the session-wide count", () => {
    expect(canAddFollowUp(0, 0, "easy")).toBe(true);
    expect(canAddFollowUp(1, 0, "easy")).toBe(false);
    expect(canAddFollowUp(1, 4, "normal")).toBe(true);
    expect(canAddFollowUp(1, 5, "normal")).toBe(false);
    expect(canAddFollowUp(2, 0, "hard")).toBe(false);
  });

  it("parses unknown difficulty as normal", () => {
    expect(parseDifficulty("hard")).toBe("hard");
    expect(parseDifficulty(undefined)).toBe("normal");
    expect(parseDifficulty("extreme")).toBe("normal");
  });

  it("truncates long prompt text", () => {
    expect(truncateForPrompt("가 나\n다", 10)).toBe("가 나 다");
    expect(truncateForPrompt("가".repeat(20), 5)).toBe("가가가가가…(이하 생략)");
    expect(truncateForPrompt(null, 5)).toBeNull();
  });
});
