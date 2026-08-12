import { promises as dns, lookup as dnsLookupCb, type LookupAddress } from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch, type Response as UndiciResponse } from "undici";

// ── SSRF 방어 유틸 ───────────────────────────────────────────────────────────
// 사용자 입력 URL을 서버가 대신 가져올 때(공고 수집 등) 내부망 접근을 막는다.
// 1) IP를 바이트 단위로 파싱해 사설/루프백/링크로컬/예약 대역을 판별한다.
//    (문자열 prefix 검사 금지 — `::ffff:7f00:1` 같은 16진 IPv4-매핑도 걸러야 함)
// 2) DNS 리바인딩 방지: 실제 연결(undici Agent의 connect.lookup)에서 해석된
//    주소만 검증·사용하므로, 검증 시점과 연결 시점의 주소가 항상 동일하다.

/** IPv4 문자열 → 4바이트 배열. 실패 시 null. */
function parseIpv4(ip: string): number[] | null {
  if (!net.isIPv4(ip)) return null;
  return ip.split(".").map((n) => parseInt(n, 10));
}

/** IPv6 문자열 → 16바이트 배열. 실패 시 null. 임베디드 IPv4(뒤쪽 점 표기) 지원. */
function parseIpv6(ip: string): number[] | null {
  if (!net.isIPv6(ip)) return null;
  // zone index 제거 (fe80::1%eth0)
  const cleaned = ip.split("%")[0];
  let head = cleaned;
  let v4Tail: number[] | null = null;
  // 뒤쪽 점 표기 IPv4 (::ffff:127.0.0.1)
  const lastColon = cleaned.lastIndexOf(":");
  const tail = cleaned.slice(lastColon + 1);
  if (tail.includes(".")) {
    v4Tail = parseIpv4(tail);
    if (!v4Tail) return null;
    head = cleaned.slice(0, lastColon + 1); // ':' 유지
  }
  const groupsNeeded = v4Tail ? 6 : 8;
  let left: string[] = [];
  let right: string[] = [];
  if (head.includes("::")) {
    const [l, r] = head.split("::");
    left = l ? l.split(":").filter(Boolean) : [];
    right = r ? r.split(":").filter(Boolean) : [];
  } else {
    left = head.split(":").filter(Boolean);
  }
  const missing = groupsNeeded - left.length - right.length;
  if (missing < 0) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== groupsNeeded) return null;
  const bytes: number[] = [];
  for (const g of groups) {
    const v = parseInt(g, 16);
    if (isNaN(v) || v < 0 || v > 0xffff) return null;
    bytes.push((v >> 8) & 0xff, v & 0xff);
  }
  if (v4Tail) bytes.push(...v4Tail);
  return bytes.length === 16 ? bytes : null;
}

function isPrivateIpv4Bytes(b: number[]): boolean {
  const [a, bb] = b;
  if (a === 0) return true;                                  // 0.0.0.0/8
  if (a === 10) return true;                                 // 10.0.0.0/8
  if (a === 100 && bb >= 64 && bb <= 127) return true;       // 100.64.0.0/10 CGNAT
  if (a === 127) return true;                                // 루프백
  if (a === 169 && bb === 254) return true;                  // 링크로컬
  if (a === 172 && bb >= 16 && bb <= 31) return true;        // 172.16.0.0/12
  if (a === 192 && bb === 0 && b[2] === 0) return true;      // 192.0.0.0/24
  if (a === 192 && bb === 168) return true;                  // 192.168.0.0/16
  if (a === 198 && (bb === 18 || bb === 19)) return true;    // 198.18.0.0/15 벤치마크
  if (a >= 224) return true;                                 // 멀티캐스트·예약·브로드캐스트
  return false;
}

/**
 * 사설/루프백/링크로컬/예약 대역 여부. IPv4-매핑 IPv6(점 표기·16진 표기 모두),
 * NAT64(64:ff9b::/96), IPv4-호환(::/96) 임베디드 주소도 내부 IPv4 규칙으로 검사.
 * 파싱 불가능한 입력은 안전하게 true(차단) 반환.
 */
export function isPrivateIp(ip: string): boolean {
  const v4 = parseIpv4(ip);
  if (v4) return isPrivateIpv4Bytes(v4);
  const b = parseIpv6(ip);
  if (!b) return true; // 알 수 없는 형식은 차단
  const allZero = (from: number, to: number) => b.slice(from, to).every((x) => x === 0);
  // :: (미지정), ::1 (루프백)
  if (allZero(0, 15) && (b[15] === 0 || b[15] === 1)) return true;
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true;  // fe80::/10 링크로컬
  if ((b[0] & 0xfe) === 0xfc) return true;                   // fc00::/7 ULA
  if (b[0] === 0xff) return true;                            // ff00::/8 멀티캐스트
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true; // 2001:db8::/32 문서용
  // IPv4-매핑 ::ffff:0:0/96 및 IPv4-호환 ::/96
  if (allZero(0, 10) && ((b[10] === 0xff && b[11] === 0xff) || (b[10] === 0 && b[11] === 0))) {
    return isPrivateIpv4Bytes(b.slice(12));
  }
  // NAT64 64:ff9b::/96
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && allZero(4, 12)) {
    return isPrivateIpv4Bytes(b.slice(12));
  }
  return false;
}

/** DNS 결과에서 하나라도 사설 대역이면 전부 거부(빈 배열 반환). */
export function filterPublicAddresses(addresses: LookupAddress[]): LookupAddress[] {
  if (addresses.length === 0) return [];
  return addresses.some((a) => isPrivateIp(a.address)) ? [] : addresses;
}

/**
 * URL을 검증하고(http/https만), 호스트가 사설/루프백 대역으로 해석되지 않는지
 * 확인한다. 통과 시 파싱된 URL을 반환, 실패 시 null.
 * (연결 시점 검증은 ssrfSafeAgent의 lookup이 다시 수행하므로 리바인딩에도 안전)
 */
export async function validatePublicUrl(rawUrl: string): Promise<URL | null> {
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

  if (net.isIP(hostname)) {
    return isPrivateIp(hostname) ? null : url;
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (filterPublicAddresses(records).length === 0) return null;
  } catch {
    return null;
  }
  return url;
}

// ── 바이트 상한을 지키며 응답 본문 읽기 ─────────────────────────────────────
export async function readBodyLimited(
  res: { body?: ReadableStream<Uint8Array> | null; arrayBuffer(): Promise<ArrayBuffer> },
  limit: number,
): Promise<Buffer> {
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

// ── 연결 시점 DNS 핀닝 Agent ─────────────────────────────────────────────────
// 실제 소켓 연결에 쓰이는 lookup에서 사설 대역을 거부한다. URL의 호스트명은
// 그대로 유지되므로 Host 헤더·TLS SNI/인증서 검증도 정상 동작한다.
const ssrfSafeAgent = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      dnsLookupCb(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, addresses as never, undefined as never);
        const list = filterPublicAddresses(
          (Array.isArray(addresses) ? addresses : [addresses]) as LookupAddress[],
        );
        if (list.length === 0) {
          return callback(
            new Error(`SSRF 차단: ${hostname} 이(가) 내부 주소로 해석되었습니다.`),
            undefined as never,
            undefined as never,
          );
        }
        if ((options as { all?: boolean }).all) {
          callback(null, list as never, undefined as never);
        } else {
          callback(null, list[0].address as never, list[0].family as never);
        }
      });
    },
  },
});

const MAX_REDIRECT_HOPS = 5;

/**
 * SSRF에 안전한 fetch. redirect:"manual"로 3xx 응답을 직접 처리하여, 각 홉의
 * Location을 현재 URL 기준으로 해석하고 동일한 SSRF 검증을 매 홉마다 수행한다.
 * 연결 자체도 ssrfSafeAgent의 lookup을 통해서만 이루어지므로 DNS 리바인딩으로
 * 검증을 우회할 수 없다. 검증 실패·홉 초과 시 null 반환.
 */
export async function ssrfSafeFetch(
  initialUrl: URL,
  init: { headers: Record<string, string>; timeoutMs: number },
): Promise<UndiciResponse | null> {
  let current: URL = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const resp = await undiciFetch(current.toString(), {
      headers: init.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(init.timeoutMs),
      dispatcher: ssrfSafeAgent,
    });

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      await resp.body?.cancel().catch(() => {});
      if (!location) return resp;
      if (hop >= MAX_REDIRECT_HOPS) return null;
      let nextUrl: URL;
      try {
        nextUrl = new URL(location, current);
      } catch {
        return null;
      }
      const validatedNext = await validatePublicUrl(nextUrl.toString());
      if (!validatedNext) return null;
      current = validatedNext;
      continue;
    }

    return resp;
  }
  return null;
}
