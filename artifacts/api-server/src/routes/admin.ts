import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { eq, count, sum, gte } from "drizzle-orm";
import { db, usersTable, analysesTable, organizationsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/admin";
import { DEFAULT_STT_MODEL, getAI, getAIConfig, getSetting, saveSetting, invalidateAICache, checkAIHealth } from "../lib/openai";
import { getAIHealthStatus } from "../lib/ai-health-monitor";
import {
  getGuidedPromptDeliveryAdminStatus,
  type GuidedPromptDeliveryAdminStatus,
} from "../lib/guided-prompt-monitor";

const isProduction = process.env.NODE_ENV === "production";
const DEV_ADMIN_USERNAME = "park1058";
const DEV_ADMIN_PASSWORD_HASH = "$2b$10$bXvyhksqpSdRmMO3LuGJE.xdVS9aWKfLw06YbPDFL/jqmt3dOcWLa";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? (isProduction ? "" : DEV_ADMIN_USERNAME);
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ?? (isProduction ? "" : DEV_ADMIN_PASSWORD_HASH);

if (isProduction && (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH)) {
  throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD_HASH are required in production");
}

// Subscription pricing (must match subscription.ts)
const PLAN_PRICES: Record<string, number> = { free: 0, basic: 9900, premium: 19900 };

// Token cost estimation (OpenAI gpt pricing per 1M tokens, KRW ≈ 1350/USD)
const INPUT_COST_PER_1M_USD = 2.5;
const OUTPUT_COST_PER_1M_USD = 10.0;
const USD_TO_KRW = 1_350;

type AIHealthCheckResult = Awaited<ReturnType<typeof checkAIHealth>>;

const AI_HEALTH_PUBLIC_ERRORS: Record<Exclude<AIHealthCheckResult["code"], "ok">, string> = {
  no_key: "AI API 키가 설정되지 않았습니다. 관리자 페이지의 AI 설정에서 키를 등록해주세요.",
  auth_error: "AI API 키가 유효하지 않습니다. 관리자 페이지의 AI 설정을 확인해주세요.",
  unreachable: "AI 서버에 연결할 수 없습니다. AI 설정과 서버 상태를 확인해주세요.",
  config_error: "AI 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
};

function getPublicAIHealthError(result: Pick<AIHealthCheckResult, "ok" | "code">) {
  return result.ok || result.code === "ok" ? undefined : AI_HEALTH_PUBLIC_ERRORS[result.code];
}

function serializeAIHealthCheck(result: AIHealthCheckResult) {
  const error = getPublicAIHealthError(result);
  return {
    ok: result.ok,
    code: result.code,
    ...(error !== undefined ? { error } : {}),
  };
}

function serializeAIHealthStatus(status: NonNullable<ReturnType<typeof getAIHealthStatus>>) {
  const error = getPublicAIHealthError(status);
  return {
    checked: true as const,
    ok: status.ok,
    code: status.code,
    ...(error !== undefined ? { error } : {}),
    checkedAt: status.checkedAt,
    downSince: status.downSince,
  };
}

declare module "express-session" {
  interface SessionData {
    isAdmin?: boolean;
  }
}

const router: IRouter = Router();

function serializeGuidedPromptDeliveryAdminStatus(status: GuidedPromptDeliveryAdminStatus) {
  return {
    configured: status.configured,
    windowMs: status.windowMs,
    total: status.total,
    succeeded: status.succeeded,
    permanentFailures: status.permanentFailures,
    retriesExhausted: status.retriesExhausted,
    failureRate: status.failureRate,
    consecutiveFailures: status.consecutiveFailures,
    ...(status.lastOutcome !== undefined ? { lastOutcome: status.lastOutcome } : {}),
    ...(status.lastDeliveryAt !== undefined ? { lastDeliveryAt: status.lastDeliveryAt } : {}),
    successRate: status.successRate,
  };
}

// ── Admin Login ───────────────────────────────────────────────────────────
router.post("/admin/login", async (req, res): Promise<void> => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
    return;
  }
  if (username !== ADMIN_USERNAME) {
    res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    return;
  }
  const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!valid) {
    res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    return;
  }
  req.session.isAdmin = true;
  res.json({ ok: true });
});

router.post("/admin/logout", requireAdmin, async (req, res): Promise<void> => {
  req.session.isAdmin = false;
  res.json({ ok: true });
});

router.get("/admin/me", async (req, res): Promise<void> => {
  res.json({ isAdmin: req.session.isAdmin === true });
});

// ── Stats ─────────────────────────────────────────────────────────────────
router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // User counts by subscription status
  const userRows = await db
    .select({ status: usersTable.subscriptionStatus, cnt: count() })
    .from(usersTable)
    .groupBy(usersTable.subscriptionStatus);

  const totalUsers = userRows.reduce((s, r) => s + Number(r.cnt), 0);
  const usersByPlan: Record<string, number> = {};
  for (const r of userRows) usersByPlan[r.status] = Number(r.cnt);

  // Monthly subscription revenue
  const monthlyRevenue = userRows.reduce((s, r) => {
    return s + (PLAN_PRICES[r.status] ?? 0) * Number(r.cnt);
  }, 0);

  // Token usage
  const tokenRows = await db
    .select({
      totalInput:  sum(analysesTable.inputTokens),
      totalOutput: sum(analysesTable.outputTokens),
    })
    .from(analysesTable);

  const totalInputTokens  = Number(tokenRows[0]?.totalInput  ?? 0);
  const totalOutputTokens = Number(tokenRows[0]?.totalOutput ?? 0);
  const totalTokens = totalInputTokens + totalOutputTokens;

  const inputCostKrw  = (totalInputTokens  / 1_000_000) * INPUT_COST_PER_1M_USD  * USD_TO_KRW;
  const outputCostKrw = (totalOutputTokens / 1_000_000) * OUTPUT_COST_PER_1M_USD * USD_TO_KRW;
  const totalCostKrw  = Math.round(inputCostKrw + outputCostKrw);

  // This month token usage
  const monthTokenRows = await db
    .select({
      totalInput:  sum(analysesTable.inputTokens),
      totalOutput: sum(analysesTable.outputTokens),
    })
    .from(analysesTable)
    .where(gte(analysesTable.createdAt, startOfMonth));

  const monthInputTokens  = Number(monthTokenRows[0]?.totalInput  ?? 0);
  const monthOutputTokens = Number(monthTokenRows[0]?.totalOutput ?? 0);
  const monthTokens = monthInputTokens + monthOutputTokens;
  const monthCostKrw = Math.round(
    ((monthInputTokens  / 1_000_000) * INPUT_COST_PER_1M_USD +
     (monthOutputTokens / 1_000_000) * OUTPUT_COST_PER_1M_USD) * USD_TO_KRW
  );

  // Analysis counts
  const analysisRows = await db
    .select({ cnt: count() })
    .from(analysesTable);
  const totalAnalyses = Number(analysisRows[0]?.cnt ?? 0);

  const monthAnalysisRows = await db
    .select({ cnt: count() })
    .from(analysesTable)
    .where(gte(analysesTable.createdAt, startOfMonth));
  const monthAnalyses = Number(monthAnalysisRows[0]?.cnt ?? 0);

  // Organization count
  const orgRows = await db.select({ cnt: count() }).from(organizationsTable);
  const totalOrganizations = Number(orgRows[0]?.cnt ?? 0);

  res.json({
    totalUsers,
    usersByPlan,
    monthlyRevenue,
    totalTokens,
    totalInputTokens,
    totalOutputTokens,
    totalCostKrw,
    monthTokens,
    monthCostKrw,
    totalAnalyses,
    monthAnalyses,
    totalOrganizations,
  });
});

// ── Users ─────────────────────────────────────────────────────────────────
router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      subscriptionStatus: usersTable.subscriptionStatus,
      analysesUsedThisMonth: usersTable.analysesUsedThisMonth,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);

  res.json(
    users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    }))
  );
});

// ── Organizations ─────────────────────────────────────────────────────────
router.get("/admin/organizations", requireAdmin, async (_req, res): Promise<void> => {
  const orgs = await db
    .select()
    .from(organizationsTable)
    .orderBy(organizationsTable.registeredAt);
  res.json(
    orgs.map((o) => ({
      ...o,
      registeredAt: o.registeredAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    }))
  );
});

router.post("/admin/organizations", requireAdmin, async (req, res): Promise<void> => {
  const { name, contactPerson, contactEmail, contactPhone, description, memberCount, status } = req.body;
  if (!name) {
    res.status(400).json({ error: "협회명을 입력해주세요." });
    return;
  }
  const [org] = await db
    .insert(organizationsTable)
    .values({ name, contactPerson, contactEmail, contactPhone, description, memberCount: memberCount ?? 0, status: status ?? "active" })
    .returning();
  res.status(201).json({ ...org, registeredAt: org.registeredAt.toISOString(), updatedAt: org.updatedAt.toISOString() });
});

router.patch("/admin/organizations/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }
  const { name, contactPerson, contactEmail, contactPhone, description, memberCount, status } = req.body;
  const [org] = await db
    .update(organizationsTable)
    .set({ name, contactPerson, contactEmail, contactPhone, description, memberCount, status })
    .where(eq(organizationsTable.id, id))
    .returning();
  if (!org) { res.status(404).json({ error: "협회를 찾을 수 없습니다." }); return; }
  res.json({ ...org, registeredAt: org.registeredAt.toISOString(), updatedAt: org.updatedAt.toISOString() });
});

router.delete("/admin/organizations/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }
  await db.delete(organizationsTable).where(eq(organizationsTable.id, id));
  res.json({ ok: true });
});

// ── AI 설정 (API 키 / Base URL / 모델) ────────────────────────────────────
function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 10) return "••••••••";
  return key.slice(0, 6) + "…" + key.slice(-4);
}

type AdminAISettingsResponse = {
  apiKeyMasked: string;
  hasApiKey: boolean;
  baseUrl: string;
  model: string;
  sttModel: string;
  apiKey2Masked: string;
  hasApiKey2: boolean;
  baseUrl2: string;
  model2: string;
  apiKey3Masked: string;
  hasApiKey3: boolean;
  baseUrl3: string;
  model3: string;
  modelInterview: string;
  modelLight: string;
  modelVision: string;
  embeddingModel: string;
};

function serializeAdminAISettings(input: {
  config: Awaited<ReturnType<typeof getAIConfig>>;
  sttModel: string | null | undefined;
  apiKey2: string | null | undefined;
  baseUrl2: string | null | undefined;
  model2: string | null | undefined;
  apiKey3: string | null | undefined;
  baseUrl3: string | null | undefined;
  model3: string | null | undefined;
  modelInterview?: string | null;
  modelLight?: string | null;
  modelVision?: string | null;
  embeddingModel?: string | null;
}): AdminAISettingsResponse {
  return {
    apiKeyMasked: maskApiKey(input.config.apiKey),
    hasApiKey: !!input.config.apiKey,
    baseUrl: input.config.baseUrl ?? "",
    model: input.config.model,
    sttModel: input.sttModel?.trim() || DEFAULT_STT_MODEL,
    apiKey2Masked: maskApiKey(input.apiKey2 ?? ""),
    hasApiKey2: !!(input.apiKey2 ?? ""),
    baseUrl2: input.baseUrl2 ?? "",
    model2: input.model2 ?? "",
    apiKey3Masked: maskApiKey(input.apiKey3 ?? ""),
    hasApiKey3: !!(input.apiKey3 ?? ""),
    baseUrl3: input.baseUrl3 ?? "",
    model3: input.model3 ?? "",
    // 역할별 모델 — 빈 문자열이면 기본 모델(model)을 사용한다
    modelInterview: input.modelInterview?.trim() ?? "",
    modelLight: input.modelLight?.trim() ?? "",
    modelVision: input.modelVision?.trim() ?? "",
    embeddingModel: input.embeddingModel?.trim() ?? "",
  };
}

router.get("/admin/settings/ai", requireAdmin, async (_req, res): Promise<void> => {
  const config = await getAIConfig();
  const [
    sttModel, apiKey2, baseUrl2, model2, apiKey3, baseUrl3, model3,
    modelInterview, modelLight, modelVision, embeddingModel,
  ] = await Promise.all([
    getSetting("ai_stt_model"),
    getSetting("ai2_api_key"),
    getSetting("ai2_base_url"),
    getSetting("ai2_model"),
    getSetting("ai3_api_key"),
    getSetting("ai3_base_url"),
    getSetting("ai3_model"),
    getSetting("ai_model_interview"),
    getSetting("ai_model_light"),
    getSetting("ai_model_vision"),
    getSetting("ai_embedding_model"),
  ]);
  res.json(serializeAdminAISettings({
    config,
    sttModel,
    apiKey2,
    baseUrl2,
    model2,
    apiKey3,
    baseUrl3,
    model3,
    modelInterview,
    modelLight,
    modelVision,
    embeddingModel,
  }));
});

router.put("/admin/settings/ai", requireAdmin, async (req, res): Promise<void> => {
  const {
    apiKey, baseUrl, model, sttModel, apiKey2, baseUrl2, model2, apiKey3, baseUrl3, model3,
    modelInterview, modelLight, modelVision, embeddingModel,
  } =
    req.body as {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      sttModel?: string;
      apiKey2?: string;
      baseUrl2?: string;
      model2?: string;
      apiKey3?: string;
      baseUrl3?: string;
      model3?: string;
      modelInterview?: string;
      modelLight?: string;
      modelVision?: string;
      embeddingModel?: string;
    };
  if (apiKey !== undefined && apiKey !== "") {
    await saveSetting("ai_api_key", apiKey.trim());
  }
  if (baseUrl !== undefined) {
    await saveSetting("ai_base_url", baseUrl.trim());
  }
  if (model !== undefined) {
    await saveSetting("ai_model", model.trim());
  }
  if (sttModel !== undefined) {
    await saveSetting("ai_stt_model", sttModel.trim() || DEFAULT_STT_MODEL);
  }
  // 보조 심사 모델 — 레지스트리 검증 없이 저장. 빈 문자열은 설정 해제.
  if (apiKey2 !== undefined && apiKey2 !== "") {
    await saveSetting("ai2_api_key", apiKey2.trim());
  }
  if (baseUrl2 !== undefined) {
    await saveSetting("ai2_base_url", baseUrl2.trim());
  }
  if (model2 !== undefined) {
    await saveSetting("ai2_model", model2.trim());
  }
  if (apiKey3 !== undefined && apiKey3 !== "") {
    await saveSetting("ai3_api_key", apiKey3.trim());
  }
  if (baseUrl3 !== undefined) {
    await saveSetting("ai3_base_url", baseUrl3.trim());
  }
  if (model3 !== undefined) {
    await saveSetting("ai3_model", model3.trim());
  }
  // 역할별 모델 — 빈 문자열은 설정 해제(기본 모델 사용)
  const roleModelSettings: [string | undefined, string][] = [
    [modelInterview, "ai_model_interview"],
    [modelLight, "ai_model_light"],
    [modelVision, "ai_model_vision"],
    [embeddingModel, "ai_embedding_model"],
  ];
  for (const [value, key] of roleModelSettings) {
    if (typeof value === "string") await saveSetting(key, value.trim());
  }
  res.json({ ok: true });
});

// 현재 AI 연결 상태 점검 (모델 목록 조회 기반, 5초 타임아웃)
router.get("/admin/settings/ai/health", requireAdmin, async (_req, res): Promise<void> => {
  invalidateAICache();
  const health = await checkAIHealth();
  res.json(serializeAIHealthCheck(health));
});

// 주기적 헬스체크의 마지막 결과 조회 (대시보드 경고 배너용 — 즉시 응답)
router.get("/admin/settings/ai/health-status", requireAdmin, async (_req, res): Promise<void> => {
  const status = getAIHealthStatus();
  if (!status) {
    // 서버 시작 직후 아직 첫 점검 전 — 배너를 띄우지 않도록 checked: false 반환
    res.json({ checked: false });
    return;
  }
  res.json(serializeAIHealthStatus(status));
});

router.get("/admin/settings/alerts/delivery-status", requireAdmin, async (_req, res): Promise<void> => {
  res.json(serializeGuidedPromptDeliveryAdminStatus(getGuidedPromptDeliveryAdminStatus()));
});

// 연결 테스트: 현재 설정으로 간단한 completion 호출
router.post("/admin/settings/ai/test", requireAdmin, async (_req, res): Promise<void> => {
  try {
    invalidateAICache();
    const ai = await getAI();
    const started = Date.now();
    const response = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [{ role: "user", content: "1+1=? 숫자만 답하세요." }],
    });
    res.json({
      ok: true,
      model: ai.model,
      latencyMs: Date.now() - started,
      reply: response.choices[0]?.message?.content ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ ok: false, error: message });
  }
});
export default router;
