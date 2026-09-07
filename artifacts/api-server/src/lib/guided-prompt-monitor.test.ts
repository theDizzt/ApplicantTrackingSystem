import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordGuidedPromptGeneration,
  resetGuidedPromptMonitorForTests,
  type GuidedPromptAlertConfig,
} from "./guided-prompt-monitor";

const config: GuidedPromptAlertConfig = {
  webhookUrl: "https://alerts.example.test/hook",
  windowMs: 60_000,
  cooldownMs: 120_000,
  minSamples: 2,
  fallbackRateThreshold: 0.5,
  failureThresholds: {
    authentication: 3,
    rate_limit: 2,
    timeout: 2,
    upstream: 2,
    invalid_response: 3,
    unknown: 3,
  },
};

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as any;

describe("guided prompt generation monitor", () => {
  beforeEach(() => {
    resetGuidedPromptMonitorForTests();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("calculates the generated/fallback ratio for the configured time window", async () => {
    await recordGuidedPromptGeneration({ outcome: "generated" }, logger, 1_000, config);
    await recordGuidedPromptGeneration(
      { outcome: "fallback", failureType: "invalid_response" },
      logger,
      2_000,
      config,
    );

    expect(fetch).toHaveBeenCalledOnce();
    const payload = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(payload.summary).toMatchObject({
      total: 2,
      generated: 1,
      fallback: 1,
      generatedRate: 0.5,
      fallbackRate: 0.5,
    });
  });

  it("alerts on a configured failure threshold and omits user data and content", async () => {
    await recordGuidedPromptGeneration(
      { outcome: "fallback", failureType: "rate_limit" },
      logger,
      1_000,
      config,
    );
    await recordGuidedPromptGeneration(
      { outcome: "fallback", failureType: "rate_limit" },
      logger,
      2_000,
      config,
    );

    const payload = JSON.parse((fetch as any).mock.calls[0][1].body as string);
    expect(payload.reasons).toContainEqual({
      kind: "failure_count",
      failureType: "rate_limit",
      actual: 2,
      threshold: 2,
    });
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("resumeId");
    expect(payload).not.toHaveProperty("resume");
    expect(payload).not.toHaveProperty("content");
  });

  it("does not repeat the same alert during its cooldown", async () => {
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 1_000, config);
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 2_000, config);
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 3_000, config);

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("drops events outside the time window", async () => {
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "upstream" }, logger, 1_000, config);
    await recordGuidedPromptGeneration({ outcome: "generated" }, logger, 62_000, config);

    expect(fetch).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenLastCalledWith(expect.objectContaining({
      total: 1,
      generated: 1,
      fallback: 0,
    }), "Guided prompt generation window metric");
  });
});