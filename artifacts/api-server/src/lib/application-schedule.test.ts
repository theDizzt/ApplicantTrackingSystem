import { describe, expect, it } from "vitest";
import { isCalendarDate, parseScheduleInput } from "./application-schedule";

describe("isCalendarDate", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isCalendarDate("2026-11-30")).toBe(true);
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("2026-1-5")).toBe(false);
  });
});

describe("parseScheduleInput", () => {
  it("keeps omitted fields untouched and clears empty ones", () => {
    const result = parseScheduleInput({ deadlineDate: "2026-12-01", announcementDate: "", applicationStatus: "지원 완료" });
    expect(result).toEqual({ ok: true, value: { deadlineDate: "2026-12-01", announcementDate: null, applicationStatus: "지원 완료" } });
  });

  it("rejects malformed dates and unknown statuses", () => {
    expect(parseScheduleInput({ interviewDate: "12/01" })).toMatchObject({ ok: false, error: expect.stringContaining("면접일") });
    expect(parseScheduleInput({ applicationStatus: "합격?" })).toMatchObject({ ok: false });
  });
});
