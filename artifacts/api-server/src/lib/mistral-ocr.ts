// ── Mistral OCR ──────────────────────────────────────────────────────────────
// MISTRAL_API_KEY 환경변수가 설정되어 있으면 Mistral의 전용 OCR API를 우선 사용한다.
// 키가 없거나 호출이 실패하면 호출 측(vision-ocr.ts)에서 기존 비전 모델 OCR로 폴백한다.
// 문서(PDF)와 이미지 모두 지원하며, 응답의 pages[].markdown 을 이어붙여 텍스트로 반환한다.

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
const MISTRAL_OCR_MODEL = "mistral-ocr-latest";
const OCR_TIMEOUT_MS = 60_000;

/** MISTRAL_API_KEY가 설정되어 있으면 true. */
export function mistralOcrAvailable(): boolean {
  return !!(process.env.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY.trim());
}

interface MistralOcrPage {
  index?: number;
  markdown?: string;
}
interface MistralOcrResponse {
  pages?: MistralOcrPage[];
}

async function callMistralOcr(document: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) throw new Error("MISTRAL_API_KEY가 설정되지 않았습니다.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
  try {
    const response = await fetch(MISTRAL_OCR_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ model: MISTRAL_OCR_MODEL, document }),
      signal: controller.signal,
    });
    if (!response.ok) {
      // 본문에 PII가 없도록 상태 코드만 로깅한다.
      throw new Error(`Mistral OCR 응답 오류 (HTTP ${response.status})`);
    }
    const data = (await response.json()) as MistralOcrResponse;
    const pages = Array.isArray(data.pages) ? data.pages : [];
    return pages
      .map((p) => (typeof p.markdown === "string" ? p.markdown : ""))
      .filter(Boolean)
      .join("\n\n")
      .trim();
  } finally {
    clearTimeout(timeout);
  }
}

/** PDF 버퍼 전체를 Mistral OCR로 처리. 반환: 추출 텍스트(없으면 ""). */
export async function mistralOcrPdf(pdfBuffer: Buffer): Promise<string> {
  const dataUrl = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
  return callMistralOcr({ type: "document_url", document_url: dataUrl });
}

/** 이미지 버퍼 1장을 Mistral OCR로 처리. 반환: 추출 텍스트(없으면 ""). */
export async function mistralOcrImage(buffer: Buffer, mime: string): Promise<string> {
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  return callMistralOcr({ type: "image_url", image_url: dataUrl });
}
