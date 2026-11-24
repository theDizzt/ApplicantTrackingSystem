import { describe, expect, it } from "vitest";
import { buildInterviewPrepInput, MAX_PREP_POINTS, sanitizeInterviewPrep } from "./interview-prep";

const SOURCE = "<p>주요 역할: PL, 개발</p><p>2022.12 ~ 현재 (약 3개월 소요)</p>";

function point(overrides: Record<string, unknown> = {}) {
  return {
    title: "PL 역할과 개발 역할의 범위가 모호함",
    quote: "주요 역할: PL, 개발",
    impression: "어디까지 직접 했는지 알기 어렵다는 인상을 줄 수 있습니다.",
    rewrite: "PL 업무와 개발 업무를 나눠 적으세요.",
    interviewTip: "상황-행동-결과 순서로 설명하세요.",
    ...overrides,
  };
}

describe("sanitizeInterviewPrep", () => {
  it("marks quotes found in the resume as verified, ignoring HTML and spacing", () => {
    const prep = sanitizeInterviewPrep({ points: [point({ quote: "주요 역할 : PL,개발" })] }, SOURCE);
    expect(prep.points).toHaveLength(1);
    expect(prep.points[0]!.quoteVerified).toBe(true);
  });

  it("keeps a point whose quote is not in the resume but marks it unverified and sorts it last", () => {
    const prep = sanitizeInterviewPrep(
      { points: [point({ title: "지어낸 인용", quote: "Kubernetes 클러스터 운영" }), point()] },
      SOURCE,
    );
    expect(prep.points.map((p) => [p.title, p.quoteVerified])).toEqual([
      ["PL 역할과 개발 역할의 범위가 모호함", true],
      ["지어낸 인용", false],
    ]);
  });

  it("drops incomplete or duplicate points and caps the count", () => {
    const many = Array.from({ length: 8 }, (_, i) => point({ title: `보완점 ${i}` }));
    const prep = sanitizeInterviewPrep(
      { points: [point({ rewrite: "" }), point(), point(), ...many] },
      SOURCE,
    );
    expect(prep.points).toHaveLength(MAX_PREP_POINTS);
    expect(new Set(prep.points.map((p) => p.title)).size).toBe(MAX_PREP_POINTS);
  });

  it("returns no points for a malformed response", () => {
    expect(sanitizeInterviewPrep({ points: "없음" }, SOURCE).points).toEqual([]);
    expect(sanitizeInterviewPrep({}, SOURCE).points).toEqual([]);
  });
});

describe("buildInterviewPrepInput", () => {
  it("sends plain text, not HTML, and includes minus factors as reference", () => {
    const input = buildInterviewPrepInput({
      resumeContent: SOURCE,
      coverLetter: "",
      companyText: "회사명: 테스트",
      minusFactors: [{ area: "jobMatch", effect: "minus", reason: "역할이 모호합니다.", quote: "PL, 개발", quoteVerified: true }],
    });
    expect(input).not.toContain("<p>");
    expect(input).toContain("주요 역할: PL, 개발");
    expect(input).not.toContain("[자기소개서]");
    expect(input).toContain("역할이 모호합니다.");
  });

  it("truncates a very long resume", () => {
    const input = buildInterviewPrepInput({
      resumeContent: "가".repeat(20000),
      coverLetter: null,
      companyText: "회사명: 테스트",
      minusFactors: [],
    });
    expect(input.length).toBeLessThan(7000);
  });
});
