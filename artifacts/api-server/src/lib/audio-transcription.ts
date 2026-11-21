// 음성 업로드 → WAV 변환 → STT. 음성 자기소개서와 실시간 면접이 함께 쓴다.
import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import type { RequestHandler } from "express";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import { DEFAULT_STT_MODEL, createAIClient, getSetting } from "./openai";

const execFileAsync = promisify(execFile);
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 10 * 60;
const MAX_CONCURRENT_AUDIO_JOBS = 2;
const ALLOWED_EXTENSIONS = new Set([".webm", ".wav", ".mp3", ".m4a", ".mp4", ".ogg", ".oga", ".aac", ".flac"]);
let activeAudioJobs = 0;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith("audio/") || ALLOWED_EXTENSIONS.has(extension)) callback(null, true);
    else callback(new Error("지원하지 않는 오디오 형식입니다."));
  },
});

/** multipart의 `audio` 필드 하나를 받아 req.file에 둔다. 크기·형식 오류는 413·415로 알린다. */
export const handleAudioUpload: RequestHandler = (req, res, next) => {
  upload.single("audio")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "오디오 파일은 50MB 이하만 업로드할 수 있습니다." });
      return;
    }
    if (error instanceof Error && error.message === "지원하지 않는 오디오 형식입니다.") {
      res.status(415).json({ error: error.message });
      return;
    }
    req.log.warn({ err: error }, "Audio upload rejected");
    res.status(400).json({ error: "오디오 파일을 업로드하지 못했습니다." });
  });
};

/** ffmpeg·STT 작업이 서버를 막지 않도록 동시에 처리하는 음성 작업 수를 제한한다. */
export const limitConcurrentAudioJobs: RequestHandler = (_req, res, next) => {
  if (activeAudioJobs >= MAX_CONCURRENT_AUDIO_JOBS) {
    res.setHeader("Retry-After", "15");
    res.status(429).json({ error: "현재 음성 처리가 많습니다. 잠시 후 다시 시도해주세요." });
    return;
  }

  activeAudioJobs += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeAudioJobs = Math.max(0, activeAudioJobs - 1);
  };
  res.once("finish", release);
  res.once("close", release);
  next();
};

function getTranscriptionClient(): OpenAI {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) throw new Error("음성 인식 서비스가 설정되지 않았습니다.");
  return createAIClient({ apiKey, baseURL });
}

async function convertToWav(buffer: Buffer, originalName: string): Promise<Buffer> {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const inputExtension = path.extname(originalName).toLowerCase() || ".webm";
  const inputPath = path.join(os.tmpdir(), `audio_${id}${inputExtension}`);
  const outputPath = path.join(os.tmpdir(), `audio_${id}.wav`);
  try {
    await fs.writeFile(inputPath, buffer);
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", inputPath,
      "-t", String(MAX_AUDIO_SECONDS),
      "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
      outputPath,
    ], { maxBuffer: 1024 * 1024, timeout: 90_000 });
    const wav = await fs.readFile(outputPath);
    if (wav.length > MAX_AUDIO_BYTES) throw new Error("변환된 오디오가 허용 크기를 초과했습니다.");
    return wav;
  } finally {
    await Promise.all([
      fs.unlink(inputPath).catch(() => {}),
      fs.unlink(outputPath).catch(() => {}),
    ]);
  }
}

async function transcribeWav(
  client: OpenAI,
  wav: Buffer,
  model: string,
): Promise<{ text: string; usedModel: string }> {
  const transcribe = async (selectedModel: string) => client.audio.transcriptions.create({
    file: await toFile(wav, "recording.wav", { type: "audio/wav" }),
    model: selectedModel,
    language: "ko",
    response_format: "json",
  });

  try {
    const result = await transcribe(model);
    return { text: result.text, usedModel: model };
  } catch (error) {
    const unsupportedModel =
      error instanceof OpenAI.APIError &&
      (error.code === "UNSUPPORTED_MODEL" || error.message.toLowerCase().includes("not supported"));
    if (!unsupportedModel || model === DEFAULT_STT_MODEL) throw error;

    const result = await transcribe(DEFAULT_STT_MODEL);
    return { text: result.text, usedModel: DEFAULT_STT_MODEL };
  }
}

/**
 * 업로드된 오디오를 한국어 텍스트로 옮긴다. 관리자가 정한 STT 모델을 쓰고,
 * 그 모델을 지원하지 않으면 기본 모델로 다시 시도한다(경고 로그).
 */
export async function transcribeUpload(
  file: { buffer: Buffer; originalname: string },
  log: { warn: (obj: object, msg: string) => void },
): Promise<string> {
  const wav = await convertToWav(file.buffer, file.originalname);
  const client = getTranscriptionClient();
  const sttModel = (await getSetting("ai_stt_model"))?.trim() || DEFAULT_STT_MODEL;
  const transcription = await transcribeWav(client, wav, sttModel);
  if (transcription.usedModel !== sttModel) {
    log.warn(
      { configuredModel: sttModel, fallbackModel: transcription.usedModel },
      "Configured STT model unsupported; used default model",
    );
  }
  return transcription.text.trim();
}
