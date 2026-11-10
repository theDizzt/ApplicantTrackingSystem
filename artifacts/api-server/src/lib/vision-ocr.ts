import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getAI } from "./openai";
import { logger } from "./logger";
import { mistralOcrAvailable, mistralOcrPdf, mistralOcrImage } from "./mistral-ocr";

const execFileAsync = promisify(execFile);

// Mistral OCR 결과가 이 길이 미만이면 실패로 간주하고 기존 비전 OCR로 폴백한다.
const MISTRAL_MIN_TEXT_LEN = 30;

// ── 비전 모델 기반 OCR ───────────────────────────────────────────────────────
// 스캔 이미지 PDF·이미지 채용 공고를 설정된 AI(비전 지원 모델)로 읽어 텍스트를
// 추출한다. 전용 OCR 엔진(tesseract 등) 대비 한국어 문서·표 인식 품질이 좋고
// 별도 설치가 필요 없다.

const OCR_SYSTEM_PROMPT =
  "당신은 문서 OCR 엔진입니다. 이미지에 보이는 모든 텍스트를 읽어 순서대로 출력하세요. " +
  "표는 각 행을 '항목: 값' 형태의 줄로 풀어서 쓰세요. 텍스트 외의 설명·해석·요약은 절대 추가하지 마세요. " +
  "읽을 수 있는 텍스트가 전혀 없으면 빈 문자열을 출력하세요.";

// PDF 페이지 수 제한 (비용·시간 상한). 이력서·공고는 대부분 10페이지 이내.
const MAX_OCR_PAGES = 10;
// 렌더링 해상도(DPI). 150이면 A4 기준 약 1240×1754px — 한글 OCR에 충분.
const RENDER_DPI = 150;

/**
 * 이미지 버퍼 1장을 OCR. 반환: 추출 텍스트(없으면 "").
 * MISTRAL_API_KEY가 설정되어 있으면 Mistral OCR을 우선 사용하고, 실패하거나
 * 결과가 너무 짧으면 기존 비전 모델 OCR로 폴백한다.
 */
export async function ocrImageBuffer(buffer: Buffer, mime: string): Promise<string> {
  if (mistralOcrAvailable()) {
    try {
      const text = await mistralOcrImage(buffer, mime);
      if (text.length >= MISTRAL_MIN_TEXT_LEN) return text;
      logger.warn({ len: text.length }, "Mistral OCR(image) returned too little text; falling back to vision OCR");
    } catch (err) {
      // 원문(PII) 없이 메시지만 로깅한다.
      const detail = err instanceof Error ? err.message : String(err);
      logger.warn({ detail }, "Mistral OCR(image) failed; falling back to vision OCR");
    }
  }
  return ocrImageBufferVision(buffer, mime);
}

/** 이미지 버퍼 1장을 비전 모델로 OCR. 반환: 추출 텍스트(없으면 ""). */
async function ocrImageBufferVision(buffer: Buffer, mime: string): Promise<string> {
  const { openai, model } = await getAI("vision");
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: OCR_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "이 이미지의 모든 텍스트를 추출하세요." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_completion_tokens: 4096,
  });
  return (response.choices[0]?.message?.content ?? "").trim();
}

export class VisionOcrError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "VisionOcrError";
  }
}

/**
 * 이미지(스캔) PDF를 OCR한다.
 * MISTRAL_API_KEY가 설정되어 있으면 PDF 전체를 Mistral OCR로 우선 처리하고
 * (pdftoppm 불필요), 실패하거나 결과가 너무 짧으면 기존 pdftoppm+비전 모델
 * 경로로 폴백한다. 반환: 전체 텍스트(없으면 "").
 * pdftoppm 미설치·모델의 비전 미지원 시 VisionOcrError를 던진다.
 */
export async function ocrPdfBuffer(pdfBuffer: Buffer): Promise<string> {
  if (mistralOcrAvailable()) {
    try {
      const text = await mistralOcrPdf(pdfBuffer);
      if (text.length >= MISTRAL_MIN_TEXT_LEN) return text;
      logger.warn({ len: text.length }, "Mistral OCR(pdf) returned too little text; falling back to vision OCR");
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      logger.warn({ detail }, "Mistral OCR(pdf) failed; falling back to vision OCR");
    }
  }
  return ocrPdfBufferVision(pdfBuffer);
}

async function ocrPdfBufferVision(pdfBuffer: Buffer): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  try {
    await fs.writeFile(pdfPath, pdfBuffer);
    try {
      await execFileAsync("pdftoppm", [
        "-png",
        "-r", String(RENDER_DPI),
        "-f", "1",
        "-l", String(MAX_OCR_PAGES),
        pdfPath,
        path.join(tmpDir, "page"),
      ], { timeout: 60_000 });
    } catch (err) {
      throw new VisionOcrError(
        "PDF를 이미지로 변환하지 못했습니다 (pdftoppm 실행 실패). poppler-utils가 설치되어 있는지 확인하세요.",
        err,
      );
    }
    const files = (await fs.readdir(tmpDir))
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort();
    if (files.length === 0) return "";
    const pages: string[] = [];
    for (const file of files) {
      const buffer = await fs.readFile(path.join(tmpDir, file));
      try {
        const text = await ocrImageBufferVision(buffer, "image/png");
        if (text) pages.push(text);
      } catch (err) {
        // 첫 페이지부터 실패하면 모델이 비전을 지원하지 않을 가능성이 큼
        if (pages.length === 0) {
          throw new VisionOcrError(
            "AI 모델이 이미지 인식(비전)을 지원하지 않거나 호출에 실패했습니다. " +
              "비전(이미지 인식)을 지원하는 모델을 설정하세요.",
            err,
          );
        }
        break; // 일부 페이지만 실패하면 지금까지 읽은 내용으로 진행
      }
    }
    return pages.join("\n\n").trim();
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
