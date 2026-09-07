import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { Router, type IRouter, type RequestHandler } from "express";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import { requireAuth } from "../middlewares/auth";
import { DEFAULT_STT_MODEL, getAI, getSetting } from "../lib/openai";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 10 * 60;
const ALLOWED_EXTENSIONS = new Set([".webm", ".wav", ".mp3", ".m4a", ".mp4", ".ogg", ".oga", ".aac", ".flac"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith("audio/") || ALLOWED_EXTENSIONS.has(extension)) callback(null, true);
    else callback(new Error("지원하지 않는 오디오 형식입니다."));
  },
});

const handleAudioUpload: RequestHandler = (req, res, next) => {
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
    req.log.warn({ err: error }, "Cover letter audio upload rejected");
    res.status(400).json({ error: "오디오 파일을 업로드하지 못했습니다." });
  });
};

function getTranscriptionClient(): OpenAI {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) throw new Error("음성 인식 서비스가 설정되지 않았습니다.");
  return new OpenAI({ apiKey, baseURL });
}

async function convertToWav(buffer: Buffer, originalName: string): Promise<Buffer> {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const inputExtension = path.extname(originalName).toLowerCase() || ".webm";
  const inputPath = path.join(os.tmpdir(), `cover_letter_${id}${inputExtension}`);
  const outputPath = path.join(os.tmpdir(), `cover_letter_${id}.wav`);
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

function cleanGeneratedText(value: string): string {
  return value
    .replace(/^```(?:markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

router.post(
  "/cover-letter/generate",
  requireAuth,
  handleAudioUpload,
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "녹음하거나 선택한 오디오 파일을 첨부해주세요." });
      return;
    }

    try {
      const wav = await convertToWav(req.file.buffer, req.file.originalname);
      const transcriptionClient = getTranscriptionClient();
      const sttModel = (await getSetting("ai_stt_model"))?.trim() || DEFAULT_STT_MODEL;
      const transcription = await transcriptionClient.audio.transcriptions.create({
        file: await toFile(wav, "recording.wav", { type: "audio/wav" }),
        model: sttModel,
        language: "ko",
        response_format: "json",
      });
      const transcript = transcription.text.trim();
      if (transcript.length < 10) {
        res.status(422).json({ error: "음성에서 충분한 내용을 인식하지 못했습니다. 조금 더 길고 또렷하게 녹음해주세요." });
        return;
      }

      const ai = await getAI();
      const completion = await ai.openai.chat.completions.create({
        model: ai.model,
        messages: [
          {
            role: "system",
            content: `당신은 한국 채용 시장의 전문 커리어 컨설턴트이자 자기소개서 작성 전문가입니다.
사용자가 말한 사실만 사용하고, 회사명·수치·성과·경력을 새로 만들어내지 마세요.
출력은 한국어 자기소개서 본문만 반환하고 설명, 코드 블록, 작성 메모는 포함하지 마세요.`,
          },
          {
            role: "user",
            content: `아래는 구직자의 음성을 변환한 원문입니다.

<음성원문>
${transcript.slice(0, 30000)}
</음성원문>

다음 조건으로 자기소개서를 작성하세요.
1. "## 성장배경", "## 경력 및 경험", "## 입사 후 포부" 세 부분으로 구성합니다.
2. 각 부분은 도입-본론-결론 또는 상황-행동-결과가 드러나는 자연스러운 3문단으로 작성합니다.
3. 이력서에 바로 사용할 수 있는 전문적이고 간결한 문체를 사용합니다.
4. 원문의 의미와 사실을 보존하면서 중복 표현과 구어체를 정리합니다.
5. 원문에 없는 정보는 추측하지 않습니다.
6. 전체 분량은 A4 1~2장 이내로 작성합니다.`,
          },
        ],
        max_completion_tokens: 8192,
      });
      const coverLetter = cleanGeneratedText(completion.choices[0]?.message?.content ?? "");
      if (!coverLetter) throw new Error("AI가 빈 자기소개서를 반환했습니다.");

      res.json({ transcript, coverLetter });
    } catch (error) {
      req.log.error({ err: error }, "Cover letter voice generation failed");
      res.status(502).json({
        error: error instanceof Error && error.message.includes("설정되지 않았습니다")
          ? error.message
          : "음성 변환 또는 자기소개서 생성을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.",
      });
    }
  },
);

export default router;