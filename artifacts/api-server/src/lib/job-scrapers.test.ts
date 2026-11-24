import { afterEach, describe, expect, it, vi } from "vitest";
import { keepScrapedPostings, normalizeRegions, scrapeSaramin, SARAMIN_REGION_CODES } from "./job-scrapers";

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

describe("keepScrapedPostings", () => {
  const scraped = [
    { source: "saramin" as const, name: "실제회사", title: "백엔드 개발자", jobPostingUrl: "https://www.saramin.co.kr/a" },
  ];

  it("drops postings whose URL was not scraped (AI-invented)", () => {
    const result = keepScrapedPostings(
      [
        { name: "실제회사", jobPostingUrl: "https://www.saramin.co.kr/a" },
        { name: "지어낸회사", jobPostingUrl: "https://www.jobkorea.co.kr/Search/?stext=개발자" },
        { name: "URL 없음" },
      ],
      scraped,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.jobPostingUrl).toBe("https://www.saramin.co.kr/a");
  });

  it("restores the scraped company name and removes duplicates", () => {
    const result = keepScrapedPostings(
      [
        { name: "바뀐이름", jobPostingUrl: "https://www.saramin.co.kr/a" },
        { name: "실제회사", jobPostingUrl: "https://www.saramin.co.kr/a" },
      ],
      scraped,
    );
    expect(result).toEqual([{ name: "실제회사", jobPostingUrl: "https://www.saramin.co.kr/a" }]);
  });

  it("returns an empty list when the AI response is not an array", () => {
    expect(keepScrapedPostings({}, scraped)).toEqual([]);
  });
});
