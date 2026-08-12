/**
 * SSRF 가드 단위 테스트: 사설/루프백/예약 대역이 어떤 표기(IPv4, 점 표기·16진
 * IPv4-매핑 IPv6, NAT64 등)로 와도 차단되는지, DNS 결과 필터가 하나라도 사설이면
 * 전부 거부하는지 검증한다.
 */
import { describe, expect, it } from "vitest";
import { filterPublicAddresses, isPrivateIp, validatePublicUrl } from "./safe-fetch";

describe("isPrivateIp", () => {
  const privateCases = [
    // IPv4
    "127.0.0.1", "127.255.255.255", "10.0.0.1", "172.16.0.1", "172.31.255.255",
    "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "100.127.255.255",
    "192.0.0.1", "198.18.0.1", "198.19.255.255", "224.0.0.1", "255.255.255.255",
    // IPv6
    "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1",
    // IPv4-매핑 IPv6 — 점 표기와 16진 표기 모두 (리뷰 지적 사항)
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "::ffff:a00:1",
    "::ffff:192.168.0.1", "::ffff:c0a8:1", "::ffff:169.254.169.254", "::ffff:a9fe:a9fe",
    // IPv4-호환(::/96) 및 NAT64(64:ff9b::/96) 임베디드
    "::7f00:1", "64:ff9b::7f00:1", "64:ff9b::127.0.0.1",
  ];
  it.each(privateCases)("차단: %s", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  const publicCases = [
    "8.8.8.8", "1.1.1.1", "203.0.114.1", "2606:4700::1111",
    "::ffff:8.8.8.8", "::ffff:808:808", "64:ff9b::808:808",
  ];
  it.each(publicCases)("허용: %s", (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });

  it("알 수 없는 형식은 안전하게 차단", () => {
    expect(isPrivateIp("not-an-ip")).toBe(true);
    expect(isPrivateIp("")).toBe(true);
  });
});

describe("filterPublicAddresses (연결 시점 DNS 핀닝 필터)", () => {
  it("하나라도 사설이면 전부 거부 — 리바인딩/이중 A레코드 방어", () => {
    expect(
      filterPublicAddresses([
        { address: "8.8.8.8", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]),
    ).toEqual([]);
  });
  it("전부 공인이면 통과", () => {
    const recs = [{ address: "8.8.8.8", family: 4 }, { address: "1.1.1.1", family: 4 }];
    expect(filterPublicAddresses(recs)).toEqual(recs);
  });
  it("빈 결과는 거부", () => {
    expect(filterPublicAddresses([])).toEqual([]);
  });
});

describe("validatePublicUrl", () => {
  const rejected = [
    "http://127.0.0.1/", "http://[::1]/", "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:7f00:1]/", "http://localhost/", "http://foo.localhost/",
    "http://169.254.169.254/latest/meta-data/", "http://[fe80::1]/",
    "http://10.0.0.5:8080/admin", "ftp://example.com/", "file:///etc/passwd",
    "not a url",
  ];
  it.each(rejected)("거부: %s", async (u) => {
    expect(await validatePublicUrl(u)).toBeNull();
  });

  it("공인 IP 리터럴은 허용", async () => {
    const url = await validatePublicUrl("http://8.8.8.8/");
    expect(url?.hostname).toBe("8.8.8.8");
  });
});
