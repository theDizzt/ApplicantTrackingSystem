/**
 * 통합 테스트: 공고 URL 수집 라우트.
 * - 잡코리아/사람인 상세 페이지(iframe) 우선 채택
 * - 이미지 공고의 비전 OCR 폴백 (source: "ocr")
 * - 빈 본문(삭제된 공고 등) → 422 한국어 안내
 * - 차단(403) → 502 한국어 안내
 * - 사설 대역 URL(16진 IPv4-매핑 IPv6 포함) → 400
 *
 * 네트워크 계층(ssrfSafeFetch)만 스텁하고 validatePublicUrl은 실제 구현을
 * 사용한다 (IP 리터럴 경로는 DNS 없이 동작).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../middlewares/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const ocrImageBufferMock = vi.fn();
vi.mock("../lib/vision-ocr", () => ({
  ocrImageBuffer: (...args: unknown[]) => ocrImageBufferMock(...args),
}));

// URL → 응답 매핑으로 동작하는 가짜 fetch. validatePublicUrl/isPrivateIp는 실제 구현.
type FakeResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  body: null;
  arrayBuffer(): Promise<ArrayBuffer>;
};
const responses = new Map<string, { status: number; contentType: string; body: Buffer }>();

function fakeResponse(entry: { status: number; contentType: string; body: Buffer }): FakeResponse {
  return {
    ok: entry.status >= 200 && entry.status < 300,
    status: entry.status,
    headers: { get: (n) => (n.toLowerCase() === "content-type" ? entry.contentType : null) },
    body: null,
    arrayBuffer: async () => {
      const ab = new ArrayBuffer(entry.body.byteLength);
      new Uint8Array(ab).set(entry.body);
      return ab;
    },
  };
}

vi.mock("../lib/safe-fetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/safe-fetch")>();
  return {
    ...actual,
    ssrfSafeFetch: vi.fn(async (url: URL) => {
      // 매핑에 있으면 그대로, 없으면 프리픽스 일치로 조회
      const key = url.toString();
      const entry =
        responses.get(key) ??
        [...responses.entries()].find(([k]) => key.startsWith(k))?.[1];
      if (!entry) return fakeResponse({ status: 404, contentType: "text/html", body: Buffer.from("") });
      return fakeResponse(entry);
    }),
    // 사설 대역 검증은 실제 구현 유지 (DNS가 필요 없는 IP 리터럴·localhost 경로만 테스트)
  };
});

import companyPostingRouter from "./company-posting";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(companyPostingRouter);
  return app;
}

const NAV_JUNK =
  "<html><title>잡코리아 공고</title><body>" +
  "<nav>메뉴 검색 지역 선택 서울 경기 인천 대전 세종 충남 충북 로그인 회원가입 기업 서비스 ".repeat(10) +
  "</nav></body></html>";

const REAL_BODY =
  "담당업무: 백엔드 서버 개발 및 운영. 자격요건: Node.js 3년 이상, PostgreSQL 사용 경험. " +
  "우대사항: 대규모 트래픽 처리 경험, 클라우드 인프라 운영 경험. 근무지: 서울특별시 강남구. " +
  "급여: 회사 내규에 따름. 전형절차: 서류 - 과제 - 면접 - 처우협의 - 최종합격.";

describe("POST /companies/fetch-posting", () => {
  beforeEach(() => {
    responses.clear();
    ocrImageBufferMock.mockReset();
  });

  it("잡코리아: 겉 페이지 내비 텍스트 대신 상세 iframe 본문을 채택한다", async () => {
    responses.set("https://www.jobkorea.co.kr/Recruit/GI_Read/123", {
      status: 200, contentType: "text/html", body: Buffer.from(NAV_JUNK),
    });
    responses.set("https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Ifrm?Gno=123", {
      status: 200, contentType: "text/html",
      body: Buffer.from(`<html><body><div>${REAL_BODY}</div></body></html>`),
    });
    const res = await request(makeApp())
      .post("/companies/fetch-posting")
      .send({ url: "https://www.jobkorea.co.kr/Recruit/GI_Read/123" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("html");
    expect(res.body.text).toContain("담당업무: 백엔드 서버 개발");
    expect(res.body.text).not.toContain("회원가입");
  });

  it("사람인: rec_idx로 상세 페이지를 추적한다", async () => {
    responses.set("https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=99", {
      status: 200, contentType: "text/html", body: Buffer.from(NAV_JUNK),
    });
    responses.set("https://www.saramin.co.kr/zf_user/jobs/relay/view-detail?rec_idx=99&rec_seq=0", {
      status: 200, contentType: "text/html",
      body: Buffer.from(`<html><body>${REAL_BODY}</body></html>`),
    });
    const res = await request(makeApp())
      .post("/companies/fetch-posting")
      .send({ url: "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=99" });
    expect(res.status).toBe(200);
    expect(res.body.text).toContain("자격요건: Node.js");
  });

  it("이미지 공고: 상세 본문이 짧으면 이미지 OCR로 폴백한다 (source: ocr)", async () => {
    responses.set("https://www.jobkorea.co.kr/Recruit/GI_Read/777", {
      status: 200, contentType: "text/html", body: Buffer.from(NAV_JUNK),
    });
    responses.set("https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Ifrm?Gno=777", {
      status: 200, contentType: "text/html",
      body: Buffer.from(
        '<html><body><img src="https://file1.jobkorea.co.kr/Mng/post_777.jpg"/></body></html>',
      ),
    });
    responses.set("https://file1.jobkorea.co.kr/Mng/post_777.jpg", {
      status: 200, contentType: "image/jpeg", body: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    });
    ocrImageBufferMock.mockResolvedValue(REAL_BODY);
    const res = await request(makeApp())
      .post("/companies/fetch-posting")
      .send({ url: "https://www.jobkorea.co.kr/Recruit/GI_Read/777" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("ocr");
    expect(res.body.text).toContain("담당업무: 백엔드 서버 개발");
    expect(ocrImageBufferMock).toHaveBeenCalledTimes(1);
  });

  it("삭제된 공고(본문 없음)는 422 한국어 안내를 반환한다", async () => {
    responses.set("https://www.jobkorea.co.kr/Recruit/GI_Read/000", {
      status: 200, contentType: "text/html",
      body: Buffer.from("<html><body><script>alert('없음');location.href='/';</script></body></html>"),
    });
    responses.set("https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Ifrm?Gno=000", {
      status: 404, contentType: "text/html", body: Buffer.from(""),
    });
    const res = await request(makeApp())
      .post("/companies/fetch-posting")
      .send({ url: "https://www.jobkorea.co.kr/Recruit/GI_Read/000" });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("공고 내용을 읽지 못했습니다");
  });

  it("차단(403)은 502 한국어 안내를 반환한다", async () => {
    responses.set("https://www.wanted.co.kr/wd/1", {
      status: 403, contentType: "text/html", body: Buffer.from("forbidden"),
    });
    const res = await request(makeApp())
      .post("/companies/fetch-posting")
      .send({ url: "https://www.wanted.co.kr/wd/1" });
    expect(res.status).toBe(502);
    expect(res.body.error).toContain("자동 수집을 차단");
  });

  it.each([
    "http://127.0.0.1/admin",
    "http://[::ffff:7f00:1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:5432/",
  ])("사설 대역 URL은 400으로 거부: %s", async (url) => {
    const res = await request(makeApp()).post("/companies/fetch-posting").send({ url });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("허용되지 않은 주소");
  });
});
