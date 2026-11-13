/**
 * 사람인 채용공고 스크래퍼 + 잡코리아 검색 링크 생성
 *
 * ● 사람인: 공개 검색 페이지 HTML 파싱 (서버 fetch 가능)
 * ● 잡코리아: CSR React 앱이라 서버 fetch로 데이터 추출 불가
 *             → 필터에 맞는 검색 결과 URL을 생성해 AI 프롬프트에 제공
 */
import * as cheerio from "cheerio";
import { logger } from "./logger";

export interface ScrapedPosting {
  source: "saramin" | "jobkorea";
  name: string;
  title: string;
  jobPostingUrl: string;
  careerText?: string;
  educationText?: string;
  location?: string;
  /** 목록의 마감 표시 원문 (예: "~ 11/30(일)", "상시채용") */
  deadlineText?: string;
}

// ── fetch helper (20초 타임아웃) ──────────────────────────────────────────────
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      logger.warn({ url, status: res.status }, "fetchHtml HTTP 에러");
      return null;
    }
    return await res.text();
  } catch (e) {
    logger.warn({ url, err: (e as Error).message }, "fetchHtml 실패");
    return null;
  }
}

// ── 사람인 스크래퍼 ───────────────────────────────────────────────────────────
// 실제 HTML 구조 (2025년 기준):
//   <li class="item_recruit" value="{rec_idx}" …>
//     <div class="area_job">
//       <h2 class="job_tit">
//         <a title="회사명 채용공고(직무명)" href="/zf_user/jobs/relay/view?…">…</a>
//       </h2>
//     </div>
//     <div class="job_condition">
//       <span>근무지</span><span>경력</span><span>학력</span>…
//     </div>
//   </li>
/**
 * 사람인 근무지역 코드 (loc_mcd). 지역마다 검색해 결과 근무지로 확인한 값 (2026-11).
 * 여러 지역은 쉼표로 이어 한 번에 검색할 수 있다.
 */
export const SARAMIN_REGION_CODES: Record<string, string> = {
  서울: "101000",
  경기: "102000",
  인천: "108000",
  부산: "106000",
  대구: "104000",
  광주: "103000",
  대전: "105000",
  울산: "107000",
  세종: "118000",
  강원: "109000",
  충북: "114000",
  충남: "115000",
  전북: "113000",
  전남: "112000",
  경북: "111000",
  경남: "110000",
  제주: "116000",
};

/** 알려진 지역 이름만 남긴다 (순서 유지, 중복 제거). */
export function normalizeRegions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === "string" && v in SARAMIN_REGION_CODES))];
}

export async function scrapeSaramin(keyword: string, limit = 8, regions: string[] = []): Promise<ScrapedPosting[]> {
  const locCodes = normalizeRegions(regions).map((r) => SARAMIN_REGION_CODES[r]);
  const url =
    `https://www.saramin.co.kr/zf_user/search/recruit` +
    `?searchType=search&searchword=${encodeURIComponent(keyword)}&recruitSort=relation&recruitPage=1&recruitPageCount=10` +
    (locCodes.length ? `&loc_mcd=${encodeURIComponent(locCodes.join(","))}` : "");

  const html = await fetchHtml(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: ScrapedPosting[] = [];

  // item_recruit 를 value 속성을 가진 요소로 선택 (li, div 둘 다 커버)
  $("[class~='item_recruit']").each((_, el) => {
    if (results.length >= limit) return false;

    // 공고 제목 링크 (<h2 class="job_tit"> 내부)
    const titleLink = $(el).find(".job_tit a").first();
    const titleAttr = titleLink.attr("title") ?? "";
    const href      = titleLink.attr("href") ?? "";
    if (!href) return true;

    // title 속성: "회사명 채용공고(직무명)" 형식으로 파싱
    let companyName = "";
    let jobTitle    = "";
    const postingIdx = titleAttr.indexOf("채용공고");
    if (postingIdx > 0) {
      companyName = titleAttr.slice(0, postingIdx).trim();
      jobTitle    = titleAttr.slice(postingIdx + 4).replace(/^\(|\)$/g, "").trim();
    } else {
      // 형식이 다를 경우 텍스트 전체를 제목으로 사용
      jobTitle    = titleAttr || $(el).find(".job_tit").text().trim();
      companyName = $(el).find(".corp_name").text().trim();
    }

    if (!companyName && !jobTitle) return true;

    // 경력·학력·근무지 조건 (job_condition > span)
    const conditions = $(el).find(".job_condition span")
      .map((_, s) => $(s).text().trim())
      .get()
      .filter(Boolean);
    const careerText    = conditions[1] ?? "";
    const educationText = conditions[2] ?? "";
    const location      = conditions[0] ?? "";
    const deadlineText  = $(el).find(".job_date .date").first().text().replace(/\s+/g, " ").trim();

    const postingUrl = href.startsWith("http")
      ? href
      : `https://www.saramin.co.kr${href}`;

    results.push({
      source: "saramin",
      name: companyName || jobTitle,
      title: jobTitle,
      jobPostingUrl: postingUrl,
      careerText,
      educationText,
      location,
      deadlineText,
    });
    return true;
  });

  logger.info({ keyword, count: results.length }, "사람인 스크래핑 완료");
  return results;
}

// ── 잡코리아 검색 URL 생성 (CSR이라 직접 파싱 불가) ─────────────────────────
// 검색 결과 URL을 AI 프롬프트에 제공해 AI가 잡코리아 링크로 공고를 생성하도록 함
export function getJobkoreaSearchUrl(keyword: string): string {
  return `https://www.jobkorea.co.kr/Search/?stext=${encodeURIComponent(keyword)}&tabType=recruit`;
}

// ── 필터 → 검색어 변환 ────────────────────────────────────────────────────────
export function buildKeyword(opts: {
  careerLevel?: string[];
  recruitmentField?: string[];
}): string {
  const fieldMap: Record<string, string> = {
    개발: "개발자",
    기획: "서비스기획",
    디자인: "디자이너",
    영업: "영업",
    품질관리: "QA품질",
    테스터: "QA테스터",
    기타: "",
  };

  const parts: string[] = [];

  for (const f of opts.recruitmentField ?? []) {
    const mapped = fieldMap[f];
    if (mapped) parts.push(mapped);
  }

  if (opts.careerLevel?.includes("신입")) parts.push("신입");
  else if (opts.careerLevel?.length)      parts.push("경력");

  return parts.join(" ").trim() || "개발자";
}
