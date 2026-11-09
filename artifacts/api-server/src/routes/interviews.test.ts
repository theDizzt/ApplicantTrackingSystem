import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  selectResults: [] as unknown[][],
  insertResults: [] as unknown[][],
  aiCreate: vi.fn(),
  logError: vi.fn(),
  transcribeCreate: vi.fn(),
  getSetting: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  insertedValues: [] as unknown[],
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
    readFile: vi.fn(async () => Buffer.from("mock wav audio")),
    unlink: vi.fn(async () => {}),
  },
}));

vi.mock("openai", () => {
  class APIError extends Error {
    code?: string;

    constructor(message: string, code?: string) {
      super(message);
      this.code = code;
    }
  }

  class OpenAI {
    static APIError = APIError;
    audio = { transcriptions: { create: mocks.transcribeCreate } };
  }

  return {
    default: OpenAI,
    toFile: vi.fn(async (buffer: Buffer) => buffer),
  };
});

function query(result: unknown) {
  const promise = Promise.resolve(result);
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    values: vi.fn((values: unknown) => {
      mocks.insertedValues.push(values);
      return chain;
    }),
    set: vi.fn(() => chain),
    returning: vi.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
  return chain;
}

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: unknown, _res: unknown, next: () => void) => {
    (req as { session: { userId: number } }).session = {
      userId: Number((req as { header(name: string): string | undefined }).header("x-user-id") ?? 1),
    };
    next();
  },
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    update: mocks.update,
    delete: mocks.delete,
  },
  interviewSessionsTable: { id: "id", userId: "userId", resumeId: "resumeId", companyId: "companyId", createdAt: "createdAt" },
  interviewQuestionsTable: { id: "id", sessionId: "sessionId", order: "order" },
  analysesTable: { userId: "userId", resumeId: "resumeId", companyId: "companyId", status: "status", createdAt: "createdAt", richAnalysisResult: "richAnalysisResult" },
  resumesTable: { id: "id", userId: "userId", title: "title", content: "content", coverLetter: "coverLetter" },
  companiesTable: { id: "id", userId: "userId", name: "name", talentProfile: "talentProfile", jobDescription: "jobDescription" },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
}));

vi.mock("../lib/openai", () => ({
  DEFAULT_STT_MODEL: "whisper-1",
  getSetting: mocks.getSetting,
  getAI: async () => ({
    model: "test-model",
    openai: { chat: { completions: { create: mocks.aiCreate } } },
  }),
}));

import interviewsRouter from "./interviews";
import coverLetterRouter from "./cover-letter";

const createdAt = new Date("2025-01-02T03:04:05.000Z");
const session = {
  id: 11,
  userId: 1,
  resumeId: 21,
  companyId: 31,
  status: "questions_generated",
  overallScore: null,
  overallFeedback: null,
  createdAt,
  evaluatedAt: null,
};
const company = { name: "정확한 회사", talentProfile: "주도적으로 협업하는 인재", jobDescription: "Node.js API를 개발합니다" };

function makeApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.log = {
      error: mocks.logError,
      info: mocks.logInfo,
      warn: mocks.logWarn,
    } as unknown as typeof req.log;
    next();
  });
  app.use(express.json());
  app.use(interviewsRouter);
  app.use(coverLetterRouter);
  return app;
}

function setSelectResults(results: unknown[][]) {
  mocks.selectResults.splice(0, mocks.selectResults.length, ...results);
  mocks.select.mockImplementation(() => query(mocks.selectResults.shift() ?? []));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "test-api-key");
  vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", "https://ai.invalid/v1");
  mocks.selectResults.splice(0);
  mocks.insertResults.splice(0);
  mocks.insertedValues.splice(0);
  mocks.select.mockImplementation(() => query(mocks.selectResults.shift() ?? []));
  mocks.insert.mockImplementation(() => query(mocks.insertResults.shift() ?? []));
  mocks.update.mockImplementation(() => query([]));
  mocks.delete.mockImplementation(() => query([]));
  mocks.getSetting.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("interview routes", () => {
  it("returns authenticated-owner list and detail sessions with resume and company labels", async () => {
    const question = { id: 41, sessionId: 11, question: "경험을 설명해주세요", order: 1, answer: null, feedback: null, score: null };
    setSelectResults([
      [session],
      [session], [{ title: "백엔드 이력서" }], [company], [question],
      [session], [{ title: "백엔드 이력서" }], [company], [question],
    ]);

    const list = await request(makeApp()).get("/interviews").set("x-user-id", "1");
    expect(list.status).toBe(200);
    expect(list.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 11, resumeTitle: "백엔드 이력서", companyName: "정확한 회사" }),
    ]));

    const detail = await request(makeApp()).get("/interviews/11").set("x-user-id", "1");
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(expect.objectContaining({
      id: 11,
      resumeTitle: "백엔드 이력서",
      companyName: "정확한 회사",
      questions: [expect.objectContaining({ score: null })],
    }));
  });

  it("grounds generated questions in the selected company context", async () => {
    mocks.insertResults.push([session]);
    mocks.aiCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ questions: ["회사 맞춤 질문"] }) } }] });
    setSelectResults([
      [{ id: 21, userId: 1, title: "백엔드 이력서", content: "지원자 경력", coverLetter: null }],
      [company],
      [],
      [session], [{ title: "백엔드 이력서" }], [company], [],
    ]);

    const response = await request(makeApp()).post("/interviews").set("x-user-id", "1").send({ resumeId: 21, companyId: 31 });
    expect(response.status).toBe(201);
    const prompt = mocks.aiCreate.mock.calls[0][0].messages.map((message: { content: string }) => message.content).join("\n");
    expect(prompt).toContain("정확한 회사");
    expect(prompt).toContain("주도적으로 협업하는 인재");
    expect(prompt).toContain("Node.js API를 개발합니다");
  });

  it("adds one abstract-grounded question and strips HTML from the prompt", async () => {
    mocks.insertResults.push([session]);
    mocks.aiCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        questions: [
          { question: "직무 경험을 설명해 주세요.", source: "resume" },
          { question: "협업 경험은 무엇인가요?", source: "company" },
        ],
      }) } }],
    });
    setSelectResults([
      [{
        id: 21,
        userId: 1,
        title: "연구 이력서",
        content: "<p>머신러닝 연구</p>",
        coverLetter: null,
        careerAnalysisResult: JSON.stringify({
          papers: [{
            title: "추천 시스템 연구",
            authors: ["홍길동", "김연구"],
            venue: "한국정보과학회",
            abstract: "사용자 행동 시퀀스로 추천 정확도를 개선했다.",
          }],
        }),
      }],
      [company],
      [],
      [session], [{ title: "연구 이력서" }], [company], [],
    ]);

    const response = await request(makeApp()).post("/interviews").set("x-user-id", "1").send({ resumeId: 21, companyId: 31 });
    expect(response.status).toBe(201);
    const prompt = mocks.aiCreate.mock.calls[0][0].messages.map((message: { content: string }) => message.content).join("\n");
    expect(prompt).toContain("사용자 행동 시퀀스로 추천 정확도를 개선했다.");
    expect(prompt).not.toContain("<p>");
    const insertedQuestions = mocks.insertedValues.find((value) => Array.isArray(value)) as Array<{ question: string }> | undefined;
    const abstractItem = insertedQuestions?.find((item) => item.question.includes("Abstract"));
    expect(abstractItem?.question).toContain("사용자 행동 시퀀스로 추천 정확도를 개선했다.");
    expect(insertedQuestions).toHaveLength(5);
  });

  it("grounds evaluation in company context and does not evaluate another user's session", async () => {
    const answeredQuestion = {
      id: 41, sessionId: 11, question: "협업 경험은?", order: 1,
      answer: "팀과 적극적으로 협업했습니다.", feedback: null, score: null,
    };
    mocks.aiCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            overallScore: 88,
            overallFeedback: "직무와 기업 문화에 잘 맞습니다.",
            evaluations: [{ questionId: 41, score: 88, feedback: "구체적 사례를 더하면 좋습니다." }],
          }),
        },
      }],
    });
    setSelectResults([
      [session], [{ title: "백엔드 이력서" }], [company], [answeredQuestion],
      [company],
      [session], [{ title: "백엔드 이력서" }], [company], [answeredQuestion],
    ]);

    const evaluated = await request(makeApp()).post("/interviews/11/evaluate").set("x-user-id", "1");
    expect(evaluated.status).toBe(200);
    const prompt = mocks.aiCreate.mock.calls[0][0].messages.map((message: { content: string }) => message.content).join("\n");
    expect(prompt).toContain("정확한 회사");
    expect(prompt).toContain("주도적으로 협업하는 인재");
    expect(prompt).toContain("Node.js API를 개발합니다");

    setSelectResults([[]]);
    const foreignSession = await request(makeApp()).post("/interviews/11/evaluate").set("x-user-id", "2");
    expect(foreignSession.status).toBe(404);
    expect(mocks.aiCreate).toHaveBeenCalledTimes(1);
  });

  it("asks about weaknesses from the latest document review and keeps only real weakness focus labels", async () => {
    mocks.insertResults.push([session]);
    mocks.aiCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        questions: [
          { question: "클라우드 운영 경험이 부족하다는 우려를 어떻게 보완하시겠습니까?", source: "weakness", focus: "AWS 운영 경험 미충족" },
          { question: "지어낸 약점 질문입니다.", source: "weakness", focus: "존재하지 않는 약점" },
        ],
      }) } }],
    });
    setSelectResults([
      [{ id: 21, userId: 1, title: "백엔드 이력서", content: "지원자 경력", coverLetter: null }],
      [company],
      [{ richAnalysisResult: JSON.stringify({
        rejectionReport: { reasons: [{ title: "AWS 운영 경험 미충족", detail: "클라우드 운영 경험이 없습니다." }] },
      }) }],
      [session], [{ title: "백엔드 이력서" }], [company], [],
    ]);

    const response = await request(makeApp()).post("/interviews").set("x-user-id", "1").send({ resumeId: 21, companyId: 31 });
    expect(response.status).toBe(201);
    const prompt = mocks.aiCreate.mock.calls[0][0].messages.map((message: { content: string }) => message.content).join("\n");
    expect(prompt).toContain("AWS 운영 경험 미충족 — 클라우드 운영 경험이 없습니다.");
    const inserted = mocks.insertedValues.find((value) => Array.isArray(value)) as Array<{ question: string; focus: string | null }>;
    expect(inserted[0]).toEqual(expect.objectContaining({ focus: "AWS 운영 경험 미충족" }));
    expect(inserted[1]).toEqual(expect.objectContaining({ focus: null }));
  });

  it("creates a follow-up question for each evaluated answer and ignores existing follow-ups when checking completeness", async () => {
    const base = { id: 41, sessionId: 11, question: "협업 경험은?", order: 1, answer: "팀과 협업했습니다.", feedback: null, score: null, parentQuestionId: null, depth: 0, focus: null };
    const oldFollowUp = { id: 42, sessionId: 11, question: "이전 꼬리 질문", order: 1, answer: null, feedback: null, score: null, parentQuestionId: 41, depth: 1, focus: null };
    mocks.aiCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        overallScore: 70,
        overallFeedback: "구체성이 부족합니다.",
        evaluations: [{ questionId: 41, score: 70, feedback: "사례가 부족합니다.", followUp: "그 협업에서 본인이 맡은 역할은 무엇이었나요?" }],
      }) } }],
    });
    setSelectResults([
      [session], [{ title: "백엔드 이력서" }], [company], [base, oldFollowUp],
      [company],
      [session], [{ title: "백엔드 이력서" }], [company], [base],
    ]);

    const response = await request(makeApp()).post("/interviews/11/evaluate").set("x-user-id", "1");
    expect(response.status).toBe(200);
    const prompt = mocks.aiCreate.mock.calls[0][0].messages.map((message: { content: string }) => message.content).join("\n");
    expect(prompt).not.toContain("이전 꼬리 질문");
    expect(mocks.delete).toHaveBeenCalledTimes(1);
    expect(mocks.insertedValues).toContainEqual([
      expect.objectContaining({ question: "그 협업에서 본인이 맡은 역할은 무엇이었나요?", parentQuestionId: 41, depth: 1 }),
    ]);
  });

  it("evaluates a follow-up answer with the full question chain and adds a deeper follow-up", async () => {
    const base = { id: 41, sessionId: 11, question: "협업 경험은?", order: 1, answer: "팀과 협업했습니다.", feedback: "f", score: 70, parentQuestionId: null, depth: 0, focus: "협업 근거 부족" };
    const followUp = { id: 42, sessionId: 11, question: "맡은 역할은?", order: 1, answer: null, feedback: null, score: null, parentQuestionId: 41, depth: 1, focus: "협업 근거 부족" };
    mocks.aiCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 80, feedback: "역할이 분명합니다.", followUp: "갈등은 어떻게 풀었나요?" }) } }],
    });
    setSelectResults([
      [{ ...session, status: "evaluated" }], [{ title: "백엔드 이력서" }], [company], [base, followUp],
      [company],
      [{ ...session, status: "evaluated" }], [{ title: "백엔드 이력서" }], [company], [base, followUp],
    ]);

    const response = await request(makeApp()).post("/interviews/11/follow-ups/42/answer").set("x-user-id", "1").send({ answer: "API 설계를 맡았습니다." });
    expect(response.status).toBe(200);
    const prompt = mocks.aiCreate.mock.calls[0][0].messages.map((message: { content: string }) => message.content).join("\n");
    expect(prompt).toContain("기본 질문: 협업 경험은?\n답변: 팀과 협업했습니다.");
    expect(prompt).toContain("꼬리 질문 1: 맡은 역할은?\n답변: API 설계를 맡았습니다.");
    expect(prompt).toContain("확인하려는 약점: 협업 근거 부족");
    expect(mocks.insertedValues).toContainEqual(expect.objectContaining({ question: "갈등은 어떻게 풀었나요?", parentQuestionId: 42, depth: 2 }));
  });

  it("stops at the maximum follow-up depth and rejects base questions on the follow-up endpoint", async () => {
    const base = { id: 41, sessionId: 11, question: "Q", order: 1, answer: "A", feedback: "f", score: 70, parentQuestionId: null, depth: 0, focus: null };
    const deepest = { id: 43, sessionId: 11, question: "마지막 꼬리 질문", order: 1, answer: null, feedback: null, score: null, parentQuestionId: 41, depth: 2, focus: null };
    mocks.aiCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 60, feedback: "보완이 필요합니다.", followUp: "더 깊은 질문" }) } }],
    });
    setSelectResults([
      [session], [{ title: "백엔드 이력서" }], [company], [base, deepest],
      [company],
      [session], [{ title: "백엔드 이력서" }], [company], [base, deepest],
    ]);
    const response = await request(makeApp()).post("/interviews/11/follow-ups/43/answer").set("x-user-id", "1").send({ answer: "답변입니다." });
    expect(response.status).toBe(200);
    expect(mocks.insert).not.toHaveBeenCalled();

    setSelectResults([[session], [{ title: "백엔드 이력서" }], [company], [base]]);
    const notFollowUp = await request(makeApp()).post("/interviews/11/follow-ups/41/answer").set("x-user-id", "1").send({ answer: "답변" });
    expect(notFollowUp.status).toBe(404);
  });
});

describe("guided cover letter prompts", () => {
  const resume = {
    id: 21,
    userId: 1,
    title: "백엔드 이력서",
    content: "<div>Node.js API 개발</div>",
    coverLetter: "<h2>협업 경험</h2><p>팀과 &amp; 함께 문제를 해결했습니다.</p>",
  };

  it("does not expose or send another user's resume to AI", async () => {
    setSelectResults([[]]);

    const response = await request(makeApp())
      .post("/cover-letter/guided-prompts")
      .set("x-user-id", "2")
      .send({ resumeId: 21 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "이력서를 찾을 수 없습니다." });
    expect(mocks.aiCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "not-json"],
    ["an empty prompt list", JSON.stringify({ prompts: [] })],
  ])("falls back to safe prompts for %s", async (_label, content) => {
    setSelectResults([[resume]]);
    mocks.aiCreate.mockResolvedValue({ choices: [{ message: { content } }] });

    const response = await request(makeApp())
      .post("/cover-letter/guided-prompts")
      .set("x-user-id", "1")
      .send({ resumeId: 21 });

    expect(response.status).toBe(200);
    expect(response.body.prompts).toHaveLength(6);
    expect(new Set(response.body.prompts).size).toBe(6);
    expect(mocks.logInfo).toHaveBeenLastCalledWith({
      metric: "guided_prompt_generation",
      outcome: "fallback",
      model: "test-model",
      failureType: "invalid_response",
    }, "Guided prompt generation metric");
  });

  it("logs the error and falls back to safe prompts when the AI call fails", async () => {
    const error = new Error("AI service unavailable");
    setSelectResults([[resume]]);
    mocks.aiCreate.mockRejectedValue(error);

    const response = await request(makeApp())
      .post("/cover-letter/guided-prompts")
      .set("x-user-id", "1")
      .send({ resumeId: 21 });

    expect(response.status).toBe(200);
    expect(response.body.prompts).toHaveLength(6);
    expect(new Set(response.body.prompts).size).toBe(6);
    expect(mocks.logError).toHaveBeenCalledWith(
      { err: error, resumeId: 21 },
      "Failed to generate guided recording prompts",
    );
    expect(mocks.logWarn).toHaveBeenCalledWith({
      metric: "guided_prompt_generation",
      outcome: "fallback",
      model: "test-model",
      failureType: "unknown",
    }, "Guided prompt generation metric");
  });

  it("strips resume HTML and returns 6 to 8 unique questions", async () => {
    setSelectResults([[resume]]);
    mocks.aiCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            prompts: [
              "Node.js API 개발 경험을 구체적으로 이야기해 주세요.",
              "Node.js API 개발 경험을 구체적으로 이야기해 주세요.",
              { question: "팀과 문제를 해결한 협업 경험을 이야기해 주세요." },
              "짧음",
            ],
          }),
        },
      }],
    });

    const response = await request(makeApp())
      .post("/cover-letter/guided-prompts")
      .set("x-user-id", "1")
      .send({ resumeId: 21 });

    expect(response.status).toBe(200);
    expect(response.body.prompts.length).toBeGreaterThanOrEqual(6);
    expect(response.body.prompts.length).toBeLessThanOrEqual(8);
    expect(new Set(response.body.prompts).size).toBe(response.body.prompts.length);
    expect(mocks.logInfo).toHaveBeenLastCalledWith({
      metric: "guided_prompt_generation",
      outcome: "fallback",
      model: "test-model",
      failureType: "invalid_response",
    }, "Guided prompt generation metric");

    const prompt = mocks.aiCreate.mock.calls[0][0].messages
      .map((message: { content: string }) => message.content)
      .join("\n");
    expect(prompt).toContain("협업 경험\n팀과 & 함께 문제를 해결했습니다.");
    expect(prompt).toContain("Node.js API 개발");
    expect(prompt).not.toMatch(/<\/?[a-z][^>]*>/i);
  });


  it("records a generated outcome when AI returns enough valid questions", async () => {
    setSelectResults([[resume]]);
    mocks.aiCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            prompts: Array.from(
              { length: 6 },
              (_, index) => `지원 직무와 연결되는 경험 ${index + 1}을 구체적으로 이야기해 주세요.`,
            ),
          }),
        },
      }],
    });

    const response = await request(makeApp())
      .post("/cover-letter/guided-prompts")
      .set("x-user-id", "1")
      .send({ resumeId: 21 });

    expect(response.status).toBe(200);
    expect(mocks.logInfo).toHaveBeenLastCalledWith({
      metric: "guided_prompt_generation",
      outcome: "generated",
      model: "test-model",
      failureType: undefined,
    }, "Guided prompt generation metric");
  });
});

describe("cover letter audio generation", () => {
  it("rejects audio larger than 50MB with a clear 413 response", async () => {
    const response = await request(makeApp())
      .post("/cover-letter/generate")
      .set("x-user-id", "1")
      .attach("audio", Buffer.alloc(50 * 1024 * 1024 + 1), {
        filename: "recording.wav",
        contentType: "audio/wav",
      });

    expect(response.status).toBe(413);
    expect(response.body.error).toContain("50MB 이하");
    expect(mocks.transcribeCreate).not.toHaveBeenCalled();
  });

  it("rejects unsupported file formats with a clear 415 response", async () => {
    const response = await request(makeApp())
      .post("/cover-letter/generate")
      .set("x-user-id", "1")
      .attach("audio", Buffer.from("not audio"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(415);
    expect(response.body).toEqual({ error: "지원하지 않는 오디오 형식입니다." });
    expect(mocks.transcribeCreate).not.toHaveBeenCalled();
  });

  it("returns 422 guidance when the recognized speech is too short", async () => {
    mocks.transcribeCreate.mockResolvedValue({ text: "짧아요" });

    const response = await request(makeApp())
      .post("/cover-letter/generate")
      .set("x-user-id", "1")
      .attach("audio", Buffer.from("audio"), {
        filename: "recording.webm",
        contentType: "audio/webm",
      });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain("조금 더 길고 또렷하게");
    expect(mocks.aiCreate).not.toHaveBeenCalled();
  });

  it("retries with the default STT model when the configured model is unsupported", async () => {
    const OpenAI = (await import("openai")).default;
    const unsupportedModelError = Object.assign(
      Object.create(OpenAI.APIError.prototype) as InstanceType<typeof OpenAI.APIError>,
      { message: "model is not supported", code: "UNSUPPORTED_MODEL" },
    );
    mocks.getSetting.mockResolvedValue("configured-stt-model");
    mocks.transcribeCreate
      .mockRejectedValueOnce(unsupportedModelError)
      .mockResolvedValueOnce({ text: "충분히 길게 말한 자기소개서 원문입니다." });
    mocks.aiCreate.mockResolvedValue({
      choices: [{ message: { content: "## 성장배경\n작성된 자기소개서" } }],
    });

    const response = await request(makeApp())
      .post("/cover-letter/generate")
      .set("x-user-id", "1")
      .attach("audio", Buffer.from("audio"), {
        filename: "recording.webm",
        contentType: "audio/webm",
      });

    expect(response.status).toBe(200);
    expect(mocks.transcribeCreate).toHaveBeenCalledTimes(2);
    expect(mocks.transcribeCreate.mock.calls.map(([input]) => input.model))
      .toEqual(["configured-stt-model", "whisper-1"]);
  });
});
