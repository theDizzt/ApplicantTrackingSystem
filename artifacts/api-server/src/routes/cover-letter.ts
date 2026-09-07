import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { Router, type IRouter, type RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import { db, resumesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { DEFAULT_STT_MODEL, getAI, getSetting } from "../lib/openai";
import { resumeHtmlToText } from "../lib/resume-text";

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

async function transcribeAudio(
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

const FALLBACK_GUIDED_PROMPTS = [
  "지금까지 어떤 환경에서 살아왔고, 그 과정에서 형성된 가치관은 무엇인지 이야기해 주세요.",
  "학교생활에서 가장 기억에 남는 경험과 그 경험을 통해 배운 점을 이야기해 주세요.",
  "지금까지 겪은 가장 어려운 일은 무엇이었으며, 어떻게 해결했는지 구체적으로 이야기해 주세요.",
  "본인의 강점이 잘 드러났던 경험과 그 강점을 지원 업무에서 어떻게 활용할지 이야기해 주세요.",
  "지원한 회사와 직무를 선택한 이유, 그리고 입사를 위해 준비해 온 내용을 이야기해 주세요.",
  "입사 후 어떤 방식으로 일하고 성장하며 회사에 기여하고 싶은지 이야기해 주세요.",
];

function parseGuidedPrompts(content: string): string[] {
  try {
    const parsed = JSON.parse(content) as { prompts?: unknown[] };
    const prompts = Array.isArray(parsed.prompts) ? parsed.prompts : [];
    return [...new Set(prompts
      .map(item => typeof item === "string"
        ? item
        : typeof (item as { question?: unknown })?.question === "string"
          ? (item as { question: string }).question
          : "")
      .map(question => question.trim())
      .filter(question => question.length >= 10))]
      .slice(0, 8);
  } catch {
    return [];
  }
}

router.post("/cover-letter/guided-prompts", requireAuth, async (req, res): Promise<void> => {
  const resumeId = Number(req.body?.resumeId);
  if (!Number.isInteger(resumeId) || resumeId <= 0) {
    res.status(400).json({ error: "질문을 만들 이력서를 선택해주세요." });
    return;
  }

  const [resume] = await db.select().from(resumesTable).where(and(
    eq(resumesTable.id, resumeId),
    eq(resumesTable.userId, req.session.userId!),
  ));
  if (!resume) {
    res.status(404).json({ error: "이력서를 찾을 수 없습니다." });
    return;
  }

  const coverLetterText = resumeHtmlToText(resume.coverLetter);
  const resumeText = resumeHtmlToText(resume.content);
  if (!coverLetterText && !resumeText) {
    res.status(422).json({ error: "선택한 이력서에 분석할 내용이 없습니다. 이력서 내용을 먼저 작성해주세요." });
    return;
  }

  try {
    const ai = await getAI();
    const response = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: "system",
          content: `당신은 한국 취업 준비생이 자기소개서에 쓸 경험을 편안하게 말하도록 돕는 전문 커리어 코치입니다.
제공된 이력서와 기존 자기소개서를 분석해 음성 녹음용 질문을 6~8개 만드세요.
기존 자기소개서 내용에 연결되는 후속 질문을 최우선으로 하고, 그 다음 이력서의 학력·경력·프로젝트·성과·지원 방향을 활용하세요.
성장 과정, 학교생활, 어려움을 해결한 경험, 강점과 역량, 지원 동기, 입사 후 일하는 방식과 포부가 고르게 드러나야 합니다.
이력서에 구체적인 사실이 있으면 그 사실을 직접 언급해 더 자세한 상황·행동·결과를 말하도록 질문하세요.
정보가 없는 주제는 사실을 지어내거나 단정하지 말고, 사용자가 자유롭게 경험을 꺼낼 수 있는 질문으로 작성하세요.
한 질문에는 한 가지 주제만 담고, 사용자가 그대로 듣고 답하기 쉬운 존댓말을 사용하세요.
반드시 JSON 형식으로만 반환하세요: { "prompts": ["질문 1", "질문 2"] }`,
        },
        {
          role: "user",
          content: `이력서 제목: ${resume.title}

기존 자기소개서(가장 우선해서 질문에 반영):
${coverLetterText || "(작성된 자기소개서 없음)"}

이력서 내용:
${resumeText || "(작성된 이력서 본문 없음)"}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 3000,
    });

    const generated = parseGuidedPrompts(response.choices[0]?.message?.content ?? "{}");
    const prompts = [...generated];
    let usedFallback = false;
    for (const fallback of FALLBACK_GUIDED_PROMPTS) {
      if (prompts.length >= 6) break;
      if (!prompts.includes(fallback)) {
        prompts.push(fallback);
        usedFallback = true;
      }
    }
    res.json({ prompts: prompts.slice(0, 8), usedFallback });
  } catch (error) {
    req.log.error({ err: error, resumeId }, "Failed to generate guided recording prompts");
    res.json({ prompts: FALLBACK_GUIDED_PROMPTS, usedFallback: true });
  }
});

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
      const transcription = await transcribeAudio(transcriptionClient, wav, sttModel);
      if (transcription.usedModel !== sttModel) {
        req.log.warn(
          { configuredModel: sttModel, fallbackModel: transcription.usedModel },
          "Configured STT model unsupported; used default model",
        );
      }
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