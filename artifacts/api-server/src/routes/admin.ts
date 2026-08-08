import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { eq, sql, count, sum, gte, and } from "drizzle-orm";
import { db, usersTable, analysesTable, organizationsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/admin";
import { getAI, getAIConfig, saveSetting, invalidateAICache, checkAIHealth } from "../lib/openai";

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

// 로컬 Ollama URL 검증 (SSRF 방지: 로컬 Ollama일 때만 허용)
function resolveOllamaRoot(baseUrl: string): string | null {
  try {
    const parsed = new URL(baseUrl);
    const localHosts = ["localhost", "127.0.0.1", "[::1]", "::1"];
    const isOllamaPort = (parsed.port || (parsed.protocol === "http:" ? "80" : "443")) === "11434";
    if (parsed.protocol === "http:" && localHosts.includes(parsed.hostname) && isOllamaPort) {
      return `http://${parsed.hostname}:11434`;
    }
  } catch {
    // 잘못된 URL
  }
  return null;
}

// ── 모델 다운로드(pull) 상태를 서버 메모리에 추적 ──────────────────────────
// 브라우저가 페이지를 벗어나도 서버가 pull을 계속 진행하고,
// 재접속 시 GET /local-pull/status 로 진행률을 다시 볼 수 있게 한다.
type PullState = {
  model: string;
  inProgress: boolean;
  status: string;          // Ollama가 보내는 단계 메시지 (예: "pulling manifest")
  completedBytes: number;
  totalBytes: number;
  error: string | null;
  done: boolean;           // 성공적으로 완료됨
  cancelled: boolean;      // 관리자가 취소함
  startedAt: number;
  updatedAt: number;
  abortController: AbortController;
};

let pullState: PullState | null = null;

async function runPull(ollamaRoot: string, model: string): Promise<void> {
  const state: PullState = {
    model,
    inProgress: true,
    status: "요청 중...",
    completedBytes: 0,
    totalBytes: 0,
    error: null,
    done: false,
    cancelled: false,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    abortController: new AbortController(),
  };
  pullState = state;
  try {
    const upstream = await fetch(`${ollamaRoot}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
      signal: state.abortController.signal,
    });
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      throw new Error(`Ollama 응답 오류 (HTTP ${upstream.status})${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const d = JSON.parse(trimmed) as { status?: string; completed?: number; total?: number; error?: string };
          if (d.error) throw new Error(String(d.error));
          state.status = String(d.status ?? state.status);
          if (typeof d.total === "number" && d.total > 0) {
            state.totalBytes = d.total;
            state.completedBytes = Number(d.completed ?? 0);
          }
          state.updatedAt = Date.now();
        } catch (err) {
          if (err instanceof SyntaxError) continue; // 불완전한 JSON 라인 무시
          throw err;
        }
      }
    }
    state.done = true;
    state.status = "완료";
  } catch (err) {
    if (state.cancelled || (err instanceof Error && err.name === "AbortError")) {
      state.cancelled = true;
      state.status = "취소됨";
    } else {
      state.error = err instanceof Error ? err.message : String(err);
    }
  } finally {
    state.inProgress = false;
    state.updatedAt = Date.now();
  }
}

// 진행 중/최근 pull 상태 조회 (페이지 재진입 시 진행률 복원용)
router.get("/admin/settings/ai/local-pull/status", requireAdmin, async (_req, res): Promise<void> => {
  if (!pullState) {
    res.json({ active: false });
    return;
  }
  const s = pullState;
  res.json({
    active: true,
    model: s.model,
    inProgress: s.inProgress,
    status: s.status,
    completedBytes: s.completedBytes,
    totalBytes: s.totalBytes,
    percent: s.totalBytes > 0 ? Math.min(100, Math.round((s.completedBytes / s.totalBytes) * 100)) : null,
    error: s.error,
    done: s.done,
    cancelled: s.cancelled,
    startedAt: s.startedAt,
    updatedAt: s.updatedAt,
  });
});

// 로컬 LLM(Ollama) 모델 다운로드 시작: 서버가 백그라운드로 pull을 진행하고
// 클라이언트는 /local-pull/status 를 폴링해 진행률을 본다.
router.post("/admin/settings/ai/local-pull", requireAdmin, async (_req, res): Promise<void> => {
  const config = await getAIConfig();
  const baseUrl = (config.baseUrl ?? "").trim();
  const ollamaRoot = resolveOllamaRoot(baseUrl);
  if (!ollamaRoot) {
    res.status(400).json({ error: "로컬 Ollama가 설정되어 있지 않습니다. Base URL을 확인하세요." });
    return;
  }
  const model = (config.model ?? "").trim();
  if (!model) {
    res.status(400).json({ error: "설정된 모델명이 없습니다. AI 공급자 설정에서 모델명을 먼저 지정하세요." });
    return;
  }
  if (pullState?.inProgress) {
    // 이미 진행 중이면 새로 시작하지 않고 현재 상태를 안내
    res.status(202).json({ ok: true, alreadyRunning: true, model: pullState.model });
    return;
  }
  // 백그라운드로 시작 (요청과 분리 — 페이지를 닫아도 계속 진행)
  void runPull(ollamaRoot, model);
  res.status(202).json({ ok: true, alreadyRunning: false, model });
});

// 진행 중인 모델 다운로드 취소: 업스트림 fetch를 중단하고 상태를 초기화한다.
router.post("/admin/settings/ai/local-pull/cancel", requireAdmin, async (_req, res): Promise<void> => {
  if (!pullState || !pullState.inProgress) {
    // 진행 중인 다운로드가 없으면 남은 상태만 정리
    pullState = null;
    res.json({ ok: true, wasRunning: false });
    return;
  }
  pullState.cancelled = true;
  pullState.status = "취소 중...";
  pullState.updatedAt = Date.now();
  pullState.abortController.abort();
  res.json({ ok: true, wasRunning: true });
});

// 현재 AI 연결 상태 점검 (모델 목록 조회 기반, 5초 타임아웃)
router.get("/admin/settings/ai/health", requireAdmin, async (_req, res): Promise<void> => {
  invalidateAICache();
  const health = await checkAIHealth();
  res.json(health);
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
