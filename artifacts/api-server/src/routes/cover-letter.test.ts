import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  aiCreate: vi.fn(),
  getSetting: vi.fn(),
  logError: vi.fn(),
  transcribeCreate: vi.fn(),
  toFile: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFile: vi.fn((
    _file: string,
    _args: string[],
    _options: unknown,
    callback: (error: null, result: { stdout: string; stderr: string }) => void,
  ) => callback(null, { stdout: "", stderr: "" })),
}));

vi.mock("fs/promises", () => ({
  default: {
    writeFile: vi.fn(async () => {}),
    readFile: vi.fn(async () => Buffer.from("converted wav audio")),
    unlink: vi.fn(async () => {}),
  },
}));

vi.mock("openai", () => {
  class OpenAI {
    audio = { transcriptions: { create: mocks.transcribeCreate } };
  }

  return {
    default: OpenAI,
    toFile: mocks.toFile,
  };
});

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: unknown, _res: unknown, next: () => void) => {
    (req as { session: { userId: number } }).session = { userId: 1 };
    next();
  },
}));

vi.mock("@workspace/db", () => ({
  db: {},
  resumesTable: {},
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("../lib/openai", async () => {
  const { default: OpenAI } = await import("openai");
  return {
  DEFAULT_STT_MODEL: "whisper-1",
  createAIClient: (opts: unknown) => new (OpenAI as unknown as new (o: unknown) => unknown)(opts),
  getSetting: mocks.getSetting,
  getAI: async () => ({
    model: "test-model",
    openai: { chat: { completions: { create: mocks.aiCreate } } },
  }),
};
});

vi.mock("../lib/guided-prompt-monitor", () => ({
  recordGuidedPromptGeneration: vi.fn(),
}));

import coverLetterRouter from "./cover-letter";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.log = {
      error: mocks.logError,
      info: vi.fn(),
      warn: vi.fn(),
    } as unknown as typeof req.log;
    next();
  });
  app.use(coverLetterRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "test-api-key");
  vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", "https://ai.invalid/v1");
  mocks.getSetting.mockResolvedValue(null);
  mocks.toFile.mockImplementation(async (buffer: Buffer) => buffer);
  mocks.transcribeCreate.mockResolvedValue({
    text: "지원 직무에 필요한 경험을 충분히 설명한 음성 원문입니다.",
  });
  mocks.aiCreate.mockResolvedValue({
    choices: [{ message: { content: "## 성장배경\n완성된 자기소개서입니다." } }],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /cover-letter/generate contract", () => {
  it("passes an authenticated multipart audio upload through to transcription", async () => {
    const response = await request(makeApp())
      .post("/cover-letter/generate")
      .attach("audio", Buffer.from("browser audio"), {
        filename: "recording.webm",
        contentType: "audio/webm",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      transcript: "지원 직무에 필요한 경험을 충분히 설명한 음성 원문입니다.",
      coverLetter: "## 성장배경\n완성된 자기소개서입니다.",
    });
    expect(mocks.toFile).toHaveBeenCalledWith(
      Buffer.from("converted wav audio"),
      "recording.wav",
      { type: "audio/wav" },
    );
    expect(mocks.transcribeCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: "whisper-1",
      language: "ko",
    }));
  });

  it("rejects a nominally successful upstream response without transcript", async () => {
    mocks.transcribeCreate.mockResolvedValue({ text: undefined });

    const response = await request(makeApp())
      .post("/cover-letter/generate")
      .attach("audio", Buffer.from("browser audio"), {
        filename: "recording.webm",
        contentType: "audio/webm",
      });

    expect(response.status).toBe(502);
    expect(response.body).toHaveProperty("error");
    expect(mocks.aiCreate).not.toHaveBeenCalled();
  });

  it("rejects a nominally successful upstream response without coverLetter", async () => {
    mocks.aiCreate.mockResolvedValue({
      choices: [{ message: { content: undefined } }],
    });

    const response = await request(makeApp())
      .post("/cover-letter/generate")
      .attach("audio", Buffer.from("browser audio"), {
        filename: "recording.webm",
        contentType: "audio/webm",
      });

    expect(response.status).toBe(502);
    expect(response.body).toHaveProperty("error");
  });
});