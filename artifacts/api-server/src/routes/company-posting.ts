import { Router, type IRouter } from "express";
import * as cheerio from "cheerio";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { ocrImageBuffer } from "../lib/vision-ocr";
import { validatePublicUrl, ssrfSafeFetch, readBodyLimited } from "../lib/safe-fetch";

const router: IRouter = Router();

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const MIN_TEXT_LEN = 200;
const MAX_OCR_IMAGES = 3;

const BLOCKED_MESSAGE =
  "사이트가 자동 수집을 차단했거나 접속할 수 없습니다. 공고 내용을 직접 붙여넣어 주세요.";

// ── HTML → 읽을 수 있는 텍스트 ──────────────────────────────────────────────
function extractText($: cheerio.CheerioAPI): string {
  $("script, style, nav, header, footer, noscript, iframe, svg").remove();
  const text = $("body").text() || $.root().text();
  return collapseWhitespace(text);
}

function collapseWhitespace(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── 이미지 URL 필터 (아이콘·로고·스프라이트·data URI 제외) ───────────────────
const ICON_HINT = /(icon|logo|sprite|favicon|button|btn|badge|arrow|bullet|blank|spacer|pixel|1x1)/i;

function looksLikeContentImage(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("data:")) return false;
  if (ICON_HINT.test(src)) return false;
  if (/\.(svg|gif)(\?|$)/i.test(src)) return false;
  return true;
}

function collectImageUrls($: cheerio.CheerioAPI, pageUrl: URL, max: number): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  $("img").each((_, el) => {
    if (urls.length >= max) return false;
    const raw =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("data-original") ||
      "";
    if (!raw || !looksLikeContentImage(raw)) return true;
    let abs: string;
    try {
      abs = new URL(raw, pageUrl).toString();
    } catch {
      return true;
    }
    if (seen.has(abs)) return true;
    seen.add(abs);
    urls.push(abs);
    return true;
  });
  return urls;
}

// ── 상세 본문 페이지 해석 ────────────────────────────────────────────────────
// 사람인·잡코리아 등 주요 채용 사이트는 공고 본문을 별도 상세 페이지(iframe/ajax)로
// 로드하므로, 겉 페이지만 읽으면 내비게이션 문구만 나온다. 알려진 패턴과
// 같은 호스트의 iframe src를 후보로 수집해 본문을 추가로 가져온다.
const MAX_DETAIL_PAGES = 2;

interface DetailCandidate {
  url: string;
  /** 알려진 사이트 패턴이면 true — 겉 페이지 텍스트보다 무조건 우선한다. */
  preferred: boolean;
}

function resolveDetailUrls(pageUrl: URL, $: cheerio.CheerioAPI): DetailCandidate[] {
  const candidates: DetailCandidate[] = [];
  const host = pageUrl.hostname.toLowerCase();

  // 사람인: /zf_user/jobs/... view?rec_idx=N → relay/view-detail?rec_idx=N
  if (host.endsWith("saramin.co.kr")) {
    const recIdx = pageUrl.searchParams.get("rec_idx");
    if (recIdx && /^\d+$/.test(recIdx)) {
      candidates.push({
        url: `https://www.saramin.co.kr/zf_user/jobs/relay/view-detail?rec_idx=${recIdx}&rec_seq=0`,
        preferred: true,
      });
    }
  }

  // 잡코리아: /Recruit/GI_Read/N → /Recruit/GI_Read_Comt_Ifrm?Gno=N
  if (host.endsWith("jobkorea.co.kr")) {
    const m = pageUrl.pathname.match(/\/Recruit\/GI_Read\/(\d+)/i);
    if (m) {
      candidates.push({
        url: `https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Ifrm?Gno=${m[1]}`,
        preferred: true,
      });
    }
  }

  // 일반: 같은 호스트(또는 상위 도메인 공유)의 iframe src
  $("iframe[src]").each((_, el) => {
    const raw = ($(el).attr("src") || "").trim();
    if (!raw || raw === "about:blank" || raw.startsWith("javascript:")) return;
    try {
      const abs = new URL(raw, pageUrl);
      const baseDomain = host.split(".").slice(-2).join(".");
      if (abs.hostname.toLowerCase().endsWith(baseDomain)) {
        candidates.push({ url: abs.toString(), preferred: false });
      }
    } catch {
      /* 무시 */
    }
  });

  const seen = new Set<string>();
  return candidates
    .filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)))
    .slice(0, MAX_DETAIL_PAGES);
}

// ── POST /companies/fetch-posting ────────────────────────────────────────────
router.post("/companies/fetch-posting", requireAuth, async (req, res): Promise<void> => {
  const { url } = req.body as { url?: string };
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "공고 URL을 입력해주세요." });
    return;
  }

  const validated = await validatePublicUrl(url.trim());
  if (!validated) {
    res.status(400).json({ error: "유효하지 않은 URL이거나 접근이 허용되지 않은 주소입니다." });
    return;
  }

  // ── 페이지 가져오기 ────────────────────────────────────────────────────────
  let html: string;
  let title: string | undefined;
  try {
    const resp = await ssrfSafeFetch(validated, {
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      },
      timeoutMs: FETCH_TIMEOUT_MS,
    });
    if (!resp || resp.status === 403 || resp.status === 429 || !resp.ok) {
      logger.warn({ url: validated.toString(), status: resp?.status ?? "blocked" }, "fetch-posting 차단/실패");
      res.status(502).json({ error: BLOCKED_MESSAGE });
      return;
    }
    const buf = await readBodyLimited(resp, MAX_BYTES);
    html = buf.toString("utf-8");
  } catch (err) {
    logger.warn({ url: validated.toString(), err: (err as Error).message }, "fetch-posting fetch 오류");
    res.status(502).json({ error: BLOCKED_MESSAGE });
    return;
  }

  const $ = cheerio.load(html);
  title = collapseWhitespace($("title").first().text()) || undefined;

  let text = extractText($);
  let source: "html" | "ocr" = "html";

  // ── 상세 본문 페이지(사람인/잡코리아 iframe·ajax) 추가 수집 ────────────────
  // img 수집용으로 원본 HTML을 다시 로드해 둔다 (extractText가 DOM을 훼손하므로).
  const $imgs = cheerio.load(html);
  const detailUrls = resolveDetailUrls(validated, $imgs);
  let detailDollar: cheerio.CheerioAPI | null = null;
  let detailPageUrl: URL | null = null;
  for (const candidate of detailUrls) {
    const detailValidated = await validatePublicUrl(candidate.url);
    if (!detailValidated) continue;
    try {
      const detailResp = await ssrfSafeFetch(detailValidated, {
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
          "Referer": validated.toString(),
        },
        timeoutMs: FETCH_TIMEOUT_MS,
      });
      if (!detailResp || !detailResp.ok) continue;
      const detailBuf = await readBodyLimited(detailResp, MAX_BYTES);
      const detailHtml = detailBuf.toString("utf-8");
      const $detailImgs = cheerio.load(detailHtml);
      const detailText = extractText(cheerio.load(detailHtml));
      // 알려진 사이트 패턴의 상세 페이지는 공고 본문 그 자체이므로 겉 페이지
      // (내비게이션 텍스트)보다 항상 우선한다. 본문이 짧으면(이미지 공고)
      // 짧은 그대로 채택해 아래 OCR 폴백이 상세 페이지 이미지로 동작하게 한다.
      if (candidate.preferred) {
        text = detailText;
        detailDollar = $detailImgs;
        detailPageUrl = detailValidated;
        break;
      }
      // 일반 iframe은 겉 페이지보다 길고 유의미할 때만 사용.
      if (detailText.length >= MIN_TEXT_LEN && detailText.length > text.length) {
        text = detailText;
        detailDollar = $detailImgs;
        detailPageUrl = detailValidated;
        break;
      }
      if (!detailDollar) {
        detailDollar = $detailImgs;
        detailPageUrl = detailValidated;
      }
    } catch (err) {
      logger.warn({ detailUrl: candidate.url, err: (err as Error).message }, "fetch-posting 상세 페이지 수집 실패");
    }
  }

  // ── 텍스트가 부족하면 이미지 OCR 시도 ──────────────────────────────────────
  if (text.length < MIN_TEXT_LEN) {
    // 상세 페이지가 있으면 그쪽 이미지를 우선 사용 (본문 이미지가 거기 있음)
    const imgUrls =
      detailDollar && detailPageUrl
        ? collectImageUrls(detailDollar, detailPageUrl, MAX_OCR_IMAGES)
        : collectImageUrls($imgs, validated, MAX_OCR_IMAGES);
    const ocrParts: string[] = [];

    for (const imgUrl of imgUrls) {
      const imgValidated = await validatePublicUrl(imgUrl);
      if (!imgValidated) continue;
      try {
        const imgResp = await ssrfSafeFetch(imgValidated, {
          headers: {
            "User-Agent": BROWSER_UA,
            "Accept": "image/*,*/*;q=0.8",
            "Referer": validated.toString(),
          },
          timeoutMs: FETCH_TIMEOUT_MS,
        });
        if (!imgResp || !imgResp.ok) continue;
        const contentType = (imgResp.headers.get("content-type") || "").toLowerCase();
        if (!contentType.startsWith("image/")) continue;
        const imgBuf = await readBodyLimited(imgResp, MAX_BYTES);
        if (imgBuf.byteLength === 0) continue;
        const mime = contentType.split(";")[0].trim() || "image/png";
        const ocrText = await ocrImageBuffer(imgBuf, mime);
        if (ocrText) ocrParts.push(ocrText);
      } catch (err) {
        logger.warn({ imgUrl, err: (err as Error).message }, "fetch-posting 이미지 OCR 실패");
      }
    }

    if (ocrParts.length > 0) {
      const ocrText = collapseWhitespace(ocrParts.join("\n\n"));
      // OCR 결과가 기존 HTML 텍스트보다 유의미하면 OCR로 대체
      if (ocrText.length > text.length) {
        text = ocrText;
        source = "ocr";
      }
    }
  }

  // 최종적으로 읽어낸 본문이 사실상 없으면(빈 페이지·삭제된 공고·스크립트 전용
  // 페이지) 빈 성공 응답 대신 한국어 안내를 반환한다.
  if (collapseWhitespace(text).length < 30) {
    logger.warn({ url: validated.toString() }, "fetch-posting 본문 추출 실패(내용 없음)");
    res.status(422).json({
      error:
        "페이지에서 공고 내용을 읽지 못했습니다. 공고가 마감·삭제되었거나 스크립트로만 표시되는 페이지일 수 있습니다. 공고 내용을 직접 붙여넣어 주세요.",
    });
    return;
  }

  res.json({ ok: true, text, source, ...(title ? { title } : {}) });
});

export default router;
