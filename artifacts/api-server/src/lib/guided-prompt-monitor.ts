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

  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: "guided_prompt_generation_alert",
      window: { durationMs: config.windowMs, endedAt: new Date(now).toISOString() },
      summary,
      reasons: actionable,
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Guided prompt alert webhook returned ${response.status}`);

  for (const reason of actionable) {
    const key = reason.kind === "fallback_rate" ? reason.kind : `${reason.kind}:${reason.failureType}`;
    lastAlerts.set(key, now);
  }
  logger.warn({
    alert: "guided_prompt_generation",
    reasons: actionable,
    windowMs: config.windowMs,
    summary,
  }, "Guided prompt generation threshold exceeded");
}

export function resetGuidedPromptMonitorForTests(): void {
  events.length = 0;
  lastAlerts.clear();
}