import { describe, expect, it } from "vitest";
import { isQuoteInSource, sanitizeRequirementChecks, sanitizeScoreFactors } from "./score-evidence";

const SOURCE = "<p>React와 TypeScript로 사내 대시보드를 개발했습니다.</p><p>팀원 4명과 &nbsp;협업하여 배포 주기를 2주에서 3일로 단축.</p>";

describe("isQuoteInSource", () => {
  it("matches quotes regardless of markup, spacing and punctuation", () => {
    expect(isQuoteInSource("React와 TypeScript로 사내 대시보드를 개발", "react와typescript로사내대시보드를개발했습니다")).toBe(true);
  });

  it("rejects quotes that are too short to be meaningful", () => {
    expect(isQuoteInSource("개발", "개발했습니다")).toBe(false);
  });
});

describe("sanitizeScoreFactors", () => {
  it("keeps valid factors, verifies quotes and drops disallowed areas", () => {
    const result = sanitizeScoreFactors(
      [
        { area: "technical", effect: "plus", reason: "React 실무 경험", quote: "React와 TypeScript로 사내 대시보드를 개발했습니다." },
        { area: "technical", effect: "minus", reason: "테스트 경험 부재", quote: "Jest로 테스트 커버리지 90% 달성" },
        { area: "personality", effect: "plus", reason: "다른 호출 영역", quote: "" },
        { area: "language", effect: "bad", reason: "잘못된 effect" },
        { area: "language", effect: "minus", reason: "" },
      ],
      ["technical", "language"],
      SOURCE,
    );
    expect(result).toEqual([
      { area: "technical", effect: "plus", reason: "React 실무 경험", quote: "React와 TypeScript로 사내 대시보드를 개발했습니다.", quoteVerified: true },
      { area: "technical", effect: "minus", reason: "테스트 경험 부재", quote: "Jest로 테스트 커버리지 90% 달성", quoteVerified: false },
    ]);
  });

  it("caps the number of factors per area", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ area: "jobMatch", effect: "plus", reason: `이유 ${i}` }));
    expect(sanitizeScoreFactors(many, ["jobMatch"], SOURCE)).toHaveLength(5);
  });

  it("returns an empty list for non-array input", () => {
    expect(sanitizeScoreFactors(undefined, ["jobMatch"], SOURCE)).toEqual([]);
  });
});

describe("sanitizeRequirementChecks", () => {
  it("normalizes kind, clears evidence for unmet items and verifies evidence", () => {
    const result = sanitizeRequirementChecks(
      [
        { requirement: "협업 경험", kind: "required", status: "met", evidence: "팀원 4명과 협업하여 배포 주기를", comment: "충족" },
        { requirement: "AWS 운영", kind: "nice", status: "unmet", evidence: "AWS", comment: "근거 없음" },
        { requirement: "", status: "met" },
        { requirement: "영어", status: "unknown" },
      ],
      SOURCE,
    );
    expect(result).toEqual([
      { requirement: "협업 경험", kind: "required", status: "met", evidence: "팀원 4명과 협업하여 배포 주기를", evidenceVerified: true, comment: "충족", source: "posting" },
      { requirement: "AWS 운영", kind: "required", status: "unmet", evidence: "", evidenceVerified: false, comment: "근거 없음", source: "posting" },
    ]);
  });

  it("keeps the inferred source reported by the model", () => {
    const result = sanitizeRequirementChecks(
      [
        { requirement: "Java", status: "unmet", source: "posting" },
        { requirement: "Git 협업", status: "unmet", source: "inferred" },
        { requirement: "Spring", status: "unmet", source: "something-else" },
      ],
      SOURCE,
    );
    expect(result.map((r) => r.source)).toEqual(["posting", "inferred", "posting"]);
  });

  it("marks every requirement as inferred when the company has no posting text", () => {
    const result = sanitizeRequirementChecks(
      [
        { requirement: "Java", status: "unmet", source: "posting" },
        { requirement: "Git 협업", status: "unmet" },
      ],
      SOURCE,
      false,
    );
    expect(result.map((r) => r.source)).toEqual(["inferred", "inferred"]);
  });
});
