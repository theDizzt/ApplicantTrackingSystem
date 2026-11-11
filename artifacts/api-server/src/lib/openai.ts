import OpenAI from "openai";
import { eq, inArray } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

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
// 경고를 누적하고 점점 길게 차단한다. 그래서 이 프로세스의 모든 AI 호출을
// 하나의 대기열로 묶어 동시에 AI_MAX_CONCURRENCY(기본 2)개까지만 보낸다.
const AI_MAX_CONCURRENCY = Math.max(1, Number(process.env.AI_MAX_CONCURRENCY) || 2);
let aiActive = 0;
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
  await acquireAISlot();
  try {
    return await fetch(input, init);
  } finally {
    releaseAISlot();
  }
};

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
        ...Object.values(AI_ROLE_SETTING_KEYS),
      ]));
    map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
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
export type AIHealthCode = "ok" | "no_key" | "auth_error" | "unreachable" | "config_error";

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
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    timeout: 5_000,
    maxRetries: 0,
  });
  try {
    await client.models.list();
    return { ok: true, code: "ok" };
  } catch (err) {
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
