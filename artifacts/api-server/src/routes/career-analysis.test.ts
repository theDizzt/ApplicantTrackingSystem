import { describe, expect, it } from "vitest";
import { sanitizeCareer } from "./career-analysis";

describe("sanitizeCareer", () => {
  it("does not invent an NCS level and normalizes each job salary range", () => {
    const result = sanitizeCareer({
      strengths: [],
      ncsCategories: [
        { major: "20. 정보통신", middle: "정보기술", fitReason: "적합" },
        { major: "01. 사업관리", middle: "프로젝트관리", level: 9, fitReason: "적합" },
        { major: "02. 경영", middle: "사무", level: 5, fitReason: "적합" },
      ],
      recommendedJobs: [{
        job: "데이터 과학자",
        ncsCategory: "정보기술",
        fitScore: 90,
        reason: "적합",
        outlook: "밝음",
        outlookScore: 80,
        salaryGuide: { min: 7000, max: 4500, basis: "시장 기준" },
      }],
      papers: [{
        title: "논문",
        authors: ["가", "나"],
        applicantAuthorOrder: 1,
        venue: "학회",
        abstract: "초록",
        issues: [],
      }],
    });

    expect(result.ncsCategories.map((item) => item.level)).toEqual([0, 0, 5]);
    expect(result.recommendedJobs[0].salaryGuide).toEqual({ min: 4500, max: 7000, basis: "시장 기준" });
    expect(result.papers[0]).toEqual(expect.objectContaining({
      title: "논문",
      authors: ["가", "나"],
      verification: expect.objectContaining({ status: "unverified" }),
    }));
  });
});