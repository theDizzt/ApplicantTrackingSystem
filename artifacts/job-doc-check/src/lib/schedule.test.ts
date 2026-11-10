import { describe, expect, it } from "vitest"
import { dDayLabel, daysUntil, monthGrid, scheduleEvents, upcomingEvents } from "./schedule"

const companies = [
  { id: 1, name: "토스", applicationStatus: "지원 완료", deadlineDate: "2026-11-12", announcementDate: "2026-11-20", interviewDate: null },
  { id: 2, name: "카카오", applicationStatus: "불합격", deadlineDate: "2026-11-11", announcementDate: "2026-11-13", interviewDate: "2026-11-14" },
  { id: 3, name: "네이버", applicationStatus: null, deadlineDate: "잘못된 값", announcementDate: null, interviewDate: null },
]

describe("scheduleEvents", () => {
  it("turns saved dates into sorted events and skips invalid ones", () => {
    const events = scheduleEvents(companies)
    expect(events.map((e) => `${e.date} ${e.companyName} ${e.kind}`)).toEqual([
      "2026-11-11 카카오 deadline",
      "2026-11-12 토스 deadline",
      "2026-11-13 카카오 announcement",
      "2026-11-14 카카오 interview",
      "2026-11-20 토스 announcement",
    ])
  })
})

describe("D-day", () => {
  it("counts calendar days across month ends", () => {
    expect(daysUntil("2026-12-01", "2026-11-30")).toBe(1)
    expect(dDayLabel("2026-11-11", "2026-11-11")).toBe("D-DAY")
    expect(dDayLabel("2026-11-14", "2026-11-11")).toBe("D-3")
    expect(dDayLabel("2026-11-09", "2026-11-11")).toBe("D+2")
  })
})

describe("upcomingEvents", () => {
  it("keeps the next few days and drops deadlines of finished applications", () => {
    const events = upcomingEvents(scheduleEvents(companies), "2026-11-11", 3)
    expect(events.map((e) => e.key)).toEqual(["1:deadline:2026-11-12", "2:announcement:2026-11-13"])
  })
})

describe("monthGrid", () => {
  it("starts on Sunday and covers the whole month", () => {
    const weeks = monthGrid(2026, 10) // 2026년 11월: 1일이 일요일
    expect(weeks[0]![0]).toEqual({ date: "2026-11-01", inMonth: true })
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(30)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })
})
