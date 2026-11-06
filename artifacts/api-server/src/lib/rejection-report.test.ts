import { describe, expect, it } from "vitest";
import {
  buildRejectionReportInput,
  buildRuleBasedReport,
  sanitizeRejectionReport,
  type RejectionSignals,
} from "./rejection-report";

function signals(overrides: Partial<RejectionSignals> = {}): RejectionSignals {
  return {
    overallScore: 58,
    passed: false,
    scores: { jobMatch: 45, technical: 72, language: 80 },
    requirements: [
      { requirement: "AWS 운영 경험", kind: "required", status: "unmet", evidence: "", evidenceVerified: false, comment: "클라우드 운영 경험이 없습니다." },
      { requirement: "React 개발", kind: "required", status: "met", evidence: "React로 개발", evidenceVerified: true, comment: "" },
      { requirement: "영어 회화", kind: "preferred", status: "partial", evidence: "", evidenceVerified: false, comment: "" },
    ],
    factors: [
      { area: "jobMatch", effect: "minus", reason: "직무 경험이 짧습니다.", quote: "", quoteVerified: false },
      { area: "technical", effect: "plus", reason: "React 실무 프로젝트를 주도했습니다.", quote: "React로 개발", quoteVerified: true },
    ],
    documentChecks: { photoMissing: false, coverLetterTooShort: true, coverLetterLength: 120 },
    jobSimilarity: { score: 40, threshold: 60 },
    graduationGap: { isLongGap: false, gapType: "", gapYears: 0 },
    ...overrides,
  };
}

describe("buildRuleBasedReport", () => {
  it("ranks unmet required requirements and low scores first, max 3 reasons", () => {
    const report = buildRuleBasedReport(signals());
    expect(report.source).toBe("rules");
    expect(report.reasons).toHaveLength(3);
    expect(report.reasons.map((r) => r.severity)).toEqual(["high", "high", "medium"]);
    expect(report.reasons[0]!.title).toBe("AWS 운영 경험 미충족");
    expect(report.reasons[1]!.title).toBe("직무 적합도 낮음 (45점)");
    expect(report.reasons[1]!.detail).toBe("직무 경험이 짧습니다.");
    expect(report.summary).toContain("AWS 운영 경험 미충족");
  });

  it("builds appeal points from met requirements and plus factors", () => {
    const report = buildRuleBasedReport(signals());
    expect(report.appealPoints.map((a) => a.strength)).toEqual(["React 개발", "기술 역량"]);
  });

  it("reports no risk when nothing is wrong", () => {
    const report = buildRuleBasedReport(signals({
      passed: true,
      scores: { jobMatch: 85 },
      requirements: [],
      factors: [],
      documentChecks: { photoMissing: false, coverLetterTooShort: false, coverLetterLength: 900 },
      jobSimilarity: { score: null, threshold: 60 },
    }));
    expect(report.reasons).toEqual([]);
    expect(report.summary).toContain("뚜렷한 탈락 요인이 발견되지 않았습니다");
  });
});

describe("sanitizeRejectionReport", () => {
  it("sorts by severity, drops incomplete items and caps counts", () => {
    const report = sanitizeRejectionReport({
      summary: " 요약 ",
      reasons: [
        { title: "사소함", severity: "low", detail: "d", fix: "f" },
        { title: "치명적", severity: "high", detail: "d", fix: "f" },
        { title: "", severity: "high", detail: "d" },
        { title: "보통", severity: "weird", detail: "d", fix: "f" },
        { title: "넷째", severity: "high", detail: "d", fix: "f" },
      ],
      appealPoints: [{ strength: "협업", howToAppeal: "사례 강조" }, { strength: "누락" }],
    });
    expect(report?.summary).toBe("요약");
    expect(report?.reasons.map((r) => r.title)).toEqual(["치명적", "넷째", "보통"]);
    expect(report?.appealPoints).toEqual([{ strength: "협업", howToAppeal: "사례 강조" }]);
    expect(report?.source).toBe("ai");
  });

  it("returns null when the AI gave no usable reasons", () => {
    expect(sanitizeRejectionReport({ reasons: [] })).toBeNull();
    expect(sanitizeRejectionReport({})).toBeNull();
  });
});

describe("buildRejectionReportInput", () => {
  it("summarizes scores, requirements, factors and document checks", () => {
    const input = buildRejectionReportInput(signals(), "회사명: 테스트");
    expect(input).toContain("[종합] 58점 · 불합격권");
    expect(input).toContain("직무 적합도 45");
    expect(input).toContain("- (필수) AWS 운영 경험: 미충족 — 클라우드 운영 경험이 없습니다.");
    expect(input).toContain("[감점 요인]");
    expect(input).toContain("자기소개서 분량 부족(공백 제외 120자)");
    expect(input).toContain("문장 유사도 낮음(40점)");
  });
});
