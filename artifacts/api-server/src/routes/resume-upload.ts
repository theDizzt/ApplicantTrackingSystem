import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { db, resumesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getAI } from "../lib/openai";
import { ocrPdfBuffer, VisionOcrError } from "../lib/vision-ocr";
import { startCareerAnalysis } from "./career-analysis";
import { resumeHtmlToText } from "../lib/resume-text";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".pdf", ".doc", ".docx"].includes(ext)) cb(null, true);
    else cb(new Error("PDF 또는 DOCX 파일만 업로드 가능합니다."));
  },
});

async function parsePdf(buffer: Buffer): Promise<string> {
  const tmpIn  = path.join(os.tmpdir(), `resume_${Date.now()}_in.pdf`);
  const tmpOut = path.join(os.tmpdir(), `resume_${Date.now()}_out.txt`);
  try {
    await fs.writeFile(tmpIn, buffer);
    await execFileAsync("pdftotext", ["-enc", "UTF-8", "-layout", tmpIn, tmpOut]);
    return await fs.readFile(tmpOut, "utf-8");
  } finally {
    await fs.unlink(tmpIn).catch(() => {});
    await fs.unlink(tmpOut).catch(() => {});
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractTitle(filename: string): string {
  return path.basename(filename, path.extname(filename))
    .replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * AI로 이력서 텍스트를 분석하여:
 * 1. 자기소개서 섹션을 분리
 * 2. 표 형태 데이터를 마크다운 테이블로 변환
 */
async function splitAndFormatWithAI(
  rawText: string
): Promise<{ resumeContent: string; coverLetter: string }> {
  const systemPrompt = `당신은 이력서 파싱 전문가입니다. 아래 텍스트에서 이력서 본문과 자기소개서를 분리하고, 표 형태 데이터를 마크다운 테이블로 변환하세요.

반환 형식 (JSON):
{
  "resumeContent": "이력서 본문 (자기소개서 완전 제외. 표는 마크다운 테이블로 변환)",
  "coverLetter":   "자기소개서 전체 텍스트 (없으면 빈 문자열)"
}

규칙:
1. 자기소개서: '자기소개서', '성장과정', '지원동기', '직무 역량', '입사 후 포부', '장단점' 등 서술형 에세이 섹션 전체를 coverLetter에 넣습니다. 이력서 본문에서는 완전히 제거합니다.
2. 마크다운 테이블: 스페이스로 정렬된 열 데이터(학력, 경력, 자격증 목록 등)를 | 헤더1 | 헤더2 | 형식으로 변환합니다.
3. 이력서 본문(resumeContent)은 마크다운 테이블과 일반 텍스트로만 구성하세요.
4. 오직 JSON만 반환하세요. 마크다운 코드 블록 없이.`;

  try {
    const ai = await getAI();
      const response = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: rawText.slice(0, 14000) },
      ],
      response_format: { type: "json_object" },
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(raw);
    return {
      resumeContent: typeof result.resumeContent === "string" ? resumeHtmlToText(result.resumeContent) : resumeHtmlToText(rawText),
      coverLetter:   typeof result.coverLetter   === "string" ? resumeHtmlToText(result.coverLetter)   : "",
    };
  } catch (err) {
    logger.warn({ err }, "AI split failed – using raw text as-is");
    return { resumeContent: resumeHtmlToText(rawText), coverLetter: "" };
  }
}

router.post("/resumes/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "파일을 첨부해주세요." });
    return;
  }

  // multer 파일명 Latin-1 → UTF-8 재인코딩 + macOS NFD → NFC 정규화
  const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8").normalize("NFC");
  const ext = path.extname(originalName).toLowerCase();
  let rawText = "";

  try {
    if (ext === ".pdf") {
      rawText = await parsePdf(req.file.buffer);
    } else if (ext === ".docx" || ext === ".doc") {
      rawText = await parseDocx(req.file.buffer);
    }
  } catch (err) {
    logger.error({ err }, "File parsing failed");
    res.status(422).json({ error: "파일 내용을 읽는 데 실패했습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다." });
    return;
  }

  const blankTextMessage =
    "파일에서 텍스트를 추출할 수 없습니다. 스캔된 이미지 PDF이거나 빈 파일일 수 있습니다.";

  // 텍스트가 비었거나 너무 짧으면(스캔/이미지 PDF 가능성) 비전 OCR로 폴백
  if (rawText.trim().length < 30) {
    if (ext === ".pdf") {
      logger.info("pdftotext returned blank/short text – falling back to vision OCR");
      try {
        const ocrText = await ocrPdfBuffer(req.file.buffer);
        if (ocrText.trim()) {
          logger.info("Vision OCR fallback succeeded");
          rawText = ocrText;
        } else {
          logger.warn("Vision OCR fallback returned empty text");
          res.status(422).json({ error: blankTextMessage });
          return;
        }
      } catch (err) {
        logger.error({ err }, "Vision OCR fallback failed");
        const message =
          err instanceof VisionOcrError && err.message ? err.message : blankTextMessage;
        res.status(422).json({ error: message });
        return;
      }
    } else {
      res.status(422).json({ error: blankTextMessage });
      return;
    }
  }

  // AI로 자기소개서 분리 + 표 마크다운 변환
  const { resumeContent, coverLetter } = await splitAndFormatWithAI(rawText);

  // macOS에서 생성된 PDF의 텍스트도 NFD일 수 있어 NFC로 정규화
  const normalizedContent = (resumeContent || rawText).normalize("NFC");
  const normalizedCoverLetter = coverLetter ? coverLetter.normalize("NFC") : null;

  const rawTitle = (req.body.title as string | undefined)?.trim().normalize("NFC");
  const title = (rawTitle || extractTitle(originalName)).normalize("NFC");

  const [resume] = await db.insert(resumesTable)
    .values({
      userId:      req.session.userId!,
      title,
      content:     normalizedContent,
      coverLetter: normalizedCoverLetter,
      photoUrl:    null,
      fileUrl:     null,
    })
    .returning();

  res.status(201).json({
    id:          resume.id,
    userId:      resume.userId,
    title:       resume.title,
    content:     resume.content     ?? null,
    coverLetter: resume.coverLetter ?? null,
    photoUrl:    resume.photoUrl    ?? null,
    fileUrl:     resume.fileUrl     ?? null,
    createdAt:   resume.createdAt.toISOString(),
  });

  // 업로드 성공 후 자동 커리어 분석 (fire-and-forget)
  startCareerAnalysis(resume.id).catch((err) => {
    logger.error({ err, resumeId: resume.id }, "Auto career analysis trigger failed");
  });
});

export default router;
