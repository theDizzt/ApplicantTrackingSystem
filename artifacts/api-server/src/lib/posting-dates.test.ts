import { describe, expect, it, vi } from "vitest";

// AI 클라이언트 모듈은 DB 연결을 불러오므로 날짜 규칙 테스트에서는 막아 둔다.
vi.mock("./openai", () => ({ getAI: vi.fn() }));

import { parseSaraminDeadline, seoulToday } from "./posting-dates";

// 2026-11-12 10:00 KST
const NOW = new Date("2026-11-12T01:00:00Z");

describe("seoulToday", () => {
  it("uses the Korean calendar day even when UTC is still the previous day", () => {
    // 2026-11-12 08:30 KST = 2026-11-11 23:30 UTC
    expect(seoulToday(new Date("2026-11-11T23:30:00Z")).toISOString().slice(0, 10)).toBe("2026-11-12");
  });
});

describe("parseSaraminDeadline", () => {
  it("reads month/day deadlines in the current year", () => {
    expect(parseSaraminDeadline("~ 11/30(일)", NOW)).toBe("2026-11-30");
    expect(parseSaraminDeadline("~12/5(금)", NOW)).toBe("2026-12-05");
  });

  it("rolls early-year deadlines into next year near year end", () => {
    expect(parseSaraminDeadline("~ 01/05(화)", NOW)).toBe("2027-01-05");
  });

  it("keeps a recently passed deadline in the current year", () => {
    expect(parseSaraminDeadline("~ 11/01(일)", NOW)).toBe("2026-11-01");
  });

  it("reads relative deadlines", () => {
    expect(parseSaraminDeadline("오늘마감", NOW)).toBe("2026-11-12");
    expect(parseSaraminDeadline("내일마감", NOW)).toBe("2026-11-13");
    expect(parseSaraminDeadline("D-3", NOW)).toBe("2026-11-15");
  });

  it("reads full dates", () => {
    expect(parseSaraminDeadline("~ 2026.12.31", NOW)).toBe("2026-12-31");
  });

  it("returns null when there is no date", () => {
    expect(parseSaraminDeadline("상시채용", NOW)).toBeNull();
    expect(parseSaraminDeadline("채용시", NOW)).toBeNull();
    expect(parseSaraminDeadline(undefined, NOW)).toBeNull();
    expect(parseSaraminDeadline("~ 2/30", NOW)).toBeNull();
  });
});
