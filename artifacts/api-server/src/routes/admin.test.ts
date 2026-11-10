import express, { type Request } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  checkAIHealth,
  getAIConfig,
  getAIHealthStatus,
  getDeliveryStatus,
  getSetting,
} = vi.hoisted(() => ({
  checkAIHealth: vi.fn(),
  getAIConfig: vi.fn(),
  getAIHealthStatus: vi.fn(),
  getDeliveryStatus: vi.fn(),
  getSetting: vi.fn(),
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
  getAIConfig,
  getSetting,
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

const aiSettingsKeys = [
  "apiKeyMasked",
  "hasApiKey",
  "baseUrl",
  "model",
  "sttModel",
  "apiKey2Masked",
  "hasApiKey2",
  "baseUrl2",
  "model2",
  "apiKey3Masked",
  "hasApiKey3",
  "baseUrl3",
  "model3",
  "modelInterview",
  "modelLight",
  "modelVision",
  "embeddingModel",
].sort();

describe("admin AI settings response contract", () => {
  beforeEach(() => {
    getAIConfig.mockReset();
    getSetting.mockReset();
  });

  it("rejects non-admin requests before reading AI settings", async () => {
    const response = await request(makeApp(false)).get("/admin/settings/ai");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "관리자 권한이 필요합니다." });
    expect(getAIConfig).not.toHaveBeenCalled();
    expect(getSetting).not.toHaveBeenCalled();
  });

  it("returns the fixed empty-settings shape without any API key field", async () => {
    getAIConfig.mockResolvedValue({
      apiKey: "",
      baseUrl: undefined,
      model: "default-model",
    });
    getSetting.mockResolvedValue(undefined);

    const response = await request(makeApp(true)).get("/admin/settings/ai");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      apiKeyMasked: "",
      hasApiKey: false,
      baseUrl: "",
      model: "default-model",
      sttModel: "test-stt-model",
      apiKey2Masked: "",
      hasApiKey2: false,
      baseUrl2: "",
      model2: "",
      apiKey3Masked: "",
      hasApiKey3: false,
      baseUrl3: "",
      model3: "",
      modelInterview: "",
      modelLight: "",
      modelVision: "",
      embeddingModel: "",
    });
    expect(Object.keys(response.body).sort()).toEqual(aiSettingsKeys);
    expect(response.body).not.toHaveProperty("apiKey");
    expect(response.body).not.toHaveProperty("apiKey2");
    expect(response.body).not.toHaveProperty("apiKey3");
  });

  it("returns only masked keys and allowlisted fields for primary and secondary models", async () => {
    const secrets = {
      primary: "primary-secret-api-key",
      secondary2: "secondary-two-secret-key",
      secondary3: "secondary-three-secret-key",
    };
    getAIConfig.mockResolvedValue({
      apiKey: secrets.primary,
      baseUrl: "https://primary.example/v1",
      model: "primary-model",
      internalCredential: secrets.primary,
    });
    const settings: Record<string, string> = {
      ai_stt_model: "custom-stt-model",
      ai2_api_key: secrets.secondary2,
      ai2_base_url: "https://secondary-two.example/v1",
      ai2_model: "secondary-model-2",
      ai3_api_key: secrets.secondary3,
      ai3_base_url: "https://secondary-three.example/v1",
      ai3_model: "secondary-model-3",
      ai_model_interview: "interview-model",
      ai_model_light: "light-model",
      ai_model_vision: "vision-model",
      ai_embedding_model: "embedding-model",
    };
    getSetting.mockImplementation(async (key: string) => settings[key]);

    const response = await request(makeApp(true)).get("/admin/settings/ai");
    const serialized = JSON.stringify(response.body);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      apiKeyMasked: "primar…-key",
      hasApiKey: true,
      baseUrl: "https://primary.example/v1",
      model: "primary-model",
      sttModel: "custom-stt-model",
      apiKey2Masked: "second…-key",
      hasApiKey2: true,
      baseUrl2: "https://secondary-two.example/v1",
      model2: "secondary-model-2",
      apiKey3Masked: "second…-key",
      hasApiKey3: true,
      baseUrl3: "https://secondary-three.example/v1",
      model3: "secondary-model-3",
      modelInterview: "interview-model",
      modelLight: "light-model",
      modelVision: "vision-model",
      embeddingModel: "embedding-model",
    });
    expect(Object.keys(response.body).sort()).toEqual(aiSettingsKeys);
    expect(serialized).not.toContain(secrets.primary);
    expect(serialized).not.toContain(secrets.secondary2);
    expect(serialized).not.toContain(secrets.secondary3);
    expect(serialized).not.toContain("internalCredential");
  });

  it("fully redacts short primary and secondary API keys", async () => {
    const secrets = {
      primary: "short-key",
      secondary2: "tiny",
      secondary3: "1234567890",
    };
    getAIConfig.mockResolvedValue({
      apiKey: secrets.primary,
      baseUrl: undefined,
      model: "primary-model",
    });
    const settings: Record<string, string> = {
      ai2_api_key: secrets.secondary2,
      ai3_api_key: secrets.secondary3,
    };
    getSetting.mockImplementation(async (key: string) => settings[key]);

    const response = await request(makeApp(true)).get("/admin/settings/ai");
    const serialized = JSON.stringify(response.body);

    expect(response.status).toBe(200);
    expect(response.body.apiKeyMasked).toBe("••••••••");
    expect(response.body.apiKey2Masked).toBe("••••••••");
    expect(response.body.apiKey3Masked).toBe("••••••••");
    expect(response.body.hasApiKey).toBe(true);
    expect(response.body.hasApiKey2).toBe(true);
    expect(response.body.hasApiKey3).toBe(true);
    expect(Object.keys(response.body).sort()).toEqual(aiSettingsKeys);
    expect(serialized).not.toContain(secrets.primary);
    expect(serialized).not.toContain(secrets.secondary2);
    expect(serialized).not.toContain(secrets.secondary3);
  });
});

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