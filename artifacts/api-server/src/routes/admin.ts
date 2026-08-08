import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { eq, sql, count, sum, gte, and } from "drizzle-orm";
import { db, usersTable, analysesTable, organizationsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/admin";
import { getAI, getAIConfig, saveSetting, invalidateAICache } from "../lib/openai";

// Admin credentials (hardcoded — change in production via env vars)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "park1058";
const ADMIN_PASSWORD_HASH =
  process.env.ADMIN_PASSWORD_HASH ??
  "$2b$10$bXvyhksqpSdRmMO3LuGJE.xdVS9aWKfLw06YbPDFL/jqmt3dOcWLa";

// Subscription pricing (must match subscription.ts)
const PLAN_PRICES: Record<string, number> = { free: 0, basic: 9900, premium: 19900 };

// Token cost estimation (OpenAI gpt pricing per 1M tokens, KRW ≈ 1350/USD)
const INPUT_COST_PER_1M_USD = 2.5;
const OUTPUT_COST_PER_1M_USD = 10.0;
const USD_TO_KRW = 1_350;

declare module "express-session" {
  interface SessionData {
    isAdmin?: boolean;
  }
}

const router: IRouter = Router();

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
router.get("/admin/settings/ai", requireAdmin, async (_req, res): Promise<void> => {
  const config = await getAIConfig();
  // 키는 마스킹해서 반환
  const masked = config.apiKey
    ? config.apiKey.slice(0, 6) + "…" + config.apiKey.slice(-4)
    : "";
  res.json({
    apiKeyMasked: masked,
    hasApiKey: !!config.apiKey,
    baseUrl: config.baseUrl ?? "",
    model: config.model,
  });
});

router.put("/admin/settings/ai", requireAdmin, async (req, res): Promise<void> => {
  const { apiKey, baseUrl, model } = req.body as {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
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
  res.json({ ok: true });
});

// 로컬 LLM(Ollama) 설치 상태 확인: 서버 응답 여부 + 다운로드된 모델 목록
router.get("/admin/settings/ai/local-status", requireAdmin, async (_req, res): Promise<void> => {
  const config = await getAIConfig();
  const baseUrl = (config.baseUrl ?? "").trim();
  // 로컬 Ollama로 판단되는 경우에만 상태 조회 (SSRF 방지: 임의 URL로 서버측 요청 금지)
  let ollamaRoot: string | null = null;
  try {
    const parsed = new URL(baseUrl);
    const localHosts = ["localhost", "127.0.0.1", "[::1]", "::1"];
    const isOllamaPort = (parsed.port || (parsed.protocol === "http:" ? "80" : "443")) === "11434";
    if (parsed.protocol === "http:" && localHosts.includes(parsed.hostname) && isOllamaPort) {
      ollamaRoot = `http://${parsed.hostname}:11434`;
    }
  } catch {
    // baseUrl이 비었거나 잘못된 경우 → 로컬 AI 미설정으로 처리
  }
  const isLocal = ollamaRoot !== null;
  if (!ollamaRoot) {
    res.json({ isLocal: false, baseUrl, serverUp: false, models: [], configuredModel: config.model, modelInstalled: false });
    return;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${ollamaRoot}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) {
      res.json({ isLocal, baseUrl, serverUp: false, models: [], configuredModel: config.model, modelInstalled: false, error: `서버 응답 오류 (HTTP ${resp.status})` });
      return;
    }
    const data = (await resp.json()) as { models?: Array<{ name?: string; size?: number; modified_at?: string }> };
    const models = (data.models ?? []).map((m) => ({
      name: m.name ?? "",
      sizeBytes: m.size ?? 0,
      modifiedAt: m.modified_at ?? "",
    }));
    const configured = (config.model ?? "").trim();
    // Ollama 태그 규칙: 태그 없는 이름은 ":latest"로 해석됨 (예: "qwen2.5" === "qwen2.5:latest")
    const normalize = (name: string) => (name.includes(":") ? name : `${name}:latest`);
    const modelInstalled = !!configured && models.some(
      (m) => normalize(m.name) === normalize(configured)
    );
    res.json({ isLocal, baseUrl, serverUp: true, models, configuredModel: configured, modelInstalled });
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError"
      ? "연결 시간 초과 (3초)"
      : err instanceof Error ? err.message : String(err);
    res.json({ isLocal, baseUrl, serverUp: false, models: [], configuredModel: config.model, modelInstalled: false, error: message });
  }
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
