import { describe, expect, it } from "vitest";
import { buildChain, cleanFollowUpQuestion, descendantIds, extractWeaknesses, weaknessInstruction } from "./interview-followups";

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
