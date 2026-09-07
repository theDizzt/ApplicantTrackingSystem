import express, { type Request } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkAIHealth, getAIHealthStatus, getDeliveryStatus } = vi.hoisted(() => ({
  checkAIHealth: vi.fn(),
  getAIHealthStatus: vi.fn(),
  getDeliveryStatus: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: {},
  analysesTable: {},
  organizationsTable: {},
}));

vi.mock("../lib/openai", () => ({
  DEFAULT_STT_MODEL: "test-stt-model",
  getAI: vi.fn(),
  getAIConfig: vi.fn(),
  getSetting: vi.fn(),
  saveSetting: vi.fn(),
  invalidateAICache: vi.fn(),
  checkAIHealth,
}));

vi.mock("../lib/ai-health-monitor", () => ({
  getAIHealthStatus,
}));

vi.mock("../lib/guided-prompt-monitor", () => ({
  getGuidedPromptDeliveryAdminStatus: getDeliveryStatus,
}));

import adminRouter from "./admin";

const noHistoryStatus = {
  windowMs: 3_600_000,
  total: 0,
  succeeded: 0,
  permanentFailures: 0,
  retriesExhausted: 0,
  failureRate: 0,
  consecutiveFailures: 0,
  successRate: null,
};

function makeApp(isAdmin: boolean) {
  const app = express();
  app.use((req, _res, next) => {
    (req as Request).session = { isAdmin } as Request["session"];
    next();
  });
  app.use(adminRouter);
  return app;
}

describe("admin AI health response contracts", () => {
  beforeEach(() => {
    checkAIHealth.mockReset();
    getAIHealthStatus.mockReset();
  });

  it("returns only the immediate healthy check fields", async () => {
    checkAIHealth.mockResolvedValue({
      ok: true,
      code: "ok",
      baseUrl: "http://internal-ai:11434/v1",
      authorization: "Bearer private-token",
      requestBody: { model: "private-model" },
      responseBody: { models: ["private-model"] },
    });

    const response = await request(makeApp(true)).get("/admin/settings/ai/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, code: "ok" });
  });

  it("returns only the immediate failed check fields needed by the admin screen", async () => {
    checkAIHealth.mockResolvedValue({
      ok: false,
      code: "unreachable",
      error: "AI 서버(http://internal-ai:11434)에 연결 실패: private response",
      url: "http://internal-ai:11434/v1/models",
      headers: { authorization: "Bearer private-token" },
      request: "private request",
      response: "private response",
    });

    const response = await request(makeApp(true)).get("/admin/settings/ai/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: false,
      code: "unreachable",
      error: "AI 서버에 연결할 수 없습니다. AI 설정과 서버 상태를 확인해주세요.",
    });
  });

  it("returns a fixed unchecked shape before the first periodic check", async () => {
    getAIHealthStatus.mockReturnValue(null);

    const response = await request(makeApp(true)).get("/admin/settings/ai/health-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ checked: false });
  });

  it("returns only the periodic healthy status fields", async () => {
    getAIHealthStatus.mockReturnValue({
      ok: true,
      code: "ok",
      checkedAt: "2026-09-07T01:00:00.000Z",
      downSince: null,
      baseUrl: "http://internal-ai:11434/v1",
      authorization: "Bearer private-token",
      responseBody: "private response",
    });

    const response = await request(makeApp(true)).get("/admin/settings/ai/health-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      checked: true,
      ok: true,
      code: "ok",
      checkedAt: "2026-09-07T01:00:00.000Z",
      downSince: null,
    });
  });

  it("returns only the periodic failed status fields needed by the banner", async () => {
    getAIHealthStatus.mockReturnValue({
      ok: false,
      code: "auth_error",
      error: "Bearer private-token 인증에 실패했습니다.",
      checkedAt: "2026-09-07T01:05:00.000Z",
      downSince: "2026-09-07T01:00:00.000Z",
      url: "http://internal-ai:11434/v1/models",
      headers: { authorization: "Bearer private-token" },
      requestBody: "private request",
      responseBody: "private response",
    });

    const response = await request(makeApp(true)).get("/admin/settings/ai/health-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      checked: true,
      ok: false,
      code: "auth_error",
      error: "AI API 키가 유효하지 않습니다. 관리자 페이지의 AI 설정을 확인해주세요.",
      checkedAt: "2026-09-07T01:05:00.000Z",
      downSince: "2026-09-07T01:00:00.000Z",
    });
  });
});

describe("admin alert delivery status contract", () => {
  beforeEach(() => {
    getDeliveryStatus.mockReset();
  });

  it("rejects non-admin requests", async () => {
    const response = await request(makeApp(false))
      .get("/admin/settings/alerts/delivery-status");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "관리자 권한이 필요합니다." });
    expect(getDeliveryStatus).not.toHaveBeenCalled();
  });

  it("returns a fixed unconfigured response containing only aggregate fields", async () => {
    getDeliveryStatus.mockReturnValue({
      ...noHistoryStatus,
      configured: false,
      webhookUrl: "https://secret.example/webhook",
      prompt: "private prompt",
      userId: 123,
      historyId: "private-history",
    });

    const response = await request(makeApp(true))
      .get("/admin/settings/alerts/delivery-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      configured: false,
      ...noHistoryStatus,
    });
    expect(Object.keys(response.body).sort()).toEqual([
      "configured",
      "consecutiveFailures",
      "failureRate",
      "permanentFailures",
      "retriesExhausted",
      "succeeded",
      "successRate",
      "total",
      "windowMs",
    ].sort());
  });

  it("returns the same fixed aggregate shape when configured with no history", async () => {
    getDeliveryStatus.mockReturnValue({
      ...noHistoryStatus,
      configured: true,
      resumeId: 456,
      deliveryHistory: [{ id: "private-delivery" }],
    });

    const response = await request(makeApp(true))
      .get("/admin/settings/alerts/delivery-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      configured: true,
      ...noHistoryStatus,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /webhook|prompt|userId|resumeId|history|private/i,
    );
  });

  it("allows only aggregate and latest-outcome fields when delivery history exists", async () => {
    getDeliveryStatus.mockReturnValue({
      configured: true,
      windowMs: 3_600_000,
      total: 2,
      succeeded: 1,
      permanentFailures: 1,
      retriesExhausted: 0,
      failureRate: 0.5,
      consecutiveFailures: 1,
      lastOutcome: "permanent_failure",
      lastDeliveryAt: "2026-09-07T00:00:00.000Z",
      successRate: 0.5,
      eventId: "private-event",
      user: { id: 789 },
    });

    const response = await request(makeApp(true))
      .get("/admin/settings/alerts/delivery-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      configured: true,
      windowMs: 3_600_000,
      total: 2,
      succeeded: 1,
      permanentFailures: 1,
      retriesExhausted: 0,
      failureRate: 0.5,
      consecutiveFailures: 1,
      lastOutcome: "permanent_failure",
      lastDeliveryAt: "2026-09-07T00:00:00.000Z",
      successRate: 0.5,
    });
  });
});