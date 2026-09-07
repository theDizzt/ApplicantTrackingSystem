import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGuidedPromptDeliveryStatus,
  recordGuidedPromptGeneration,
  resetGuidedPromptMonitorForTests,
  waitForGuidedPromptAlertDeliveriesForTests,
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
    await waitForGuidedPromptAlertDeliveriesForTests();

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
    await waitForGuidedPromptAlertDeliveriesForTests();

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
    await waitForGuidedPromptAlertDeliveriesForTests();

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

  it("returns before webhook delivery completes", async () => {
    let resolveFetch!: (value: { ok: boolean; status: number }) => void;
    vi.mocked(fetch).mockReturnValue(new Promise(resolve => {
      resolveFetch = resolve as typeof resolveFetch;
    }) as ReturnType<typeof fetch>);

    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 1_000, config);
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 2_000, config);

    expect(fetch).toHaveBeenCalledOnce();
    resolveFetch({ ok: true, status: 200 });
    await waitForGuidedPromptAlertDeliveriesForTests();
  });

  it("retries network errors and 5xx responses with bounded exponential backoff", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("temporary network failure"))
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "upstream" }, logger, 1_000, config);
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "upstream" }, logger, 2_000, config);
    await vi.runAllTimersAsync();
    await waitForGuidedPromptAlertDeliveriesForTests();

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(logger.error).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("does not retry permanent responses and records a structured operational event", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 400 } as Response);

    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "rate_limit" }, logger, 1_000, config);
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "rate_limit" }, logger, 2_000, config);
    await waitForGuidedPromptAlertDeliveriesForTests();

    expect(fetch).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
      operationalEvent: "guided_prompt_alert_delivery_failed",
      failureKind: "permanent_http_response",
      statusCode: 400,
      attempts: 1,
    }), "Guided prompt alert webhook permanently rejected");
  });

  it("records retry exhaustion without logging payload or user content", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);

    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "upstream" }, logger, 1_000, config);
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "upstream" }, logger, 2_000, config);
    await vi.runAllTimersAsync();
    await waitForGuidedPromptAlertDeliveriesForTests();

    expect(fetch).toHaveBeenCalledTimes(3);
    const event = logger.error.mock.calls[0][0];
    expect(event).toEqual({
      operationalEvent: "guided_prompt_alert_delivery_failed",
      failureKind: "retries_exhausted",
      statusCode: 503,
      attempts: 3,
    });
    expect(JSON.stringify(event)).not.toMatch(/userId|resumeId|resume|content/);
    vi.useRealTimers();
  });

  it("aggregates successful, permanent, and exhausted deliveries without sensitive data", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response);

    const noCooldown = { ...config, cooldownMs: 0 };
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 1_000, noCooldown);
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 2_000, noCooldown);
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 3_000, noCooldown);
    await waitForGuidedPromptAlertDeliveriesForTests();

    expect(getGuidedPromptDeliveryStatus()).toMatchObject({
      total: 2,
      succeeded: 1,
      permanentFailures: 1,
      retriesExhausted: 0,
      failureRate: 0.5,
      consecutiveFailures: 1,
      lastOutcome: "permanent_failure",
    });
    const metrics = logger.info.mock.calls
      .filter((call: any[]) => call[0].metric === "guided_prompt_alert_delivery_window")
      .map((call: any[]) => call[0]);
    expect(metrics).toHaveLength(2);
    expect(JSON.stringify(metrics)).not.toContain(config.webhookUrl);
    expect(JSON.stringify(metrics)).not.toMatch(/userId|resumeId|resume|content/);
  });

  it("emits independent channel health visibility after consecutive failures", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 400 } as Response);
    const healthConfig = {
      ...config,
      cooldownMs: 0,
      deliveryConsecutiveFailureThreshold: 2,
      deliveryMinSamples: 10,
    };

    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 1_000, healthConfig);
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 2_000, healthConfig);
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 3_000, healthConfig);
    await waitForGuidedPromptAlertDeliveriesForTests();

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
      operationalEvent: "guided_prompt_alert_channel_degraded",
      status: expect.objectContaining({
        permanentFailures: 2,
        consecutiveFailures: 2,
      }),
    }), "Guided prompt alert channel health threshold exceeded");
    const degradedEvent = logger.error.mock.calls
      .find((call: any[]) => call[0].operationalEvent === "guided_prompt_alert_channel_degraded")?.[0];
    expect(JSON.stringify(degradedEvent)).not.toContain(config.webhookUrl);
  });

  it("emits one recovery event on the first success after degradation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response)
      .mockResolvedValue({ ok: true, status: 200 } as Response);
    const healthConfig = {
      ...config,
      cooldownMs: 0,
      deliveryConsecutiveFailureThreshold: 2,
      deliveryMinSamples: 10,
    };

    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 1_000, healthConfig);
    await waitForGuidedPromptAlertDeliveriesForTests();
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 2_000, healthConfig);
    await waitForGuidedPromptAlertDeliveriesForTests();
    vi.setSystemTime(12_000);
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 3_000, healthConfig);
    await waitForGuidedPromptAlertDeliveriesForTests();
    vi.setSystemTime(15_000);
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 4_000, healthConfig);
    await waitForGuidedPromptAlertDeliveriesForTests();
    vi.setSystemTime(16_000);
    await recordGuidedPromptGeneration({ outcome: "fallback", failureType: "timeout" }, logger, 5_000, healthConfig);
    await waitForGuidedPromptAlertDeliveriesForTests();

    const recoveryEvents = logger.info.mock.calls
      .filter((call: any[]) => call[0].operationalEvent === "guided_prompt_alert_channel_recovered");
    expect(recoveryEvents).toEqual([[
      {
        operationalEvent: "guided_prompt_alert_channel_recovered",
        outageDurationMs: 4_000,
        failures: {
          permanentFailures: 2,
          retriesExhausted: 0,
          total: 2,
        },
      },
      "Guided prompt alert channel recovered",
    ]]);
    expect(JSON.stringify(recoveryEvents)).not.toContain(config.webhookUrl);
    expect(JSON.stringify(recoveryEvents)).not.toMatch(/userId|resumeId|resume|content/);
    vi.useRealTimers();
  });
});
