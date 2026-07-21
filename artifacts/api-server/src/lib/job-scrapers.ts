/**
 * 잡코리아 · 사람인 채용공고 스크래퍼
 *
 * 두 사이트 모두 공개 검색 페이지에서 HTML을 파싱합니다.
 * - 잡코리아: https://www.jobkorea.co.kr/Search/?stext=…&tabType=recruit
 * - 사람인:   https://www.saramin.co.kr/zf_user/search/recruit?searchType=search&searchword=…
 */
import * as cheerio from "cheerio";
import { logger } from "./logger";

export interface ScrapedPosting {
  source: "jobkorea" | "saramin";
  name: string;           // 회사명
  title: string;          // 공고 제목
  jobPostingUrl: string;  // 공고 URL
  location?: string;      // 근무지
  careerText?: string;    // 경력 원문 (신입/경력/신입·경력)
  educationText?: string; // 학력 원문
  deadline?: string;      // 마감일
}

// ── 공통 fetch helper ─────────────────────────────────────────────────────────
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    logger.warn({ url, err: e }, "fetchHtml 실패");
    return null;
  }
}

// ── 잡코리아 스크래퍼 ─────────────────────────────────────────────────────────
export async function scrapeJobkorea(keyword: string, limit = 6): Promise<ScrapedPosting[]> {
  const url = `https://www.jobkorea.co.kr/Search/?stext=${encodeURIComponent(keyword)}&tabType=recruit`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: ScrapedPosting[] = [];

  // 잡코리아 공고 카드: .recruit-info, .post-list-content, .list-post
  const selectors = [
    ".recruit-info article",
    ".post-list-content .list-post",
    ".recruit-box-item",
  ];

  let items = $([]);
  for (const sel of selectors) {
    const found = $(sel);
    if (found.length > 0) { items = found; break; }
  }

  // fallback: 회사명이 있는 링크 패턴에서 추출
  if (items.length === 0) {
    // 구조가 바뀐 경우 대비 – 회사명/공고 블록 직접 탐색
    $("div[class*='post'], li[class*='post'], article").each((_, el) => {
      if (results.length >= limit) return false;
      const company = $(el).find("[class*='company'], [class*='corp']").first().text().trim();
      const titleEl = $(el).find("a[class*='title'], a[href*='/Recruit/']").first();
      const title = titleEl.text().trim();
      const href = titleEl.attr("href") ?? "";
      if (!company || !title) return;
      const postingUrl = href.startsWith("http") ? href : `https://www.jobkorea.co.kr${href}`;
      results.push({ source: "jobkorea", name: company, title, jobPostingUrl: postingUrl });
    });
    return results;
  }

  items.each((_, el) => {
    if (results.length >= limit) return false;
    const company = $(el).find(".corp-name, .company-name, [class*='corp'], [class*='company']").first().text().trim();
    const titleEl = $(el).find("a.title, a[class*='title'], h2 a, h3 a").first();
    const title = titleEl.text().trim();
    const href = titleEl.attr("href") ?? "";
    const location = $(el).find("[class*='local'], [class*='location'], [class*='work-place']").first().text().trim();
    const careerText = $(el).find("[class*='career'], [class*='exp']").first().text().trim();
    const educationText = $(el).find("[class*='edu']").first().text().trim();
    const deadline = $(el).find("[class*='date'], [class*='dead']").first().text().trim();

    if (!company || !title) return;
    const postingUrl = href.startsWith("http") ? href : `https://www.jobkorea.co.kr${href}`;
    results.push({ source: "jobkorea", name: company, title, jobPostingUrl: postingUrl, location, careerText, educationText, deadline });
  });

  return results;
}

// ── 사람인 스크래퍼 ───────────────────────────────────────────────────────────
export async function scrapeSaramin(keyword: string, limit = 6): Promise<ScrapedPosting[]> {
  const url =
    `https://www.saramin.co.kr/zf_user/search/recruit` +
    `?searchType=search&searchword=${encodeURIComponent(keyword)}&recruitSort=relation&recruitPage=1&recruitPageCount=10`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: ScrapedPosting[] = [];

  // 사람인 공고 카드 선택자
  $(".item_recruit, .list_item, article.item").each((_, el) => {
    if (results.length >= limit) return false;
    const company = $(el).find(".corp_name a, .company_nm a, h2.corp_name").first().text().trim();
    const titleEl = $(el).find(".job_tit a, .position a, a.str_tit").first();
    const title = titleEl.text().trim();
    const href = titleEl.attr("href") ?? "";
    const location = $(el).find(".work_place, .txt_work_area").first().text().trim();
    const careerText = $(el).find(".career, .txt_career, .exp").first().text().trim();
    const educationText = $(el).find(".edu, .txt_edu").first().text().trim();
    const deadline = $(el).find(".date, .txt_dead").first().text().trim();

    if (!company || !title) return;
    const postingUrl = href.startsWith("http")
      ? href
      : `https://www.saramin.co.kr${href}`;
    results.push({ source: "saramin", name: company, title, jobPostingUrl: postingUrl, location, careerText, educationText, deadline });
  });

  return results;
}

// ── 필터 → 검색어 변환 ────────────────────────────────────────────────────────
export function buildKeyword(opts: {
  careerLevel?: string[];
  recruitmentField?: string[];
}): string {
  const parts: string[] = [];

  // 모집분야 → 검색어
  const fieldMap: Record<string, string> = {
    개발: "개발자",
    기획: "서비스기획",
    디자인: "디자이너",
    영업: "영업",
    품질관리: "QA",
    테스터: "테스터",
    기타: "",
  };
  for (const f of opts.recruitmentField ?? []) {
    const mapped = fieldMap[f];
    if (mapped) parts.push(mapped);
  }

  // 경력 → 검색어 보완
  if (opts.careerLevel?.includes("신입")) parts.push("신입");
  else if (opts.careerLevel?.length) parts.push("경력");

  return parts.join(" ").trim() || "개발자";
}
