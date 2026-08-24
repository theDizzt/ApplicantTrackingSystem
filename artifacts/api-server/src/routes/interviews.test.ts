import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  selectResults: [] as unknown[][],
  insertResults: [] as unknown[][],
  aiCreate: vi.fn(),
}));

function query(result: unknown) {
  const promise = Promise.resolve(result);
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    values: vi.fn(() => chain),
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
  },
  interviewSessionsTable: { id: "id", userId: "userId", resumeId: "resumeId", companyId: "companyId", createdAt: "createdAt" },
  interviewQuestionsTable: { id: "id", sessionId: "sessionId", order: "order" },
  resumesTable: { id: "id", userId: "userId", title: "title" },
  companiesTable: { id: "id", userId: "userId", name: "name", talentProfile: "talentProfile", jobDescription: "jobDescription" },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
}));

vi.mock("../lib/openai", () => ({
  getAI: async () => ({
    model: "test-model",
    openai: { chat: { completions: { create: mocks.aiCreate } } },
  }),
}));

import interviewsRouter from "./interviews";

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
  app.use(express.json());
  app.use(interviewsRouter);
  return app;
}

function setSelectResults(results: unknown[][]) {
  mocks.selectResults.splice(0, mocks.selectResults.length, ...results);
  mocks.select.mockImplementation(() => query(mocks.selectResults.shift() ?? []));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectResults.splice(0);
  mocks.insertResults.splice(0);
  mocks.select.mockImplementation(() => query(mocks.selectResults.shift() ?? []));
  mocks.insert.mockImplementation(() => query(mocks.insertResults.shift() ?? []));
  mocks.update.mockImplementation(() => query([]));
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
      [session], [{ title: "백엔드 이력서" }], [company], [],
    ]);

    const response = await request(makeApp()).post("/interviews").set("x-user-id", "1").send({ resumeId: 21, companyId: 31 });
    expect(response.status).toBe(201);
    const prompt = mocks.aiCreate.mock.calls[0][0].messages.map((message: { content: string }) => message.content).join("\n");
    expect(prompt).toContain("정확한 회사");
    expect(prompt).toContain("주도적으로 협업하는 인재");
    expect(prompt).toContain("Node.js API를 개발합니다");
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
});