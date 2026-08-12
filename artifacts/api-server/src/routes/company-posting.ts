import { Router, type IRouter } from "express";
import { promises as dns } from "node:dns";
import net from "node:net";
import * as cheerio from "cheerio";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { ocrImageBuffer } from "../lib/vision-ocr";

const router: IRouter = Router();

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const MIN_TEXT_LEN = 200;
const MAX_OCR_IMAGES = 3;

const BLOCKED_MESSAGE =
  "사이트가 자동 수집을 차단했거나 접속할 수 없습니다. 공고 내용을 직접 붙여넣어 주세요.";

// ── SSRF 가드 ────────────────────────────────────────────────────────────────
// 사설/루프백/링크로컬 대역으로 해석되는 호스트를 차단한다.
function isPrivateIp(ip: string): boolean {
  const type = net.isIP(ip);
  if (type === 4) {
    const parts = ip.split(".").map((n) => parseInt(n, 10));
    const [a, b] = parts;
    if (a === 127) return true;                       // 127.0.0.0/8 loopback
    if (a === 10) return true;                         // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
    if (a === 192 && b === 168) return true;           // 192.168.0.0/16
    if (a === 169 && b === 254) return true;           // 169.254.0.0/16 link-local
    if (a === 0) return true;                          // 0.0.0.0/8
    return false;
  }
  if (type === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;                  // loopback
    if (lower === "::") return true;
    if (lower.startsWith("fe80")) return true;         // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
    // IPv4-mapped ::ffff:a.b.c.d
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return false;
}

/**
 * URL을 검증하고(http/https만), 호스트가 사설/루프백 대역으로 해석되지 않는지
 * 확인한다. 통과 시 파싱된 URL을 반환, 실패 시 null.
 */
async function validatePublicUrl(rawUrl: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const lowerHost = hostname.toLowerCase();
  if (lowerHost === "localhost" || lowerHost.endsWith(".localhost")) return null;

  // 호스트가 이미 IP 리터럴이면 바로 검사
  if (net.isIP(hostname)) {
    return isPrivateIp(hostname) ? null : url;
  }

  // DNS 해석 후 모든 결과가 공인 대역인지 확인
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (records.length === 0) return null;
    for (const rec of records) {
      if (isPrivateIp(rec.address)) return null;
    }
  } catch {
    return null;
  }
  return url;
}

// ── 바이트 상한을 지키며 응답 본문 읽기 ─────────────────────────────────────
async function readBodyLimited(res: Response, limit: number): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > limit) return buf.subarray(0, limit);
    return buf;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      const chunk = Buffer.from(value);
      chunks.push(chunk);
      total += chunk.byteLength;
      if (total >= limit) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
  }
  return Buffer.concat(chunks).subarray(0, limit);
}

const MAX_REDIRECT_HOPS = 5;

/**
 * SSRF에 안전한 fetch. redirect:"manual"로 3xx 응답을 직접 처리하여, 각 홉의
 * Location을 현재 URL 기준으로 해석하고 동일한 SSRF 검증(DNS 해석 포함)을
 * 매 홉마다 수행한다. 최대 MAX_REDIRECT_HOPS 홉까지 따라간다.
 * (완전한 DNS 리바인딩 방지 핀닝은 범위 밖 — 각 홉의 해석 주소 검증이 목표.)
 * 검증 실패·홉 초과 시 null 반환. 초기 URL은 이미 검증되었다고 가정한다.
 */
async function ssrfSafeFetch(
  initialUrl: URL,
  init: { headers: Record<string, string>; timeoutMs: number },
): Promise<globalThis.Response | null> {
  let current: URL = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const resp = await fetch(current.toString(), {
      headers: init.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(init.timeoutMs),
    });

    // 3xx 리다이렉트 처리
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      // 본문은 버린다.
      await resp.body?.cancel().catch(() => {});
      if (!location) return resp; // Location 없는 3xx → 그대로 반환
      if (hop >= MAX_REDIRECT_HOPS) return null; // 홉 초과
      let nextUrl: URL;
      try {
        nextUrl = new URL(location, current);
      } catch {
        return null;
      }
      const validatedNext = await validatePublicUrl(nextUrl.toString());
      if (!validatedNext) return null; // 리다이렉트 대상이 사설/차단 대역
      current = validatedNext;
      continue;
    }

    return resp;
  }
  return null;
}

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
    const buf = await readBodyLimited(resp as unknown as Response, MAX_BYTES);
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

  // ── 텍스트가 부족하면 이미지 OCR 시도 ──────────────────────────────────────
  if (text.length < MIN_TEXT_LEN) {
    // cheerio.load(html) 에서 extractText가 script/style을 제거했으므로 img 수집은
    // 원본 HTML을 다시 로드해서 진행한다.
    const $imgs = cheerio.load(html);
    const imgUrls = collectImageUrls($imgs, validated, MAX_OCR_IMAGES);
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
        const imgBuf = await readBodyLimited(imgResp as unknown as Response, MAX_BYTES);
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

  res.json({ ok: true, text, source, ...(title ? { title } : {}) });
});

export default router;
