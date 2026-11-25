import { describe, expect, it } from "vitest";
import {
  buildGrowthPlanInput,
  buildGrowthPlanSystem,
  MAX_PLAN_ITEMS,
  parseLearnerStage,
  parseWeeklyHours,
  sanitizeGrowthPlan,
} from "./growth-plan";

const SOURCE = "<p>RPA 자동화로 월말 정산 업무를 처리했습니다.</p>";
const NOW = new Date("2026-11-24T00:00:00Z");

function weeks(n: number) {
  return Array.from({ length: n }, (_, i) => ({ week: i + 1, task: `${i + 1}주차 할 일`, deliverable: `${i + 1}주차 결과물` }));
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    title: "RPA 자동화 성과를 업무 사례로 정리",
    quote: "RPA 자동화로 월말 정산 업무를 처리했습니다.",
    whyHelpful: "공고의 업무 자동화 요건과 바로 연결됩니다.",
    totalWeeks: 4,
    hoursPerWeek: 4,
    weeklyTasks: weeks(4),
    completionCriteria: "자동화 전후 차이를 3분 안에 설명할 수 있으면 완료입니다.",
    ...overrides,
  };
}

describe("parse helpers", () => {
  it("accepts only known learner stages", () => {
    expect(parseLearnerStage("senior")).toBe("senior");
    expect(parseLearnerStage("professor")).toBeNull();
    expect(parseLearnerStage(undefined)).toBeNull();
  });

  it("defaults weekly hours and rejects out-of-range values", () => {
    expect(parseWeeklyHours(undefined)).toBe(6);
    expect(parseWeeklyHours("10")).toBe(10);
    expect(parseWeeklyHours(1)).toBeNull();
    expect(parseWeeklyHours(21)).toBeNull();
    expect(parseWeeklyHours(3.5)).toBeNull();
  });
});

describe("sanitizeGrowthPlan", () => {
  const opts = { stage: "senior" as const, weeklyHours: 6, now: NOW };

  it("keeps a valid plan, verifies the quote and records the learner settings", () => {
    const plan = sanitizeGrowthPlan({ items: [item()] }, SOURCE, opts);
    expect(plan).toMatchObject({ stage: "senior", weeklyHours: 6, createdAt: NOW.toISOString() });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({ quoteVerified: true, totalWeeks: 4, hoursPerWeek: 4 });
  });

  it("caps hours per week at the learner's available hours", () => {
    const plan = sanitizeGrowthPlan({ items: [item({ hoursPerWeek: 15 })] }, SOURCE, opts);
    expect(plan.items[0]!.hoursPerWeek).toBe(6);
  });

  it("renumbers weeks with gaps, drops duplicates and out-of-range weeks, and sets totalWeeks from the tasks", () => {
    const tasks = [
      { week: 5, task: "다섯째", deliverable: "" },
      { week: 1, task: "첫째", deliverable: "" },
      { week: 1, task: "중복", deliverable: "" },
      { week: 2, task: "둘째", deliverable: "" },
      { week: 4, task: "넷째", deliverable: "" },
      { week: 12, task: "범위 밖", deliverable: "" },
      { week: 6, task: "", deliverable: "" },
    ];
    const plan = sanitizeGrowthPlan({ items: [item({ totalWeeks: 8, weeklyTasks: tasks })] }, SOURCE, opts);
    expect(plan.items[0]!.totalWeeks).toBe(4);
    expect(plan.items[0]!.weeklyTasks.map((t) => [t.week, t.task])).toEqual([[1, "첫째"], [2, "둘째"], [3, "넷째"], [4, "다섯째"]]);
  });

  it("drops plans shorter than 4 weeks, incomplete or duplicate plans, and caps the count", () => {
    const plan = sanitizeGrowthPlan({
      items: [
        item({ title: "3주짜리", weeklyTasks: weeks(3) }),
        item({ title: "완료 기준 없음", completionCriteria: "" }),
        item(),
        item(),
        ...Array.from({ length: 5 }, (_, i) => item({ title: `계획 ${i}` })),
      ],
    }, SOURCE, opts);
    expect(plan.items).toHaveLength(MAX_PLAN_ITEMS);
    expect(plan.items.map((p) => p.title)).not.toContain("3주짜리");
    expect(plan.items.map((p) => p.title)).not.toContain("완료 기준 없음");
  });

  it("marks quotes that are not in the resume as unverified", () => {
    const plan = sanitizeGrowthPlan({ items: [item({ quote: "Kubernetes 운영 경험" })] }, SOURCE, opts);
    expect(plan.items[0]!.quoteVerified).toBe(false);
  });

  it("returns an empty plan for malformed responses", () => {
    expect(sanitizeGrowthPlan({ items: "없음" }, SOURCE, opts).items).toEqual([]);
  });
});

describe("prompt building", () => {
  it("adapts the system prompt to the learner stage and weekly hours", () => {
    const senior = buildGrowthPlanSystem("senior", 6);
    expect(senior).toContain("4학년·졸업 예정자");
    expect(senior).toContain("6시간");
    expect(buildGrowthPlanSystem("student", 10)).toContain("1~3학년 재학생");
  });

  it("sends gaps from the review: rejection reasons, unmet or partial requirements, prep points", () => {
    const input = buildGrowthPlanInput({
      resumeContent: SOURCE,
      coverLetter: null,
      companyText: "회사명: 테스트",
      rich: {
        rejectionReport: { reasons: [{ title: "API 연계 경험 부족", detail: "운영 연계 근거가 없습니다." }] },
        scoreEvidence: { requirements: [
          { requirement: "REST API", kind: "required", status: "unmet", comment: "" },
          { requirement: "Git", kind: "required", status: "met" },
          { requirement: "영어", kind: "preferred", status: "partial" },
        ] },
        interviewPrep: { points: [{ title: "역할 범위가 모호함" }] },
      },
    });
    expect(input).not.toContain("<p>");
    expect(input).toContain("API 연계 경험 부족 — 운영 연계 근거가 없습니다.");
    expect(input).toContain("(필수) REST API: 미충족");
    expect(input).toContain("(우대) 영어: 부분 충족");
    expect(input).not.toContain("Git");
    expect(input).toContain("- 역할 범위가 모호함");
  });
});
