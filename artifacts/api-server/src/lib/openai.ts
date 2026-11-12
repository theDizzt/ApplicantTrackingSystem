import OpenAI from "openai";
import { eq, inArray } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { logger } from "./logger";
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// AI 공급자 설정 — 관리자 페이지(DB settings 테이블)에서 우선 조회,
// 없으면 환경변수로 폴백. (설치 시 키 입력을 생략하고 /admin에서 등록 가능)
//
// settings 키:
//   ai_api_key  — API 키
//   ai_base_url — OpenAI 호환 API 주소 (예: https://api.openai.com/v1)
//   ai_model    — 모델명 (예: gpt-5.6-luna)
//   ai_stt_model — 음성인식 모델명 (예: gpt-4o-mini-transcribe)
//   ai_model_interview / ai_model_light / ai_model_vision — 역할별 모델 (비우면 ai_model 사용)

export const DEFAULT_MODEL = "gpt-5.6-luna";
export const DEFAULT_STT_MODEL = "gpt-4o-mini-transcribe";
const CACHE_TTL_MS = 30_000;

// ─── AI 서버 동시 요청 제한 ────────────────────────────────────────────────
// AI 서버(open.hasa.re.kr 등)는 키당 동시 요청 한도를 넘긴 뒤 다시 호출하면
// 경고를 누적하고 점점 길게 차단한다. (동시 2개에서 차단된 것을 확인함)
// 그래서 이 프로세스의 모든 AI 호출을 하나의 대기열로 묶어
// 동시에 AI_MAX_CONCURRENCY(기본 1)개까지만 보낸다.
const AI_MAX_CONCURRENCY = Math.max(1, Number(process.env.AI_MAX_CONCURRENCY) || 1);
let aiActive = 0;

// ─── 차단 응답 후 쉬는 시간 ────────────────────────────────────────────────
// 403 security_policy_blocked를 받은 뒤 계속 호출하면 "반복 호출"로 경고가 쌓인다.
// 한 번 차단되면 AI_BLOCK_COOLDOWN_MS(기본 5분) 동안 AI 서버에 요청을 보내지 않고
// 바로 안내 오류를 돌려준다.
const AI_BLOCK_COOLDOWN_MS = Math.max(10_000, Number(process.env.AI_BLOCK_COOLDOWN_MS) || 5 * 60_000);

// 개발 모드는 코드가 바뀔 때마다 서버가 자동 재시작되므로, 쉬는 시간을 파일에 남겨
// 재시작 직후 차단 중인 AI 서버를 다시 호출하지 않게 한다.
const AI_BLOCK_FILE = path.join(os.tmpdir(), "ats-ai-blocked-until.txt");

function readPersistedBlock(): number {
  try {
    const value = Number(readFileSync(AI_BLOCK_FILE, "utf8").trim());
    return Number.isFinite(value) && value > Date.now() ? value : 0;
  } catch {
    return 0;
  }
}

function persistBlock(until: number): void {
  try { writeFileSync(AI_BLOCK_FILE, String(until)); } catch { /* 기록 실패는 무시 (메모리 값으로 동작) */ }
}

let aiBlockedUntil = process.env.VITEST ? 0 : readPersistedBlock();

export function aiBlockedMessage(now: number = Date.now()): string | null {
  if (now >= aiBlockedUntil) return null;
  const minutes = Math.max(1, Math.ceil((aiBlockedUntil - now) / 60_000));
  return `AI 서버가 요청을 일시 차단했습니다(동시 요청 한도 초과). 약 ${minutes}분 뒤에 다시 시도해주세요.`;
}

function blockedResponse(message: string): Response {
  return new Response(JSON.stringify({ error: { message, code: "ai_temporarily_blocked" } }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

/** 403 응답이 AI 서버의 보안 정책 차단이면 쉬는 시간을 시작한다. */
async function noteBlockIfAny(response: Response): Promise<void> {
  if (response.status !== 403) return;
  const body = await response.clone().text().catch(() => "");
  if (/security_policy_blocked/.test(body)) {
    aiBlockedUntil = Date.now() + AI_BLOCK_COOLDOWN_MS;
    if (!process.env.VITEST) persistBlock(aiBlockedUntil);
    logger.warn({ cooldownSec: AI_BLOCK_COOLDOWN_MS / 1000, body: body.slice(0, 300) },
      "AI 서버 security_policy_blocked 수신 — 쉬는 시간 동안 AI 호출 중단");
  }
}

/** 테스트용: 차단 상태 초기화 */
export function resetAIBlockForTest(): void {
  aiBlockedUntil = 0;
}
const aiWaiters: Array<() => void> = [];

async function acquireAISlot(): Promise<void> {
  if (aiActive < AI_MAX_CONCURRENCY) { aiActive += 1; return; }
  await new Promise<void>((resolve) => aiWaiters.push(resolve));
}

function releaseAISlot(): void {
  const next = aiWaiters.shift();
  if (next) next(); // 자리를 그대로 다음 요청에 넘긴다 (aiActive 유지)
  else aiActive -= 1;
}

const limitedFetch: typeof fetch = async (input, init) => {
  const blockedBefore = aiBlockedMessage();
  if (blockedBefore) return blockedResponse(blockedBefore);
  await acquireAISlot();
  try {
    // 대기하는 사이에 차단됐으면 보내지 않는다
    const blocked = aiBlockedMessage();
    if (blocked) return blockedResponse(blocked);
    let response = await fetch(input, init);
    await noteBlockIfAny(response);
    if (response.status >= 500) response = await retryWithFallbackModels(input, init, response);
    return response;
  } finally {
    releaseAISlot();
  }
};

// ─── 모델 고장 시 예비 모델로 재시도 ───────────────────────────────────────
// AI 서버에서 모델 하나가 통째로 500을 내는 일이 반복돼(hyperclovax → exaone),
// 채팅 요청이 5xx로 실패하면 설정 ai_fallback_models(쉼표 구분)의 모델로 차례로 다시 보낸다.
// 같은 대기열 슬롯 안에서 하나씩 보내므로 동시 요청 한도를 넘지 않는다.
let aiFallbackModels: string[] = [];

export function setAIFallbackModelsForTest(models: string[]): void {
  aiFallbackModels = models;
}

async function retryWithFallbackModels(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  failed: Response,
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (!/\/chat\/completions$/.test(url) || typeof init?.body !== "string" || aiFallbackModels.length === 0) return failed;
  let body: Record<string, unknown>;
  try { body = JSON.parse(init.body) as Record<string, unknown>; } catch { return failed; }
  const original = typeof body.model === "string" ? body.model : "";

  let last = failed;
  for (const model of aiFallbackModels) {
    if (model === original) continue;
    if (aiBlockedMessage()) return last;
    logger.warn({ from: original, to: model, status: last.status }, "AI 모델 오류 — 예비 모델로 재시도");
    const retried = await fetch(input, { ...init, body: JSON.stringify({ ...body, model }) });
    await noteBlockIfAny(retried);
    if (retried.status < 500) return retried;
    last = retried;
  }
  return last;
}

/**
 * 추론용 AI 클라이언트를 만든다. 모든 요청은 공용 동시 실행 제한을 거치며,
 * SDK 자동 재시도는 끈다. (한도 초과 응답 뒤 자동 재시도가 곧 "반복 호출"
 * 경고로 이어지기 때문)
 */
export function createAIClient(opts: { apiKey: string; baseURL?: string }): OpenAI {
  return new OpenAI({ ...opts, maxRetries: 0, fetch: limitedFetch });
}

/**
 * AI 호출 역할. 같은 API 키·주소를 쓰되 역할마다 모델만 바꿀 수 있다.
 *   screening — 서류 심사·불합격 원인 리포트·커리어 분석·자기소개서 작성 (기본 모델 ai_model)
 *   interview — 면접 질문 생성·답변 평가·꼬리 질문
 *   light     — 맞춤법, 이력서 파일 구조화, 기업 추천·매칭, 녹음용 질문 같은 가벼운 작업
 *   vision    — 이미지·스캔 공고 OCR (이미지 입력을 지원하는 모델이어야 함)
 */
export type AIRole = "screening" | "interview" | "light" | "vision";
export type SubRole = Exclude<AIRole, "screening">;

export const AI_ROLE_SETTING_KEYS: Record<SubRole, string> = {
  interview: "ai_model_interview",
  light: "ai_model_light",
  vision: "ai_model_vision",
};

export interface AIConfig {
  apiKey: string;
  baseUrl: string | undefined;
  /** 기본 모델 (screening 역할) */
  model: string;
  /** 역할별 모델. 비어 있는 역할은 기본 모델을 쓴다. */
  roleModels?: Partial<Record<SubRole, string>>;
}

/** 역할에 맞는 모델명. 역할 모델이 비어 있으면 기본 모델로 폴백한다. */
export function resolveRoleModel(config: AIConfig, role: AIRole): string {
  if (role === "screening") return config.model;
  return config.roleModels?.[role]?.trim() || config.model;
}

let cached: { config: AIConfig; client: OpenAI; at: number } | null = null;

export function invalidateAICache(): void {
  cached = null;
}

export async function getAIConfig(): Promise<AIConfig> {
  let map: Record<string, string> = {};
  try {
    const rows = await db
      .select()
      .from(settingsTable)
      .where(inArray(settingsTable.key, [
        "ai_api_key",
        "ai_base_url",
        "ai_model",
        "ai_fallback_models",
        ...Object.values(AI_ROLE_SETTING_KEYS),
      ]));
    map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    aiFallbackModels = (map["ai_fallback_models"] ?? "")
      .split(",").map((m) => m.trim()).filter(Boolean).slice(0, 3);
  } catch {
    // settings 테이블이 아직 없는 DB(스키마 미적용)에서는 환경변수 폴백만 사용
  }

  const apiKey =
    map["ai_api_key"] || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";
  const baseUrl =
    map["ai_base_url"] || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;
  const model = map["ai_model"] || DEFAULT_MODEL;
  const roleModels: Partial<Record<SubRole, string>> = {};
  for (const [role, key] of Object.entries(AI_ROLE_SETTING_KEYS) as [SubRole, string][]) {
    const value = map[key]?.trim();
    if (value) roleModels[role] = value;
  }
  return { apiKey, baseUrl, model, roleModels };
}

/**
 * 보조(secondary) AI 모델 설정을 조회한다.
 * settings 키:
 *   ai2_api_key / ai2_base_url / ai2_model  — 보조 모델 2
 *   ai3_api_key / ai3_base_url / ai3_model  — 보조 모델 3
 * 완전히 설정된 항목(모델명 존재 AND (API 키 존재 또는 로컬 baseUrl))만 반환한다.
 * 기본(primary)과 달리 환경변수 폴백은 하지 않는다.
 */
function isLocalBaseUrl(baseUrl: string): boolean {
  const u = baseUrl.toLowerCase();
  return u.includes("localhost") || u.includes("127.0.0.1") || u.includes("0.0.0.0");
}

export async function getSecondaryAIs(): Promise<
  Array<{ openai: OpenAI; model: string; label: "모델 2" | "모델 3" }>
> {
  let map: Record<string, string> = {};
  try {
    const rows = await db
      .select()
      .from(settingsTable)
      .where(
        inArray(settingsTable.key, [
          "ai2_api_key",
          "ai2_base_url",
          "ai2_model",
          "ai3_api_key",
          "ai3_base_url",
          "ai3_model",
        ]),
      );
    map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    // settings 테이블이 아직 없는 DB에서는 보조 모델 없음
    return [];
  }

  const specs: Array<{
    label: "모델 2" | "모델 3";
    apiKey: string;
    baseUrl: string | undefined;
    model: string;
  }> = [
    {
      label: "모델 2",
      apiKey: map["ai2_api_key"] || "",
      baseUrl: map["ai2_base_url"] || undefined,
      model: map["ai2_model"] || "",
    },
    {
      label: "모델 3",
      apiKey: map["ai3_api_key"] || "",
      baseUrl: map["ai3_base_url"] || undefined,
      model: map["ai3_model"] || "",
    },
  ];

  const result: Array<{ openai: OpenAI; model: string; label: "모델 2" | "모델 3" }> = [];
  for (const spec of specs) {
    if (!spec.model.trim()) continue;
    const hasKey = !!spec.apiKey.trim();
    const localBase = !!spec.baseUrl && isLocalBaseUrl(spec.baseUrl);
    if (!hasKey && !localBase) continue;
    const client = createAIClient({
      apiKey: spec.apiKey || "local",
      baseURL: spec.baseUrl,
    });
    result.push({ openai: client, model: spec.model.trim(), label: spec.label });
  }
  return result;
}

/**
 * AI 클라이언트와 역할에 맞는 모델명을 반환한다. 키가 미설정이면 명확한 오류를 던진다.
 * 사용 예: const { openai, model } = await getAI("interview");
 */
export async function getAI(role: AIRole = "screening"): Promise<{ openai: OpenAI; model: string }> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return { openai: cached.client, model: resolveRoleModel(cached.config, role) };
  }
  const config = await getAIConfig();
  if (!config.apiKey) {
    throw new Error(
      "AI API 키가 설정되지 않았습니다. 관리자 페이지(/admin)의 AI 설정에서 키를 등록해주세요.",
    );
  }
  const client = createAIClient({ apiKey: config.apiKey, baseURL: config.baseUrl });
  cached ={ config, client, at: now };
  return { openai: client, model: resolveRoleModel(config, role) };
}

/**
 * AI 서버 연결 상태를 사전 점검한다. (모델 목록 조회, 5초 타임아웃)
 * 실패 시 사용자에게 보여줄 한국어 메시지를 반환한다.
 */
export type AIHealthCode = "ok" | "no_key" | "auth_error" | "unreachable" | "config_error" | "blocked";

export async function checkAIHealth(): Promise<{ ok: boolean; code: AIHealthCode; error?: string }> {
  let config: AIConfig;
  try {
    config = await getAIConfig();
  } catch {
    return { ok: false, code: "config_error", error: "AI 설정을 불러오지 못했습니다. 관리자에게 문의해주세요." };
  }
  if (!config.apiKey) {
    return {
      ok: false,
      code: "no_key",
      error: "AI API 키가 설정되지 않았습니다. 관리자 페이지(/admin)의 AI 설정에서 키를 등록해주세요.",
    };
  }
  // 차단 중에는 점검 요청도 보내지 않는다 (차단 중 호출이 경고로 쌓이지 않게)
  const blocked = aiBlockedMessage();
  if (blocked) return { ok: false, code: "blocked", error: blocked };

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    timeout: 5_000,
    maxRetries: 0,
    // 점검 요청은 대기열을 거치지 않는다 (긴 AI 호출 뒤에서 5초 제한에 걸리지 않게).
    // 대신 차단 응답은 기록한다.
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      await noteBlockIfAny(response);
      return response;
    },
  });
  try {
    await client.models.list();
    return { ok: true, code: "ok" };
  } catch (err) {
    const blockedNow = aiBlockedMessage();
    if (blockedNow) return { ok: false, code: "blocked", error: blockedNow };
    // HTTP 응답이 온 경우(404/405 등) 서버 자체는 살아있는 것 —
    // 일부 OpenAI 호환 프록시는 /models 엔드포인트를 지원하지 않는다.
    if (err instanceof OpenAI.APIError && typeof err.status === "number") {
      if (err.status === 401 || err.status === 403) {
        return {
          ok: false,
          code: "auth_error",
          error: "AI API 키가 유효하지 않습니다. 관리자 페이지(/admin)의 AI 설정을 확인해주세요.",
        };
      }
      return { ok: true, code: "ok" };
    }
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      code: "unreachable",
      error: `AI 서버(${config.baseUrl ?? "OpenAI"})에 연결할 수 없습니다. 관리자에게 문의해주세요. (원인: ${detail})`,
    };
  }
}

/** settings 테이블에 값 저장 (upsert) */
export async function saveSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value, updatedAt: new Date() },
    });
  invalidateAICache();
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key));
  return rows[0]?.value ?? null;
}
