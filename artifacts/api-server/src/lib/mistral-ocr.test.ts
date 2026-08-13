/**
 * 단위 테스트: Mistral OCR 래퍼.
 * - MISTRAL_API_KEY 유무에 따른 mistralOcrAvailable()
 * - PDF/이미지 요청 본문(document 타입) 구성
 * - pages[].markdown 이어붙이기
 * global fetch만 스텁한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mistralOcrAvailable, mistralOcrPdf, mistralOcrImage } from "./mistral-ocr";

const originalKey = process.env.MISTRAL_API_KEY;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("mistral-ocr", () => {
  beforeEach(() => {
    process.env.MISTRAL_API_KEY = "test-key";
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.MISTRAL_API_KEY;
    else process.env.MISTRAL_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("mistralOcrAvailable는 키 유무를 반영한다", () => {
    expect(mistralOcrAvailable()).toBe(true);
    delete process.env.MISTRAL_API_KEY;
    expect(mistralOcrAvailable()).toBe(false);
    process.env.MISTRAL_API_KEY = "   ";
    expect(mistralOcrAvailable()).toBe(false);
  });

  it("PDF: document_url 타입으로 호출하고 markdown을 이어붙인다", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ pages: [{ index: 0, markdown: "1페이지" }, { index: 1, markdown: "2페이지" }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const text = await mistralOcrPdf(Buffer.from("%PDF-1.4"));
    expect(text).toBe("1페이지\n\n2페이지");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.mistral.ai/v1/ocr");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("mistral-ocr-latest");
    expect(body.document.type).toBe("document_url");
    expect(body.document.document_url).toMatch(/^data:application\/pdf;base64,/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
  });

  it("이미지: image_url 타입으로 호출한다", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ pages: [{ index: 0, markdown: "이미지 텍스트" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const text = await mistralOcrImage(Buffer.from([0xff, 0xd8]), "image/png");
    expect(text).toBe("이미지 텍스트");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.document.type).toBe("image_url");
    expect(body.document.image_url).toMatch(/^data:image\/png;base64,/);
  });

  it("HTTP 오류는 상태 코드만 담아 throw 한다 (PII 미포함)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));
    await expect(mistralOcrPdf(Buffer.from("x"))).rejects.toThrow(/HTTP 500/);
  });
});
