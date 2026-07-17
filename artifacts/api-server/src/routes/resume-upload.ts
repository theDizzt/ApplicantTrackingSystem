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

const execFileAsync = promisify(execFile);

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
  // Use system pdftotext (poppler-utils) — reliable across all Node.js versions
  const tmpIn = path.join(os.tmpdir(), `resume_${Date.now()}.pdf`);
  const tmpOut = path.join(os.tmpdir(), `resume_${Date.now()}.txt`);
  try {
    await fs.writeFile(tmpIn, buffer);
    // -enc UTF-8  — output encoding
    // -layout    — preserve layout spacing
    // tmpOut     — write to file (stdout doesn't handle binary well)
    await execFileAsync("pdftotext", ["-enc", "UTF-8", "-layout", tmpIn, tmpOut]);
    const text = await fs.readFile(tmpOut, "utf-8");
    return text;
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
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

router.post("/resumes/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "파일을 첨부해주세요." });
    return;
  }

  // multer receives multipart filenames as Latin-1; re-encode to UTF-8 so
  // Korean (and any non-ASCII) characters are not garbled.
  const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
  const ext = path.extname(originalName).toLowerCase();
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

  const title = (req.body.title as string | undefined)?.trim() || extractTitle(originalName);

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
