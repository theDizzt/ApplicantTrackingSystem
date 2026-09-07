import { pool } from "@workspace/db";
import type { Logger } from "pino";

export type GuidedPromptFailureType =
  | "authentication"
  | "rate_limit"
  | "timeout"
  | "upstream"
  | "invalid_response"
  | "unknown";

type Outcome = "generated" | "fallback";
type Event = { at: number; outcome: Outcome; failureType?: GuidedPromptFailureType };

const GENERATION_BUCKET_MS = 60_000;
type AlertReason =
  | { kind: "fallback_rate"; actual: number; threshold: number }
  | { kind: "failure_count"; failureType: GuidedPromptFailureType; actual: number; threshold: number };

export type GuidedPromptAlertConfig = {
  webhookUrl?: string;
  windowMs: number;
  cooldownMs: number;
  minSamples: number;
  fallbackRateThreshold: number;
  failureThresholds: Record<GuidedPromptFailureType, number>;
  deliveryWindowMs?: number;
  deliveryMinSamples?: number;
  deliveryFailureRateThreshold?: number;
  deliveryConsecutiveFailureThreshold?: number;
  deliveryHealthCooldownMs?: number;
  deliveryFlappingWindowMs?: number;
  deliveryFlappingTransitionThreshold?: number;
  deliveryFlappingCooldownMs?: number;
};

export type GuidedPromptMonitorStore = {
  recordAndClaimAlerts(
    event: Event,
    config: GuidedPromptAlertConfig,
  ): Promise<{
    summary: ReturnType<typeof summarize>;
    actionable: AlertReason[];
    evaluatedAt: number;
    outboxPersisted: boolean;
  }>;
};
const pendingDeliveries = new Set<Promise<void>>();
type DeliveryOutcome = "success" | "permanent_failure" | "retries_exhausted";
type DeliveryEvent = { at: number; outcome: DeliveryOutcome; attempts: number };
const deliveryEvents: DeliveryEvent[] = [];
let consecutiveDeliveryFailures = 0;
let lastDeliveryHealthAlertAt = -Infinity;
type DeliveryDegradation = {
  startedAt: number;
  permanentFailures: number;
  retriesExhausted: number;
};
let deliveryDegradation: DeliveryDegradation | undefined;

let deliveryHealthState: "healthy" | "degraded" = "healthy";
const deliveryHealthTransitions: { at: number; state: "degraded" | "recovered" }[] = [];
const WEBHOOK_MAX_ATTEMPTS = 3;
const WEBHOOK_RETRY_BASE_MS = 250;
const WEBHOOK_TIMEOUT_MS = 5_000;

const OUTBOX_TTL_MS = 24 * 60 * 60_000;
type AlertPayload = {
  event: "guided_prompt_generation_alert";
  window: { durationMs: number; endedAt: string };
  summary: ReturnType<typeof summarize>;
  reasons: AlertReason[];
};

type OutboxItem = {
  id: string;
  payload: AlertPayload;
  attempts: number;
  expiresAt: Date;
  leaseToken: string;
};
function readNumber(name: string, fallback: number, minimum = 0): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
}


export function getGuidedPromptAlertConfig(): GuidedPromptAlertConfig {
  return {
    webhookUrl: process.env.GUIDED_PROMPT_ALERT_WEBHOOK_URL?.trim() || undefined,
    windowMs: readNumber("GUIDED_PROMPT_ALERT_WINDOW_MS", 15 * 60_000, 1),
    cooldownMs: readNumber("GUIDED_PROMPT_ALERT_COOLDOWN_MS", 30 * 60_000, 0),
    minSamples: Math.floor(readNumber("GUIDED_PROMPT_ALERT_MIN_SAMPLES", 10, 1)),
    fallbackRateThreshold: readNumber("GUIDED_PROMPT_ALERT_FALLBACK_RATE", 0.3, 0),
    failureThresholds: {
      authentication: Math.floor(readNumber("GUIDED_PROMPT_ALERT_AUTHENTICATION_COUNT", 3, 1)),
      rate_limit: Math.floor(readNumber("GUIDED_PROMPT_ALERT_RATE_LIMIT_COUNT", 5, 1)),
      timeout: Math.floor(readNumber("GUIDED_PROMPT_ALERT_TIMEOUT_COUNT", 5, 1)),
      upstream: Math.floor(readNumber("GUIDED_PROMPT_ALERT_UPSTREAM_COUNT", 5, 1)),
      invalid_response: Math.floor(readNumber("GUIDED_PROMPT_ALERT_INVALID_RESPONSE_COUNT", 5, 1)),
      unknown: Math.floor(readNumber("GUIDED_PROMPT_ALERT_UNKNOWN_COUNT", 5, 1)),
    },
    deliveryWindowMs: readNumber("GUIDED_PROMPT_DELIVERY_WINDOW_MS", 60 * 60_000, 1),
    deliveryMinSamples: Math.floor(readNumber("GUIDED_PROMPT_DELIVERY_MIN_SAMPLES", 5, 1)),
    deliveryFailureRateThreshold: readNumber("GUIDED_PROMPT_DELIVERY_FAILURE_RATE", 0.5, 0),
    deliveryConsecutiveFailureThreshold: Math.floor(
      readNumber("GUIDED_PROMPT_DELIVERY_CONSECUTIVE_FAILURES", 3, 1),
    ),
    deliveryHealthCooldownMs: readNumber("GUIDED_PROMPT_DELIVERY_HEALTH_COOLDOWN_MS", 30 * 60_000, 0),
    deliveryFlappingWindowMs: readNumber("GUIDED_PROMPT_DELIVERY_FLAPPING_WINDOW_MS", 3 * 60 * 60_000, 1),
    deliveryFlappingTransitionThreshold: Math.floor(
      readNumber("GUIDED_PROMPT_DELIVERY_FLAPPING_TRANSITIONS", 4, 2),
    ),
    deliveryFlappingCooldownMs: readNumber(
      "GUIDED_PROMPT_DELIVERY_FLAPPING_COOLDOWN_MS",
      30 * 60_000,
      0,
    ),
  };
}

export type GuidedPromptDeliveryStatus = {
  windowMs: number;
  total: number;
  succeeded: number;
  permanentFailures: number;
  retriesExhausted: number;
  failureRate: number;
  consecutiveFailures: number;
  lastOutcome?: DeliveryOutcome;
  lastDeliveryAt?: string;
};

export type GuidedPromptDeliveryAdminStatus = GuidedPromptDeliveryStatus & {
  configured: boolean;
  successRate: number | null;
};

function getDeliverySettings(config: GuidedPromptAlertConfig) {
  return {
    windowMs: config.deliveryWindowMs ?? 60 * 60_000,
    minSamples: config.deliveryMinSamples ?? 5,
    failureRateThreshold: config.deliveryFailureRateThreshold ?? 0.5,
    consecutiveFailureThreshold: config.deliveryConsecutiveFailureThreshold ?? 3,
    healthCooldownMs: config.deliveryHealthCooldownMs ?? 30 * 60_000,
  };
}

function recordDeliveryHealthTransition(
  state: "degraded" | "recovered",
  now: number,
  logger: Logger,
  config: GuidedPromptAlertConfig,
): void {
  const windowMs = config.deliveryFlappingWindowMs ?? 3 * 60 * 60_000;
  const transitionThreshold = config.deliveryFlappingTransitionThreshold ?? 4;
  const cooldownMs = config.deliveryFlappingCooldownMs ?? 30 * 60_000;
  deliveryHealthTransitions.push({ at: now, state });
  const cutoff = now - windowMs;
  while (deliveryHealthTransitions[0]?.at < cutoff) deliveryHealthTransitions.shift();

  const transitionCount = deliveryHealthTransitions.length;
  if (
    transitionCount < transitionThreshold ||
    now - lastDeliveryFlappingAlertAt < cooldownMs
  ) return;

  lastDeliveryFlappingAlertAt = now;
  logger.error({
    operationalEvent: "guided_prompt_alert_channel_flapping",
    windowMs,
    transitionCount,
    transitionThreshold,
    currentState: state,
  }, "Guided prompt alert channel is repeatedly changing health state");
}
export function getGuidedPromptDeliveryStatus(
  now = Date.now(),
  config = getGuidedPromptAlertConfig(),
): GuidedPromptDeliveryStatus {
  const { windowMs } = getDeliverySettings(config);
  const cutoff = now - windowMs;
  while (deliveryEvents[0]?.at < cutoff) deliveryEvents.shift();
  const succeeded = deliveryEvents.filter(event => event.outcome === "success").length;
  const permanentFailures = deliveryEvents.filter(event => event.outcome === "permanent_failure").length;
  const retriesExhausted = deliveryEvents.filter(event => event.outcome === "retries_exhausted").length;
  const total = deliveryEvents.length;
  const latest = deliveryEvents.at(-1);
  return {
    windowMs,
    total,
    succeeded,
    permanentFailures,
    retriesExhausted,
    failureRate: total ? (permanentFailures + retriesExhausted) / total : 0,
    consecutiveFailures: consecutiveDeliveryFailures,
    ...(latest ? {
      lastOutcome: latest.outcome,
      lastDeliveryAt: new Date(latest.at).toISOString(),
    } : {}),
  };
}

export function getGuidedPromptDeliveryAdminStatus(
  now = Date.now(),
  config = getGuidedPromptAlertConfig(),
): GuidedPromptDeliveryAdminStatus {
  const status = getGuidedPromptDeliveryStatus(now, config);
  return {
    configured: Boolean(config.webhookUrl),
    ...status,
    successRate: status.total ? status.succeeded / status.total : null,
  };
}

function recordDeliveryOutcome(
  outcome: DeliveryOutcome,
  attempts: number,
  logger: Logger,
  config: GuidedPromptAlertConfig,
): void {
  const now = Date.now();
  deliveryEvents.push({ at: now, outcome, attempts });
  consecutiveDeliveryFailures = outcome === "success" ? 0 : consecutiveDeliveryFailures + 1;
  const status = getGuidedPromptDeliveryStatus(now, config);
  logger.info({
    metric: "guided_prompt_alert_delivery_window",
    ...status,
  }, "Guided prompt alert delivery window metric");

  const settings = getDeliverySettings(config);
  const consecutiveThresholdExceeded =
    status.consecutiveFailures >= settings.consecutiveFailureThreshold;
  const failureRateThresholdExceeded =
    status.total >= settings.minSamples &&
    status.failureRate >= settings.failureRateThreshold;

  if (outcome === "success" && deliveryHealthState === "degraded" && deliveryDegradation) {
    deliveryHealthState = "healthy";
    logger.info({
      operationalEvent: "guided_prompt_alert_channel_recovered",
      outageDurationMs: Math.max(0, now - deliveryDegradation.startedAt),
      failures: {
        permanentFailures: deliveryDegradation.permanentFailures,
        retriesExhausted: deliveryDegradation.retriesExhausted,
        total: deliveryDegradation.permanentFailures + deliveryDegradation.retriesExhausted,
      },
    }, "Guided prompt alert channel recovered");
    deliveryDegradation = undefined;
    recordDeliveryHealthTransition("recovered", now, logger, config);
  }

  if (
    outcome !== "success" &&
    (consecutiveThresholdExceeded || failureRateThresholdExceeded) &&
    deliveryHealthState === "healthy"
  ) {
    deliveryHealthState = "degraded";
    deliveryDegradation = {
      startedAt: now,
      permanentFailures: 1,
      retriesExhausted: 0,
      ...(outcome === "retries_exhausted" ? {
        permanentFailures: 0,
        retriesExhausted: 1,
      } : {}),
    };
    recordDeliveryHealthTransition("degraded", now, logger, config);
    if (now - lastDeliveryHealthAlertAt >= settings.healthCooldownMs) {
      lastDeliveryHealthAlertAt = now;
      logger.error({
        operationalEvent: "guided_prompt_alert_channel_degraded",
        status,
        thresholds: {
          minSamples: settings.minSamples,
          failureRate: settings.failureRateThreshold,
          consecutiveFailures: settings.consecutiveFailureThreshold,
        },
      }, "Guided prompt alert channel health threshold exceeded");
    }
  } else if (outcome !== "success" && deliveryDegradation) {
    if (outcome === "permanent_failure") deliveryDegradation.permanentFailures += 1;
    if (outcome === "retries_exhausted") deliveryDegradation.retriesExhausted += 1;
  }
}

function summarize(windowEvents: Event[]) {
  const generated = windowEvents.filter(event => event.outcome === "generated").length;
  const fallback = windowEvents.length - generated;
  const failures = Object.fromEntries(
    (["authentication", "rate_limit", "timeout", "upstream", "invalid_response", "unknown"] as const)
      .map(type => [type, windowEvents.filter(event => event.failureType === type).length]),
  ) as Record<GuidedPromptFailureType, number>;
  return {
    total: windowEvents.length,
    generated,
    fallback,
    generatedRate: windowEvents.length ? generated / windowEvents.length : 0,
    fallbackRate: windowEvents.length ? fallback / windowEvents.length : 0,
    failures,
  };
}

async function processOutbox(logger: Logger, now = new Date()): Promise<void> {
  if (workerRunning) return;
  workerRunning = true;
  try {
    const expired = await outbox.discardExpired(now);
    if (expired) {
      logger.warn({ operationalEvent: "guided_prompt_alerts_expired", count: expired },
        "Expired guided prompt alerts removed");
    }

    for (;;) {
      const item = await outbox.claim(now);
      if (!item) break;
      const webhookUrl = deliveryWebhookUrl ?? getGuidedPromptAlertConfig().webhookUrl;
      if (!webhookUrl) {
        await outbox.retry(
          item.id,
          item.leaseToken,
          item.attempts,
          new Date(now.getTime() + OUTBOX_POLL_MS),
        );
        break;
      }

      let response: Response | undefined;
      try {
        response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(item.payload),
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        });
      } catch {
        // Network errors are retried below without persisting error details.
      }

      const attempt = item.attempts + 1;
      const config = activeDeliveryConfig ?? getGuidedPromptAlertConfig();
      if (response?.ok) {
        const completed = await outbox.complete(item.id, item.leaseToken);
        if (!completed) continue;
        recordDeliveryOutcome("success", attempt, logger, config);
        logger.warn({
          alert: "guided_prompt_generation",
          reasons: item.payload.reasons,
          windowMs: item.payload.window.durationMs,
          summary: item.payload.summary,
          deliveryAttempts: attempt,
        }, "Guided prompt generation threshold exceeded");
      } else if (response && response.status < 500) {
        const completed = await outbox.complete(item.id, item.leaseToken);
        if (!completed) continue;
        recordDeliveryOutcome("permanent_failure", attempt, logger, config);
        logger.error({
          operationalEvent: "guided_prompt_alert_delivery_failed",
          failureKind: "permanent_http_response",
          statusCode: response.status,
          attempts: attempt,
        }, "Guided prompt alert webhook permanently rejected");
      } else if (attempt >= WEBHOOK_MAX_ATTEMPTS || item.expiresAt <= now) {
        const completed = await outbox.complete(item.id, item.leaseToken);
        if (!completed) continue;
        recordDeliveryOutcome("retries_exhausted", attempt, logger, config);
        logger.error({
          operationalEvent: "guided_prompt_alert_delivery_failed",
          failureKind: "retries_exhausted",
          ...(response ? { statusCode: response.status } : {}),
          attempts: attempt,
        }, "Guided prompt alert webhook retries exhausted");
      } else {
        await outbox.retry(
          item.id,
          item.leaseToken,
          attempt,
          new Date(now.getTime() + WEBHOOK_RETRY_BASE_MS * 2 ** (attempt - 1)),
        );
      }
    }
  } finally {
    workerRunning = false;
  }
}
function reasonsFor(
  summary: ReturnType<typeof summarize>,
  config: GuidedPromptAlertConfig,
): AlertReason[] {
  const reasons: AlertReason[] = [];
  if (summary.total >= config.minSamples && summary.fallbackRate >= config.fallbackRateThreshold) {
    reasons.push({
      kind: "fallback_rate",
      actual: summary.fallbackRate,
      threshold: config.fallbackRateThreshold,
    });
  }
  for (const failureType of failureTypes) {
    const actual = summary.failures[failureType];
    const threshold = config.failureThresholds[failureType];
    if (actual >= threshold) reasons.push({ kind: "failure_count", failureType, actual, threshold });
  }
  return reasons;
}

function createAlertPayload(
  summary: ReturnType<typeof summarize>,
  actionable: AlertReason[],
  evaluatedAt: number,
  config: GuidedPromptAlertConfig,
): AlertPayload {
  return {
    event: "guided_prompt_generation_alert",
    window: { durationMs: config.windowMs, endedAt: new Date(evaluatedAt).toISOString() },
    summary,
    reasons: actionable,
  };
}
export function createPostgresGuidedPromptMonitorStore(
  databasePool: Pick<typeof pool, "connect">,
): GuidedPromptMonitorStore {
  return {
    async recordAndClaimAlerts(event, config) {
      const client = await databasePool.connect();
      try {
        const clockResult = await client.query<{ now: Date }>(
          "SELECT clock_timestamp() AS now",
        );
        const databaseNow = clockResult.rows[0]!.now;
        const evaluatedAt = databaseNow.getTime();
        const bucketStart = new Date(
          Math.floor(evaluatedAt / GENERATION_BUCKET_MS) * GENERATION_BUCKET_MS,
        );
        const bucketCount = Math.max(1, Math.ceil(config.windowMs / GENERATION_BUCKET_MS));
        const firstBucket = new Date(
          bucketStart.getTime() - (bucketCount - 1) * GENERATION_BUCKET_MS,
        );
        const cutoff = new Date(evaluatedAt - config.windowMs);
        const shard = takeGenerationBucketShard();
        const increments = {
          generated: event.outcome === "generated" ? 1 : 0,
          fallback: event.outcome === "fallback" ? 1 : 0,
          authentication: event.failureType === "authentication" ? 1 : 0,
          rateLimit: event.failureType === "rate_limit" ? 1 : 0,
          timeout: event.failureType === "timeout" ? 1 : 0,
          upstream: event.failureType === "upstream" ? 1 : 0,
          invalidResponse: event.failureType === "invalid_response" ? 1 : 0,
          unknown: event.failureType === "unknown" ? 1 : 0,
        };
        await client.query(
          `INSERT INTO guided_prompt_generation_buckets (
             bucket_start, shard, generated_count, fallback_count, authentication_count,
             rate_limit_count, timeout_count, upstream_count, invalid_response_count, unknown_count
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (bucket_start, shard) DO UPDATE SET
             generated_count = guided_prompt_generation_buckets.generated_count + EXCLUDED.generated_count,
             fallback_count = guided_prompt_generation_buckets.fallback_count + EXCLUDED.fallback_count,
             authentication_count = guided_prompt_generation_buckets.authentication_count + EXCLUDED.authentication_count,
             rate_limit_count = guided_prompt_generation_buckets.rate_limit_count + EXCLUDED.rate_limit_count,
             timeout_count = guided_prompt_generation_buckets.timeout_count + EXCLUDED.timeout_count,
             upstream_count = guided_prompt_generation_buckets.upstream_count + EXCLUDED.upstream_count,
             invalid_response_count = guided_prompt_generation_buckets.invalid_response_count + EXCLUDED.invalid_response_count,
             unknown_count = guided_prompt_generation_buckets.unknown_count + EXCLUDED.unknown_count`,
          [
            bucketStart,
            shard,
            increments.generated,
            increments.fallback,
            increments.authentication,
            increments.rateLimit,
            increments.timeout,
            increments.upstream,
            increments.invalidResponse,
            increments.unknown,
          ],
        );
        // 카운터 업서트는 자동 커밋되어 같은 샤드의 행 잠금을 집계/알림 처리 중 보유하지 않는다.
        await client.query(
          "DELETE FROM guided_prompt_generation_buckets WHERE bucket_start < $1",
          [firstBucket],
        );
        // 이전 버전과 함께 배포되는 동안 기존 이벤트도 정확한 시간 기준으로 합산한다.
        await client.query(
          "DELETE FROM guided_prompt_generation_events WHERE occurred_at < $1",
          [cutoff],
        );

        const result = await client.query<{
          total: string;
          generated: string;
          fallback: string;
          authentication: string;
          rate_limit: string;
          timeout: string;
          upstream: string;
          invalid_response: string;
          unknown: string;
        }>(
          `SELECT
             (COALESCE(SUM(generated_count), 0) + COALESCE(SUM(fallback_count), 0))::text AS total,
             COALESCE(SUM(generated_count), 0)::text AS generated,
             COALESCE(SUM(fallback_count), 0)::text AS fallback,
             COALESCE(SUM(authentication_count), 0)::text AS authentication,
             COALESCE(SUM(rate_limit_count), 0)::text AS rate_limit,
             COALESCE(SUM(timeout_count), 0)::text AS timeout,
             COALESCE(SUM(upstream_count), 0)::text AS upstream,
             COALESCE(SUM(invalid_response_count), 0)::text AS invalid_response,
             COALESCE(SUM(unknown_count), 0)::text AS unknown
           FROM (
             SELECT
               generated_count,
               fallback_count,
               authentication_count,
               rate_limit_count,
               timeout_count,
               upstream_count,
               invalid_response_count,
               unknown_count
             FROM guided_prompt_generation_buckets
             WHERE bucket_start >= $1 AND bucket_start <= $2
             UNION ALL
             SELECT
               COUNT(*) FILTER (WHERE outcome = 'generated')::integer,
               COUNT(*) FILTER (WHERE outcome = 'fallback')::integer,
               COUNT(*) FILTER (WHERE failure_type = 'authentication')::integer,
               COUNT(*) FILTER (WHERE failure_type = 'rate_limit')::integer,
               COUNT(*) FILTER (WHERE failure_type = 'timeout')::integer,
               COUNT(*) FILTER (WHERE failure_type = 'upstream')::integer,
               COUNT(*) FILTER (WHERE failure_type = 'invalid_response')::integer,
               COUNT(*) FILTER (WHERE failure_type = 'unknown')::integer
             FROM guided_prompt_generation_events
             WHERE occurred_at >= $3 AND occurred_at <= $4
           ) AS generation_counts`,
           [firstBucket, bucketStart, cutoff, databaseNow],
        );
        const row = result.rows[0]!;
        const total = Number(row.total);
        const generated = Number(row.generated);
        const fallback = Number(row.fallback);
        const summary: ReturnType<typeof summarize> = {
          total,
          generated,
          fallback,
          generatedRate: total ? generated / total : 0,
          fallbackRate: total ? fallback / total : 0,
          failures: Object.fromEntries(
            failureTypes.map(type => [type, Number(row[type])]),
          ) as Record<GuidedPromptFailureType, number>,
        };

        const actionable: AlertReason[] = [];
        const reasons = config.webhookUrl ? reasonsFor(summary, config) : [];
        if (reasons.length) {
          await client.query("BEGIN");
          try {
            for (const reason of reasons) {
              const claimed = await client.query(
                `INSERT INTO guided_prompt_alert_states (reason_key, last_alerted_at)
                 VALUES ($1, $2)
                 ON CONFLICT (reason_key) DO UPDATE SET last_alerted_at = EXCLUDED.last_alerted_at
                 WHERE guided_prompt_alert_states.last_alerted_at <= $3
                 RETURNING reason_key`,
                [reasonKey(reason), databaseNow, new Date(evaluatedAt - config.cooldownMs)],
              );
              if (claimed.rowCount) actionable.push(reason);
            }
            if (actionable.length) {
              await client.query(
                `INSERT INTO guided_prompt_alert_outbox (payload, expires_at)
                 VALUES ($1, $2)`,
                [
                  createAlertPayload(summary, actionable, evaluatedAt, config),
                  new Date(evaluatedAt + OUTBOX_TTL_MS),
                ],
              );
            }
            await client.query("COMMIT");
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          }
        }
        return {
          summary,
          actionable,
          evaluatedAt,
          outboxPersisted: actionable.length > 0,
        };
      } finally {
        client.release();
      }
    },
  };
}
export async function recordGuidedPromptGeneration(
  event: Omit<Event, "at">,
  logger: Logger,
  now = Date.now(),
  config = getGuidedPromptAlertConfig(),
  store?: GuidedPromptMonitorStore,
): Promise<void> {
  const activeStore = store ?? createPostgresGuidedPromptMonitorStore(pool);
  const { summary, actionable, evaluatedAt, outboxPersisted } =
    await activeStore.recordAndClaimAlerts({ ...event, at: now }, config);
  logger.info({
    metric: "guided_prompt_generation_window",
    windowMs: config.windowMs,
    ...summary,
  }, "Guided prompt generation window metric");

  if (!config.webhookUrl || !actionable.length) return;

  const payload = createAlertPayload(summary, actionable, evaluatedAt, config);
  deliveryWebhookUrl = config.webhookUrl;
  activeDeliveryConfig = config;
  if (!outboxPersisted) {
    await outbox.enqueue(payload, new Date(evaluatedAt + OUTBOX_TTL_MS));
  }
  track(processOutbox(logger, new Date(evaluatedAt)), logger);
}

export async function waitForGuidedPromptAlertDeliveriesForTests(): Promise<void> {
  while (pendingDeliveries.size) await Promise.all([...pendingDeliveries]);
}

export async function processGuidedPromptAlertOutboxForTests(
  logger: Logger,
  now: Date,
): Promise<void> {
  await processOutbox(logger, now);
}
export function resetGuidedPromptMonitorForTests(): void {
  pendingDeliveries.clear();
  deliveryEvents.length = 0;
  consecutiveDeliveryFailures = 0;
  lastDeliveryHealthAlertAt = -Infinity;
  deliveryDegradation = undefined;
  deliveryHealthState = "healthy";
  deliveryHealthTransitions.length = 0;
  lastDeliveryFlappingAlertAt = -Infinity;
  nextGenerationBucketShard = 0;
  workerRunning = false;
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = undefined;
  deliveryWebhookUrl = undefined;
  activeDeliveryConfig = undefined;
  outbox = databaseOutbox;
}

let workerRunning = false;
function reasonKey(reason: AlertReason): string {
  return reason.kind === "fallback_rate" ? reason.kind : `${reason.kind}:${reason.failureType}`;
}

const failureTypes = [
  "authentication",
  "rate_limit",
  "timeout",
  "upstream",
  "invalid_response",
  "unknown",
] as const;

/** 테스트에서만 사용하는, PostgreSQL 저장소와 같은 의미의 공유 메모리 저장소. */
export function createInMemoryGuidedPromptMonitorStore(): GuidedPromptMonitorStore {
  const events: Event[] = [];
  const lastAlerts = new Map<string, number>();
  return {
    async recordAndClaimAlerts(event, config) {
      events.push(event);
      const cutoff = event.at - config.windowMs;
      while (events[0]?.at < cutoff) events.shift();
      const summary = summarize(events.filter(item => item.at <= event.at));
      const reasons = config.webhookUrl ? reasonsFor(summary, config) : [];
      const actionable = reasons.filter(reason => {
        const key = reasonKey(reason);
        if (event.at - (lastAlerts.get(key) ?? -Infinity) < config.cooldownMs) return false;
        lastAlerts.set(key, event.at);
        return true;
      });
      return {
        summary,
        actionable,
        evaluatedAt: event.at,
        outboxPersisted: false,
      };
    },
  };
}

function takeGenerationBucketShard(): number {
  const shard = nextGenerationBucketShard;
  nextGenerationBucketShard = (nextGenerationBucketShard + 1) % GENERATION_BUCKET_SHARDS;
  return shard;
}

let lastDeliveryFlappingAlertAt = -Infinity;

export function setGuidedPromptAlertOutboxForTests(testOutbox: AlertOutbox): void {
  outbox = testOutbox;
}

const GENERATION_BUCKET_SHARDS = 16;

let nextGenerationBucketShard = Math.floor(Math.random() * GENERATION_BUCKET_SHARDS);

const databaseOutbox: AlertOutbox = {
  async enqueue(payload, expiresAt) {
    const { db, guidedPromptAlertOutboxTable } = await import("@workspace/db");
    await db.insert(guidedPromptAlertOutboxTable).values({ payload, expiresAt });
  },
  async claim(now) {
    const { pool } = await import("@workspace/db");
    const result = await pool.query<OutboxItem>(`
      WITH candidate AS (
        SELECT id
        FROM guided_prompt_alert_outbox
        WHERE next_attempt_at <= $1
          AND expires_at > $1
          AND (claimed_at IS NULL OR claimed_at < $2)
        ORDER BY next_attempt_at, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE guided_prompt_alert_outbox AS outbox
      SET claimed_at = $1, lease_token = gen_random_uuid()
      FROM candidate
      WHERE outbox.id = candidate.id
      RETURNING outbox.id, outbox.payload, outbox.attempts,
        outbox.expires_at AS "expiresAt", outbox.lease_token AS "leaseToken"
    `, [now, new Date(now.getTime() - OUTBOX_CLAIM_TIMEOUT_MS)]);
    return result.rows[0];
  },
  async complete(id, leaseToken) {
    const { db, guidedPromptAlertOutboxTable } = await import("@workspace/db");
    const { and, eq } = await import("drizzle-orm");
    const deleted = await db.delete(guidedPromptAlertOutboxTable)
      .where(and(
        eq(guidedPromptAlertOutboxTable.id, id),
        eq(guidedPromptAlertOutboxTable.leaseToken, leaseToken),
      ))
      .returning({ id: guidedPromptAlertOutboxTable.id });
    return deleted.length === 1;
  },
  async retry(id, leaseToken, attempts, nextAttemptAt) {
    const { db, guidedPromptAlertOutboxTable } = await import("@workspace/db");
    const { and, eq } = await import("drizzle-orm");
    const updated = await db.update(guidedPromptAlertOutboxTable)
      .set({ attempts, nextAttemptAt, claimedAt: null, leaseToken: null })
      .where(and(
        eq(guidedPromptAlertOutboxTable.id, id),
        eq(guidedPromptAlertOutboxTable.leaseToken, leaseToken),
      ))
      .returning({ id: guidedPromptAlertOutboxTable.id });
    return updated.length === 1;
  },
  async discardExpired(now) {
    const { db, guidedPromptAlertOutboxTable } = await import("@workspace/db");
    const { lte } = await import("drizzle-orm");
    const deleted = await db.delete(guidedPromptAlertOutboxTable)
      .where(lte(guidedPromptAlertOutboxTable.expiresAt, now))
      .returning({ id: guidedPromptAlertOutboxTable.id });
    return deleted.length;
  },
};

function track(work: Promise<void>, logger: Logger): void {
  const delivery = work
    .catch(err => logger.error({
      err,
      operationalEvent: "guided_prompt_alert_outbox_error",
    }, "Guided prompt alert outbox operation failed"))
    .finally(() => pendingDeliveries.delete(delivery));
  pendingDeliveries.add(delivery);
}

let outbox: AlertOutbox = databaseOutbox;

const OUTBOX_CLAIM_TIMEOUT_MS = 60_000;

type AlertOutbox = {
  enqueue(payload: AlertPayload, expiresAt: Date): Promise<void>;
  claim(now: Date): Promise<OutboxItem | undefined>;
  complete(id: string, leaseToken: string): Promise<boolean>;
  retry(id: string, leaseToken: string, attempts: number, nextAttemptAt: Date): Promise<boolean>;
  discardExpired(now: Date): Promise<number>;
};

let workerTimer: NodeJS.Timeout | undefined;

let activeDeliveryConfig: GuidedPromptAlertConfig | undefined;

const OUTBOX_POLL_MS = 10_000;

let deliveryWebhookUrl: string | undefined;

export function startGuidedPromptAlertWorker(logger: Logger): void {
  if (workerTimer) return;
  activeDeliveryConfig = getGuidedPromptAlertConfig();
  deliveryWebhookUrl = activeDeliveryConfig.webhookUrl;
  track(processOutbox(logger), logger);
  workerTimer = setInterval(() => track(processOutbox(logger), logger), OUTBOX_POLL_MS);
  workerTimer.unref?.();
}
