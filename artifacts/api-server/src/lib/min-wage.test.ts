import { describe, expect, it, vi } from "vitest";

vi.mock("./openai", () => ({ getSetting: vi.fn() }));

import { annualMinWageWan, koreaYear, minWageBasis, parseMinWageOverrides, resolveMinWage } from "./min-wage";

describe("koreaYear", () => {
  it("switches to the new year at midnight Korea time even on a UTC server", () => {
    expect(koreaYear(new Date("2026-12-31T14:59:59.000Z"))).toBe(2026);
    expect(koreaYear(new Date("2026-12-31T15:00:00.000Z"))).toBe(2027);
  });
});

describe("resolveMinWage", () => {
  it("uses the built-in value for the current year", () => {
    const wage = resolveMinWage(new Date("2026-06-01T00:00:00.000Z"));
    expect(wage).toEqual({ year: 2026, requestedYear: 2026, hourly: 10_320, annualWan: 2588, source: "table" });
  });

  it("prefers an admin override for the same year", () => {
    expect(resolveMinWage(new Date("2026-06-01T00:00:00.000Z"), { 2026: 10_400 })).toEqual(
      expect.objectContaining({ year: 2026, hourly: 10_400, source: "override" }),
    );
  });

  it("applies a newly announced year from the override on January 1st", () => {
    const wage = resolveMinWage(new Date("2027-01-01T00:00:00.000Z"), { 2027: 10_500 });
    expect(wage).toEqual(expect.objectContaining({ year: 2027, hourly: 10_500, source: "override" }));
  });

  it("falls back to the latest earlier year when the year is not registered", () => {
    const wage = resolveMinWage(new Date("2028-03-01T00:00:00.000Z"));
    expect(wage).toEqual(expect.objectContaining({ year: 2026, requestedYear: 2028, hourly: 10_320, source: "fallback" }));
    expect(minWageBasis(wage)).toBe("2026 최저시급(10,320원/시간) 및 업계 평균 기준 산정");
  });
});

describe("parseMinWageOverrides", () => {
  it("keeps only valid integer entries", () => {
    expect(parseMinWageOverrides(JSON.stringify({ 2027: 10_500, 2028: 10.5, abc: 10_000, 1990: 5_000 }))).toEqual({ 2027: 10_500 });
    expect(parseMinWageOverrides("not json")).toEqual({});
    expect(parseMinWageOverrides(null)).toEqual({});
  });
});

describe("annualMinWageWan", () => {
  it("uses 209 hours a month", () => {
    expect(annualMinWageWan(10_030)).toBe(2516);
  });
});
