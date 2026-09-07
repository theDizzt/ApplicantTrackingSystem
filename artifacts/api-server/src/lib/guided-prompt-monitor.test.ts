import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "@workspace/db";
import {
  createInMemoryGuidedPromptMonitorStore,
  createPostgresGuidedPromptMonitorStore,
  getGuidedPromptAlertConfig,
  getGuidedPromptDeliveryAdminStatus,
  getGuidedPromptDeliveryStatus,
  recordGuidedPromptGeneration as recordGuidedPromptGenerationWithStore,
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

let store: ReturnType<typeof createInMemoryGuidedPromptMonitorStore>;

function recordGuidedPromptGeneration(
  event: Parameters<typeof recordGuidedPromptGenerationWithStore>[0],
  eventLogger: Parameters<typeof recordGuidedPromptGenerationWithStore>[1],
  now: number,
  alertConfig: GuidedPromptAlertConfig,
) {
  return recordGuidedPromptGenerationWithStore(event, eventLogger, now, alertConfig, store);
}

describe("guided prompt generation monitor", () => {
  beforeEach(() => {
    resetGuidedPromptMonitorForTests();
    store = createInMemoryGuidedPromptMonitorStore();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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

      const payload = JSON.parse((fetch as any).mock.calls[0][1].body);
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

  it("returns an admin-safe configured status and an explicit no-history state", () => {
    const status = getGuidedPromptDeliveryAdminStatus(1_000, config);

    expect(status).toEqual(expect.objectContaining({
      configured: true,
      total: 0,
      successRate: null,
      consecutiveFailures: 0,
    }));
    expect(JSON.stringify(status)).not.toContain(config.webhookUrl);
    expect(status).not.toHaveProperty("webhookUrl");
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

  it("records one flapping event when health transitions repeatedly within the configured window", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response)
      .mockResolvedValue({ ok: true, status: 200 } as Response);
    const flappingConfig = {
      ...config,
      cooldownMs: 0,
      minSamples: 1,
      deliveryConsecutiveFailureThreshold: 1,
      deliveryMinSamples: 10,
      deliveryFlappingWindowMs: 10_000,
      deliveryFlappingTransitionThreshold: 4,
      deliveryFlappingCooldownMs: 60_000,
    };

    for (let index = 0; index < 4; index += 1) {
      vi.setSystemTime(10_000 + index * 1_000);
      await recordGuidedPromptGeneration(
        { outcome: "fallback", failureType: "timeout" },
        logger,
        1_000 + index,
        flappingConfig,
      );
      await waitForGuidedPromptAlertDeliveriesForTests();
    }

    const flappingEvents = logger.error.mock.calls
      .filter((call: any[]) => call[0].operationalEvent === "guided_prompt_alert_channel_flapping");
    expect(flappingEvents).toEqual([[
      {
        operationalEvent: "guided_prompt_alert_channel_flapping",
        windowMs: 10_000,
        transitionCount: 4,
        transitionThreshold: 4,
        currentState: "recovered",
      },
      "Guided prompt alert channel is repeatedly changing health state",
    ]]);
    expect(JSON.stringify(flappingEvents)).not.toContain(config.webhookUrl);
    expect(JSON.stringify(flappingEvents)).not.toMatch(/userId|resumeId|resume|content/);
    vi.useRealTimers();
  });

  it("detects repeated channel degradation and recovery with the default operational settings", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GUIDED_PROMPT_ALERT_WEBHOOK_URL", "https://alerts.example.test/hook");
    const defaultConfig = getGuidedPromptAlertConfig();
    const deliveryOutcomes = [false, false, false, true, false, false, false, true];
    let deliveryIndex = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      const ok = deliveryOutcomes[deliveryIndex++]!;
      return { ok, status: ok ? 200 : 400 } as Response;
    });

    expect(defaultConfig).toMatchObject({
      cooldownMs: 30 * 60_000,
      deliveryConsecutiveFailureThreshold: 3,
      deliveryFlappingWindowMs: 3 * 60 * 60_000,
      deliveryFlappingTransitionThreshold: 4,
    });

    for (let batch = 0; batch < deliveryOutcomes.length; batch += 1) {
      const now = batch * 30 * 60_000;
      vi.setSystemTime(now);
      for (let sample = 0; sample < 5; sample += 1) {
        await recordGuidedPromptGeneration(
          { outcome: "fallback", failureType: "timeout" },
          logger,
          now,
          defaultConfig,
        );
      }
      await waitForGuidedPromptAlertDeliveriesForTests();
    }

    const flappingEvents = logger.error.mock.calls
      .filter((call: any[]) => call[0].operationalEvent === "guided_prompt_alert_channel_flapping");
    expect(fetch).toHaveBeenCalledTimes(8);
    expect(flappingEvents).toEqual([[
      {
        operationalEvent: "guided_prompt_alert_channel_flapping",
        windowMs: 3 * 60 * 60_000,
        transitionCount: 4,
        transitionThreshold: 4,
        currentState: "recovered",
      },
      "Guided prompt alert channel is repeatedly changing health state",
    ]]);
    vi.useRealTimers();
  });

  it("drops old health transitions and suppresses repeated flapping events during cooldown", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response)
      .mockResolvedValue({ ok: true, status: 200 } as Response);
    const flappingConfig = {
      ...config,
      cooldownMs: 0,
      minSamples: 1,
      deliveryConsecutiveFailureThreshold: 1,
      deliveryMinSamples: 10,
      deliveryHealthCooldownMs: 0,
      deliveryFlappingWindowMs: 5_000,
      deliveryFlappingTransitionThreshold: 3,
      deliveryFlappingCooldownMs: 60_000,
    };

    const times = [1_000, 2_000, 10_000, 11_000, 12_000, 13_000];
    for (const [index, time] of times.entries()) {
      vi.setSystemTime(time);
      await recordGuidedPromptGeneration(
        { outcome: "fallback", failureType: "timeout" },
        logger,
        index + 1,
        flappingConfig,
      );
      await waitForGuidedPromptAlertDeliveriesForTests();
    }

    const flappingEvents = logger.error.mock.calls
      .filter((call: any[]) => call[0].operationalEvent === "guided_prompt_alert_channel_flapping");
    expect(flappingEvents).toHaveLength(1);
    expect(flappingEvents[0][0]).toMatchObject({
      transitionCount: 3,
      currentState: "degraded",
    });
    vi.useRealTimers();
  });

  it("does not count repeated failures during one continuous degradation as health transitions", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 400 } as Response);
    const continuousFailureConfig = {
      ...config,
      cooldownMs: 0,
      minSamples: 1,
      deliveryConsecutiveFailureThreshold: 1,
      deliveryMinSamples: 10,
      deliveryHealthCooldownMs: 0,
      deliveryFlappingWindowMs: 60_000,
      deliveryFlappingTransitionThreshold: 2,
      deliveryFlappingCooldownMs: 0,
    };

    for (let index = 0; index < 4; index += 1) {
      vi.setSystemTime(1_000 + index * 1_000);
      await recordGuidedPromptGeneration(
        { outcome: "fallback", failureType: "timeout" },
        logger,
        index + 1,
        continuousFailureConfig,
      );
      await waitForGuidedPromptAlertDeliveriesForTests();
    }

    expect(logger.error.mock.calls
      .filter((call: any[]) => call[0].operationalEvent === "guided_prompt_alert_channel_flapping"))
      .toHaveLength(0);
    expect(logger.error.mock.calls
      .filter((call: any[]) => call[0].operationalEvent === "guided_prompt_alert_channel_degraded"))
      .toHaveLength(1);
    vi.useRealTimers();
  });
});

describe("guided prompt PostgreSQL monitor store", () => {
  beforeEach(() => {
    resetGuidedPromptMonitorForTests();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("shares concurrent counts and cooldown state without storing user or resume data", async () => {
    const schema = `guided_prompt_clock_test_${process.pid}`;
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${schema}"`);
    await pool.query(
      `CREATE TABLE "${schema}".guided_prompt_generation_events (
         id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
         occurred_at timestamptz NOT NULL,
         outcome text NOT NULL,
         failure_type text
       );
       CREATE TABLE "${schema}".guided_prompt_alert_states (
         reason_key text PRIMARY KEY,
         last_alerted_at timestamptz NOT NULL
       );`,
    );
    const PoolConstructor = pool.constructor as unknown as new (
      config: { connectionString?: string; options?: string; max?: number },
    ) => typeof pool;
    const testPool = new PoolConstructor({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema}`,
      max: 2,
    });

    try {
      const firstInstance = createPostgresGuidedPromptMonitorStore(testPool);
      const secondInstance = createPostgresGuidedPromptMonitorStore(testPool);
      const now = Date.now();

      await Promise.all([
        recordGuidedPromptGenerationWithStore(
          { outcome: "fallback", failureType: "rate_limit" },
          logger,
          now,
          config,
          firstInstance,
        ),
        recordGuidedPromptGenerationWithStore(
          { outcome: "fallback", failureType: "rate_limit" },
          logger,
          now,
          config,
          secondInstance,
        ),
      ]);

      const restartedInstance = createPostgresGuidedPromptMonitorStore(testPool);
      await recordGuidedPromptGenerationWithStore(
        { outcome: "fallback", failureType: "rate_limit" },
        logger,
        now + 1,
        config,
        restartedInstance,
      );
      await waitForGuidedPromptAlertDeliveriesForTests();

      expect(fetch).toHaveBeenCalledOnce();
      const payload = JSON.parse((fetch as any).mock.calls[0][1].body);
      expect(payload.summary).toMatchObject({ total: 2, fallback: 2 });

      const columns = await testPool.query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'guided_prompt_generation_events'
         ORDER BY ordinal_position`,
        [schema],
      );
      expect(columns.rows.map(row => row.column_name)).toEqual([
        "id",
        "occurred_at",
        "outcome",
        "failure_type",
      ]);
    } finally {
      await testPool.end();
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
  });

  it("uses the PostgreSQL clock for event windows despite opposite instance clock skew", async () => {
    const schema = `guided_prompt_clock_test_${process.pid}`;
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${schema}"`);
    await pool.query(
      `CREATE TABLE "${schema}".guided_prompt_generation_events (
         id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
         occurred_at timestamptz NOT NULL,
         outcome text NOT NULL,
         failure_type text
       );
       CREATE TABLE "${schema}".guided_prompt_alert_states (
         reason_key text PRIMARY KEY,
         last_alerted_at timestamptz NOT NULL
       );`,
    );
    const PoolConstructor = pool.constructor as unknown as new (
      config: { connectionString?: string; options?: string; max?: number },
    ) => typeof pool;
    const testPool = new PoolConstructor({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema}`,
      max: 2,
    });

    try {
      const firstInstance = createPostgresGuidedPromptMonitorStore(testPool);
      const secondInstance = createPostgresGuidedPromptMonitorStore(testPool);
      const oneHour = 60 * 60_000;

      await recordGuidedPromptGenerationWithStore(
        { outcome: "fallback", failureType: "rate_limit" },
        logger,
        Date.now() - oneHour,
        config,
        firstInstance,
      );
      await recordGuidedPromptGenerationWithStore(
        { outcome: "fallback", failureType: "rate_limit" },
        logger,
        Date.now() + oneHour,
        config,
        secondInstance,
      );
      await waitForGuidedPromptAlertDeliveriesForTests();

      expect(fetch).toHaveBeenCalledOnce();
      const payload = JSON.parse((fetch as any).mock.calls[0][1].body);
      expect(payload.summary).toMatchObject({ total: 2, fallback: 2 });
      expect(Math.abs(Date.parse(payload.window.endedAt) - Date.now())).toBeLessThan(10_000);

      const timestamps = await testPool.query<{ skew_ms: string }>(
        `SELECT EXTRACT(EPOCH FROM (MAX(occurred_at) - MIN(occurred_at))) * 1000 AS skew_ms
         FROM guided_prompt_generation_events`,
      );
      expect(Number(timestamps.rows[0]!.skew_ms)).toBeLessThan(10_000);
    } finally {
      await testPool.end();
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
  });

  it("uses inclusive PostgreSQL window and cooldown boundaries", async () => {
    const databaseNow = new Date("2026-09-07T12:00:00.000Z");
    const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        queries.push({ sql, values });
        if (sql === "SELECT clock_timestamp() AS now") return { rows: [{ now: databaseNow }] };
        if (sql.includes("COUNT(*)::text")) {
          return {
            rows: [{
              total: "2", generated: "0", fallback: "2",
              authentication: "0", rate_limit: "2", timeout: "0",
              upstream: "0", invalid_response: "0", unknown: "0",
            }],
          };
        }
        if (sql.includes("RETURNING reason_key")) return { rows: [{ reason_key: "x" }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const boundaryStore = createPostgresGuidedPromptMonitorStore({
      connect: vi.fn().mockResolvedValue(client),
    } as any);

    const result = await boundaryStore.recordAndClaimAlerts(
      { at: databaseNow.getTime() + 60 * 60_000, outcome: "fallback", failureType: "rate_limit" },
      config,
    );

    const aggregate = queries.find(query => query.sql.includes("COUNT(*)::text"))!;
    expect(aggregate.sql).toContain("occurred_at >= $1 AND occurred_at <= $2");
    expect(aggregate.values).toEqual([
      new Date(databaseNow.getTime() - config.windowMs),
      databaseNow,
    ]);
    const cooldownClaim = queries.find(query => query.sql.includes("RETURNING reason_key"))!;
    expect(cooldownClaim.sql).toContain("last_alerted_at <= $3");
    expect(cooldownClaim.values?.[2]).toEqual(
      new Date(databaseNow.getTime() - config.cooldownMs),
    );
    expect(result.evaluatedAt).toBe(databaseNow.getTime());
  });
});
