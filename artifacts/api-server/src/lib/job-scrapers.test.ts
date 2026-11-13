import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeRegions, scrapeSaramin, SARAMIN_REGION_CODES } from "./job-scrapers";

describe("normalizeRegions", () => {
  it("keeps only known regions, without duplicates", () => {
    expect(normalizeRegions(["서울", "경기", "서울", "화성", 3, null])).toEqual(["서울", "경기"]);
  });

  it("returns an empty list for anything that is not an array", () => {
    expect(normalizeRegions(undefined)).toEqual([]);
    expect(normalizeRegions("서울")).toEqual([]);
  });

  it("covers all 17 metropolitan areas with distinct codes", () => {
    const codes = Object.values(SARAMIN_REGION_CODES);
    expect(codes).toHaveLength(17);
    expect(new Set(codes).size).toBe(17);
  });
});

describe("scrapeSaramin region filter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("adds the region codes to the Saramin search URL", async () => {
    const fetchMock = vi.fn(async () => new Response("<html></html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await scrapeSaramin("개발자 신입", 8, ["서울", "제주", "없는지역"]);
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain(`loc_mcd=${encodeURIComponent("101000,116000")}`);
  });

  it("searches nationwide when no region is given", async () => {
    const fetchMock = vi.fn(async () => new Response("<html></html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await scrapeSaramin("개발자 신입", 8);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).not.toContain("loc_mcd");
  });
});
