import OpenAI from "openai";
import { eq, inArray } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

// AI 공급자 설정 — 관리자 페이지(DB settings 테이블)에서 우선 조회,
// 없으면 환경변수로 폴백. (설치 시 키 입력을 생략하고 /admin에서 등록 가능)
//
// settings 키:
//   ai_api_key  — API 키 (OpenAI 또는 로컬 LLM 서버용, 로컬은 아무 값이나 가능)
//   ai_base_url — OpenAI 호환 API 주소 (예: https://api.openai.com/v1, http://localhost:11434/v1)
//   ai_model    — 모델명 (예: gpt-5.6-luna, qwen2.5:14b)

export const DEFAULT_MODEL = "gpt-5.6-luna";
const CACHE_TTL_MS = 30_000;

export interface AIConfig {
  apiKey: string;
  baseUrl: string | undefined;
  model: string;
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
      .where(inArray(settingsTable.key, ["ai_api_key", "ai_base_url", "ai_model"]));
    map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    // settings 테이블이 아직 없는 DB(스키마 미적용)에서는 환경변수 폴백만 사용
  }

  const apiKey =
    map["ai_api_key"] || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";
  const baseUrl =
    map["ai_base_url"] || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;
  const model = map["ai_model"] || DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

/**
 * AI 클라이언트와 모델명을 반환한다. 키가 미설정이면 명확한 오류를 던진다.
 * 사용 예: const { openai, model } = await getAI();
 */
export async function getAI(): Promise<{ openai: OpenAI; model: string }> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return { openai: cached.client, model: cached.config.model };
  }
  const config = await getAIConfig();
  if (!config.apiKey) {
    throw new Error(
      "AI API 키가 설정되지 않았습니다. 관리자 페이지(/admin)의 AI 설정에서 키를 등록해주세요.",
    );
  }
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
  cached = { config, client, at: now };
  return { openai: client, model: config.model };
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
