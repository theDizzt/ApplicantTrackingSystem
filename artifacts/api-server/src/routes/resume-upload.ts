import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import { db, resumesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Use memory storage so we don't write to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".pdf", ".doc", ".docx"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("PDF 또는 DOCX 파일만 업로드 가능합니다."));
    }
  },
});

async function parsePdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse = await import("pdf-parse" as any);
  const fn = pdfParse.default ?? pdfParse;
  const result = await fn(buffer);
  return result.text as string;
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractTitle(filename: string): string {
  return path.basename(filename, path.extname(filename))
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

router.post("/resumes/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "파일을 첨부해주세요." });
    return;
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  let extractedText = "";

  try {
    if (ext === ".pdf") {
      extractedText = await parsePdf(req.file.buffer);
    } else if (ext === ".docx" || ext === ".doc") {
      extractedText = await parseDocx(req.file.buffer);
    }
  } catch (err) {
    logger.error({ err }, "File parsing failed");
    res.status(422).json({ error: "파일 내용을 읽는 데 실패했습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다." });
    return;
  }

  if (!extractedText.trim()) {
    res.status(422).json({ error: "파일에서 텍스트를 추출할 수 없습니다. 스캔된 이미지 PDF이거나 빈 파일일 수 있습니다." });
    return;
  }

  const title = (req.body.title as string | undefined)?.trim() || extractTitle(req.file.originalname);

  const [resume] = await db.insert(resumesTable)
    .values({
      userId: req.session.userId!,
      title,
      content: extractedText,
      coverLetter: null,
      photoUrl: null,
      fileUrl: null,
    })
    .returning();

  res.status(201).json({
    id: resume.id,
    userId: resume.userId,
    title: resume.title,
    content: resume.content ?? null,
    coverLetter: resume.coverLetter ?? null,
    photoUrl: resume.photoUrl ?? null,
    fileUrl: resume.fileUrl ?? null,
    createdAt: resume.createdAt.toISOString(),
  });
});

export default router;
