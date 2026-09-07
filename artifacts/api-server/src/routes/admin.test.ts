import express, { type Request } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDeliveryStatus } = vi.hoisted(() => ({
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
  checkAIHealth: vi.fn(),
}));

vi.mock("../lib/ai-health-monitor", () => ({
  getAIHealthStatus: vi.fn(),
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