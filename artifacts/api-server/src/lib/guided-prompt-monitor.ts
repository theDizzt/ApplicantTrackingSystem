import type { Logger } from "pino";

export type GuidedPromptFailureType =
  | "authentication"
  | "rate_limit"
  | "timeout"
  | "upstream"
  | "invalid_response"
  | "unknown";

type Outcome = "generated" | "fallback";

type Event = {
  at: number;
  outcome: Outcome;
  failureType?: GuidedPromptFailureType;
};

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
};

const events: Event[] = [];
const lastAlerts = new Map<string, number>();
const pendingDeliveries = new Set<Promise<void>>();
const WEBHOOK_MAX_ATTEMPTS = 3;
const WEBHOOK_RETRY_BASE_MS = 250;
const WEBHOOK_TIMEOUT_MS = 5_000;

type AlertPayload = {
  event: "guided_prompt_generation_alert";
  window: { durationMs: number; endedAt: string };
  summary: ReturnType<typeof summarize>;
  reasons: AlertReason[];
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
  };
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

function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

async function deliverAlert(
  webhookUrl: string,
  payload: AlertPayload,
  logger: Logger,
): Promise<void> {
  for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
      if (response.ok) {
        logger.warn({
          alert: "guided_prompt_generation",
          reasons: payload.reasons,
          windowMs: payload.window.durationMs,
          summary: payload.summary,
          deliveryAttempts: attempt,
        }, "Guided prompt generation threshold exceeded");
        return;
      }

      if (response.status < 500) {
        logger.error({
          operationalEvent: "guided_prompt_alert_delivery_failed",
          failureKind: "permanent_http_response",
          statusCode: response.status,
          attempts: attempt,
        }, "Guided prompt alert webhook permanently rejected");
        return;
      }

      if (attempt === WEBHOOK_MAX_ATTEMPTS) {
        logger.error({
          operationalEvent: "guided_prompt_alert_delivery_failed",
          failureKind: "retries_exhausted",
          statusCode: response.status,
          attempts: attempt,
        }, "Guided prompt alert webhook retries exhausted");
        return;
      }
    } catch {
      if (attempt === WEBHOOK_MAX_ATTEMPTS) {
        logger.error({
          operationalEvent: "guided_prompt_alert_delivery_failed",
          failureKind: "retries_exhausted",
          attempts: attempt,
        }, "Guided prompt alert webhook retries exhausted");
        return;
      }
    }

    await wait(WEBHOOK_RETRY_BASE_MS * 2 ** (attempt - 1));
  }
}

function scheduleAlertDelivery(
  webhookUrl: string,
  payload: AlertPayload,
  logger: Logger,
): void {
  const delivery = deliverAlert(webhookUrl, payload, logger)
    .catch(() => {
      logger.error({
        operationalEvent: "guided_prompt_alert_delivery_failed",
        failureKind: "unexpected_delivery_error",
      }, "Guided prompt alert delivery failed unexpectedly");
    })
    .finally(() => pendingDeliveries.delete(delivery));
  pendingDeliveries.add(delivery);
}

export async function recordGuidedPromptGeneration(
  event: Omit<Event, "at">,
  logger: Logger,
  now = Date.now(),
  config = getGuidedPromptAlertConfig(),
): Promise<void> {
  events.push({ ...event, at: now });
  const cutoff = now - config.windowMs;
  while (events[0]?.at < cutoff) events.shift();

  const summary = summarize(events);
  logger.info({
    metric: "guided_prompt_generation_window",
    windowMs: config.windowMs,
    ...summary,
  }, "Guided prompt generation window metric");

  if (!config.webhookUrl) return;

  const reasons: AlertReason[] = [];
  if (summary.total >= config.minSamples && summary.fallbackRate >= config.fallbackRateThreshold) {
    reasons.push({
      kind: "fallback_rate",
      actual: summary.fallbackRate,
      threshold: config.fallbackRateThreshold,
    });
  }
  for (const [failureType, threshold] of Object.entries(config.failureThresholds) as
    [GuidedPromptFailureType, number][]) {
    const actual = summary.failures[failureType];
    if (actual >= threshold) reasons.push({ kind: "failure_count", failureType, actual, threshold });
  }

  const actionable = reasons.filter(reason => {
    const key = reason.kind === "fallback_rate" ? reason.kind : `${reason.kind}:${reason.failureType}`;
    return now - (lastAlerts.get(key) ?? -Infinity) >= config.cooldownMs;
  });
  if (!actionable.length) return;

  for (const reason of actionable) {
    const key = reason.kind === "fallback_rate" ? reason.kind : `${reason.kind}:${reason.failureType}`;
    lastAlerts.set(key, now);
  }
  scheduleAlertDelivery(config.webhookUrl, {
    event: "guided_prompt_generation_alert",
    window: { durationMs: config.windowMs, endedAt: new Date(now).toISOString() },
    summary,
    reasons: actionable,
  }, logger);
}

export async function waitForGuidedPromptAlertDeliveriesForTests(): Promise<void> {
  await Promise.all([...pendingDeliveries]);
}

export function resetGuidedPromptMonitorForTests(): void {
  events.length = 0;
  lastAlerts.clear();
  pendingDeliveries.clear();
}