import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { eq, sql, count, sum, gte, and } from "drizzle-orm";
import { db, usersTable, analysesTable, organizationsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/admin";
import { getAI, getAIConfig, saveSetting, invalidateAICache, checkAIHealth } from "../lib/openai";
import { getAIHealthStatus } from "../lib/ai-health-monitor";

// Admin credentials (hardcoded — change in production via env vars)
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
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
  const { apiKey, baseUrl, model, force } = req.body as {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    force?: boolean;
  };
  // 로컬(Ollama) 설정에서 레지스트리에 존재하지 않는(not_found) 모델명은
  // force 플래그 없이는 저장을 거부한다. (unknown = 조회 불가 상태는 저장 허용)
  if (model !== undefined && model.trim() !== "" && force !== true) {
    const effectiveBaseUrl =
      baseUrl !== undefined ? baseUrl.trim() : ((await getAIConfig()).baseUrl ?? "").trim();
    const ollamaRoot = resolveOllamaRoot(effectiveBaseUrl);
    if (ollamaRoot) {
      // 이미 로컬에 설치된 모델이면 레지스트리에 없어도 허용 (직접 빌드한 모델 등)
      let installedLocally = false;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(`${ollamaRoot}/api/tags`, { signal: controller.signal });
        clearTimeout(timer);
        if (resp.ok) {
          const data = (await resp.json()) as { models?: Array<{ name?: string }> };
          const normalize = (name: string) => (name.includes(":") ? name : `${name}:latest`);
          installedLocally = (data.models ?? []).some(
            (m) => normalize(m.name ?? "") === normalize(model.trim())
          );
        }
      } catch {
        // 조회 실패 시 설치 여부 불명 → 레지스트리 조회 결과로 판단
      }
      if (!installedLocally) {
        const { registryStatus } = await estimateModelSizeBytes(model.trim());
        if (registryStatus === "not_found") {
          res.status(409).json({
            code: "model_not_found",
            error: `모델 "${model.trim()}"이(가) Ollama 레지스트리에 존재하지 않습니다. 모델명에 오타가 없는지 확인하세요.`,
          });
          return;
        }
      }
    }
  }
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
  const ollamaRoot = resolveOllamaRoot(baseUrl);
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

// ── 디스크 사용량 조회 (모델 저장 경로 기준 statfs) ────────────────────────
// 모델 다운로드 전 공간 부족을 미리 알 수 있도록, Ollama 모델이 저장되는
// 디렉터리(없으면 홈 디렉터리)가 위치한 파일시스템의 용량/여유 공간을 반환한다.
async function getModelDiskUsage(): Promise<{
  path: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
}> {
  // 실제 존재하는 모델 디렉터리를 우선 사용, 없으면 홈 디렉터리 기준
  let target = os.homedir();
  for (const blobDir of candidateBlobDirs()) {
    const modelsDir = path.dirname(blobDir);
    try {
      await fs.access(modelsDir);
      target = modelsDir;
      break;
    } catch {
      // 없음 → 다음 후보
    }
  }
  const stat = await fs.statfs(target);
  const totalBytes = Number(stat.blocks) * Number(stat.bsize);
  const freeBytes = Number(stat.bavail) * Number(stat.bsize); // 비특권 사용자 기준 가용 공간
  const usedBytes = totalBytes - Number(stat.bfree) * Number(stat.bsize);
  return {
    path: target,
    totalBytes,
    freeBytes,
    usedBytes,
    usedPercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0,
  };
}

router.get("/admin/settings/ai/disk-usage", requireAdmin, async (_req, res): Promise<void> => {
  try {
    res.json(await getModelDiskUsage());
  } catch (err) {
    res.status(500).json({ error: `디스크 정보 조회 실패: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// 설정된 모델의 예상 다운로드 크기 조회 (다운로드 시작 전 미리보기용)
router.get("/admin/settings/ai/model-size", requireAdmin, async (req, res): Promise<void> => {
  // ?model=... 지정 시 해당 모델 기준, 미지정 시 저장된 모델 기준
  const rawQuery = req.query.model;
  const queryModel = typeof rawQuery === "string" ? rawQuery.trim() : "";
  let model = queryModel;
  if (!model) {
    const config = await getAIConfig();
    model = (config.model ?? "").trim();
  }
  if (!model) {
    res.json({ model: "", sizeBytes: null, requiredBytes: null, registryStatus: "unknown" });
    return;
  }
  const { sizeBytes, registryStatus } = await estimateModelSizeBytes(model);
  // 다운로드에 실제 필요한 공간 = 크기 + 안전 마진 (크기의 10% + 1GB)
  const requiredBytes =
    sizeBytes !== null
      ? Math.round(sizeBytes * (1 + PULL_MARGIN_RATIO)) + PULL_MARGIN_FLAT_BYTES
      : null;
  res.json({ model, sizeBytes, requiredBytes, registryStatus });
});

// 모델 다운로드에 필요한 최소 여유 공간 (10GB) — 모델 크기 조회 실패 시 폴백 임계치.
const MIN_FREE_BYTES_FOR_PULL = 10 * 1024 * 1024 * 1024;
// 예상 모델 크기에 더하는 안전 마진: 크기의 10% + 1GB (임시 파일·메타데이터 여유분)
const PULL_MARGIN_RATIO = 0.1;
const PULL_MARGIN_FLAT_BYTES = 1 * 1024 * 1024 * 1024;

// Ollama 레지스트리에서 모델 manifest를 조회해 예상 다운로드 크기(바이트)를 계산한다.
// registryStatus: "found"(레지스트리에 존재) / "not_found"(404 = 미존재 모델) / "unknown"(조회 불가·실패)
// sizeBytes가 null이면 호출부가 고정 임계치로 폴백.
type ModelSizeResult = {
  sizeBytes: number | null;
  registryStatus: "found" | "not_found" | "unknown";
};
async function estimateModelSizeBytes(model: string): Promise<ModelSizeResult> {
  // 모델명 파싱: [registry/][namespace/]name[:tag]
  // 예: "qwen2.5" → library/qwen2.5:latest, "user/model:7b" → user/model:7b
  let rest = model.trim();
  if (!rest || rest.includes("://")) return { sizeBytes: null, registryStatus: "unknown" };
  let tag = "latest";
  const colonIdx = rest.lastIndexOf(":");
  if (colonIdx > -1 && !rest.slice(colonIdx + 1).includes("/")) {
    tag = rest.slice(colonIdx + 1) || "latest";
    rest = rest.slice(0, colonIdx);
  }
  const parts = rest.split("/").filter(Boolean);
  let registry = "registry.ollama.ai";
  let repo: string;
  if (parts.length === 1) repo = `library/${parts[0]}`;
  else if (parts.length === 2) repo = `${parts[0]}/${parts[1]}`;
  else if (parts.length === 3) { registry = parts[0]; repo = `${parts[1]}/${parts[2]}`; }
  else return { sizeBytes: null, registryStatus: "unknown" };
  // 기본 공식 레지스트리 외 호스트는 조회하지 않음 (SSRF 방지)
  if (registry !== "registry.ollama.ai") return { sizeBytes: null, registryStatus: "unknown" };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(
      `https://${registry}/v2/${repo}/manifests/${encodeURIComponent(tag)}`,
      {
        headers: { Accept: "application/vnd.docker.distribution.manifest.v2+json" },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (resp.status === 404) return { sizeBytes: null, registryStatus: "not_found" };
    if (!resp.ok) return { sizeBytes: null, registryStatus: "unknown" };
    const manifest = (await resp.json()) as {
      layers?: Array<{ size?: number }>;
      config?: { size?: number };
    };
    if (!Array.isArray(manifest.layers)) return { sizeBytes: null, registryStatus: "found" };
    let total = manifest.config?.size ?? 0;
    for (const layer of manifest.layers) {
      if (typeof layer.size === "number" && layer.size > 0) total += layer.size;
    }
    return { sizeBytes: total > 0 ? total : null, registryStatus: "found" };
  } catch {
    return { sizeBytes: null, registryStatus: "unknown" };
  }
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
  cleanedFreedBytes: number | null; // 취소 후 정리된 불완전 파일 용량 (null = 정리 안 함/실패)
  startedAt: number;
  updatedAt: number;
  abortController: AbortController;
};

let pullState: PullState | null = null;

function candidateBlobDirs(): string[] {
  const dirs: string[] = [];
  // install.sh가 .env.production에 기록하는 실제 서비스 경로 (최우선)
  if (process.env.OLLAMA_MODELS) dirs.push(path.join(process.env.OLLAMA_MODELS, "blobs"));
  dirs.push(path.join(os.homedir(), ".ollama", "models", "blobs")); // 사용자 실행 기본 경로
  dirs.push(path.join(os.homedir(), "ollama", "models", "blobs")); // 구(舊) 설치 스크립트 경로
  dirs.push("/usr/share/ollama/.ollama/models/blobs"); // 공식 systemd 서비스 기본 경로
  return [...new Set(dirs)];
}
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
    cleanedFreedBytes: null,
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
      // 취소된 다운로드가 남긴 불완전(partial) blob 정리.
      // 고정 지연은 Ollama의 종료 신호가 아니므로, "한 번 더 스캔했을 때
      // 지울 것이 없고 오류도 없는" 안정 상태가 될 때까지 재시도한다.
      // (취소 직후 Ollama가 아직 파일을 잡고 있거나 다시 쓸 수 있기 때문)
      try {
        let totalDeleted = 0;
        let totalFreed = 0;
        let stable = false;
        let lastErrors: string[] = [];
        let consecutiveClean = 0;
        for (let attempt = 0; attempt < 6; attempt++) {
          await new Promise((r) => setTimeout(r, 1500));
          // 그 사이 새 pull이 시작됐으면 그 blob을 건드리지 않도록 중단
          if (pullState !== state && pullState?.inProgress) break;
          const result = await cleanupPartialBlobs();
          totalDeleted += result.deletedCount;
          totalFreed += result.freedBytes;
          lastErrors = result.errors;
          if (result.deletedCount === 0 && result.errors.length === 0) {
            // 빈 스캔 1회는 종료 신호가 아님 — Ollama가 취소 직후 파일을
            // 늦게 쓸 수 있으므로 연속 2회 깨끗해야 안정 상태로 판단
            consecutiveClean += 1;
            if (consecutiveClean >= 2) { stable = true; break; }
          } else {
            consecutiveClean = 0;
          }
        }
        state.cleanedFreedBytes = totalFreed;
        if (!stable) {
          // 잔여 파일/권한 오류가 남음 → 관리자에게 수동 정리 재시도 안내
          state.status = lastErrors.length > 0
            ? `취소됨 — 임시 파일 일부를 정리하지 못했습니다 (${lastErrors[0]}). '임시 파일 정리' 버튼으로 다시 시도하세요.`
            : "취소됨 — 임시 파일이 남아 있을 수 있습니다. '임시 파일 정리' 버튼으로 다시 시도하세요.";
        } else if (totalDeleted > 0) {
          state.status = `취소됨 — 임시 파일 ${totalDeleted}개 정리 (${(totalFreed / 1024 / 1024 / 1024).toFixed(1)}GB 확보)`;
        } else {
          state.status = "취소됨 — 정리할 임시 파일 없음";
        }
      } catch {
        // 정리 실패는 취소 자체를 방해하지 않음 (수동 정리 엔드포인트로 재시도 가능)
        state.status = "취소됨 — 임시 파일 정리 실패. '임시 파일 정리' 버튼으로 다시 시도하세요.";
      }
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
    cleanedFreedBytes: s.cleanedFreedBytes,
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
  // 다운로드 시작 전 디스크 여유 공간 확인 — 부족하면 시작 자체를 거부해
  // 중간 실패와 불완전 임시 파일 낭비를 예방한다.
  // 조회 실패 시에는 안전을 위해 시작을 거부한다(fail closed).
  try {
    const [disk, sizeResult] = await Promise.all([
      getModelDiskUsage(),
      estimateModelSizeBytes(model),
    ]);
    const modelSizeBytes = sizeResult.sizeBytes;
    if (sizeResult.registryStatus === "not_found") {
      res.status(400).json({
        error: `모델 '${model}'을(를) Ollama 레지스트리에서 찾을 수 없습니다. 모델명에 오타가 없는지 확인하세요.`,
      });
      return;
    }
    const freeGB = (disk.freeBytes / 1024 / 1024 / 1024).toFixed(1);
    if (modelSizeBytes !== null) {
      // 모델 크기 조회 성공 → 실제 필요 용량(크기 + 마진)과 비교
      const requiredBytes = Math.ceil(
        modelSizeBytes * (1 + PULL_MARGIN_RATIO) + PULL_MARGIN_FLAT_BYTES
      );
      if (disk.freeBytes < requiredBytes) {
        const modelGB = (modelSizeBytes / 1024 / 1024 / 1024).toFixed(1);
        const requiredGB = (requiredBytes / 1024 / 1024 / 1024).toFixed(1);
        res.status(400).json({
          error: `디스크 여유 공간이 부족합니다. 모델 '${model}'의 예상 크기는 ${modelGB}GB이며, 안전 마진을 포함해 약 ${requiredGB}GB의 여유 공간이 필요합니다 (현재 남은 공간 ${freeGB}GB). 사용하지 않는 모델을 삭제하거나 임시 파일을 정리한 뒤 다시 시도하세요.`,
        });
        return;
      }
    } else if (disk.freeBytes < MIN_FREE_BYTES_FOR_PULL) {
      // 크기 조회 실패 → 기존 고정 임계치(10GB)로 폴백
      res.status(400).json({
        error: `디스크 여유 공간이 부족합니다 (남은 공간 ${freeGB}GB, 최소 10GB 필요). 사용하지 않는 모델을 삭제하거나 임시 파일을 정리한 뒤 다시 시도하세요.`,
      });
      return;
    }
  } catch (err) {
    res.status(503).json({
      error: `디스크 여유 공간을 확인할 수 없어 다운로드를 시작하지 않았습니다: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }
  // 진행 여부 확인과 시작을 원자적으로 처리 — 위의 await 이후 다른 요청이
  // 먼저 시작했을 수 있으므로 여기서 다시 확인하고, runPull은 첫 await 전에
  // pullState를 동기적으로 설정하므로 이 구간에서 이중 시작이 불가능하다.
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

// 불완전(partial) 임시 파일 수동 정리: 이전에 취소된 다운로드가 남긴 파일을
// 관리자가 버튼 한 번으로 정리할 수 있게 한다. 진행 중인 다운로드가 있으면 거부.
router.post("/admin/settings/ai/local-cleanup", requireAdmin, async (_req, res): Promise<void> => {
  const config = await getAIConfig();
  if (!resolveOllamaRoot((config.baseUrl ?? "").trim())) {
    res.status(400).json({ error: "로컬 Ollama가 설정되어 있지 않습니다." });
    return;
  }
  if (pullState?.inProgress) {
    res.status(409).json({ error: "모델 다운로드가 진행 중입니다. 완료 또는 취소 후 정리하세요." });
    return;
  }
  const result = await cleanupPartialBlobs();
  res.json({ ok: true, deletedCount: result.deletedCount, freedBytes: result.freedBytes, errors: result.errors });
});

// 설치된 모델 삭제 (Ollama DELETE /api/delete 프록시)
// manifest와 다른 모델이 공유하지 않는 레이어(blob)가 삭제되어 디스크가 확보된다.
router.delete("/admin/settings/ai/local-models", requireAdmin, async (req, res): Promise<void> => {
  const config = await getAIConfig();
  const ollamaRoot = resolveOllamaRoot((config.baseUrl ?? "").trim());
  if (!ollamaRoot) {
    res.status(400).json({ error: "로컬 Ollama가 설정되어 있지 않습니다. Base URL을 확인하세요." });
    return;
  }
  const model = typeof req.body?.model === "string" ? req.body.model.trim() : "";
  if (!model) {
    res.status(400).json({ error: "삭제할 모델명을 지정해주세요." });
    return;
  }
  // 진행 중인 다운로드 대상 모델은 삭제 금지 (blob 경합 방지)
  if (pullState?.inProgress) {
    res.status(409).json({ error: "모델 다운로드가 진행 중입니다. 완료 또는 취소 후 삭제하세요." });
    return;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const resp = await fetch(`${ollamaRoot}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (resp.status === 404) {
      res.status(404).json({ error: `모델 '${model}'을(를) 찾을 수 없습니다.` });
      return;
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      res.status(502).json({ error: `Ollama 응답 오류 (HTTP ${resp.status})${text ? `: ${text.slice(0, 200)}` : ""}` });
      return;
    }
    res.json({ ok: true, model });
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError"
      ? "삭제 요청 시간 초과 (10초)"
      : err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: message });
  }
});

// 현재 AI 연결 상태 점검 (모델 목록 조회 기반, 5초 타임아웃)
router.get("/admin/settings/ai/health", requireAdmin, async (_req, res): Promise<void> => {
  invalidateAICache();
  const health = await checkAIHealth();
  res.json(health);
});

// 주기적 헬스체크의 마지막 결과 조회 (대시보드 경고 배너용 — 즉시 응답)
router.get("/admin/settings/ai/health-status", requireAdmin, async (_req, res): Promise<void> => {
  const status = getAIHealthStatus();
  if (!status) {
    // 서버 시작 직후 아직 첫 점검 전 — 배너를 띄우지 않도록 checked: false 반환
    res.json({ checked: false });
    return;
  }
  res.json({ checked: true, ...status });
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

const PARTIAL_BLOB_RE = /^sha256[-:][0-9a-f]{64}-partial(-\d+)?$/;

// 취소된 pull이 남긴 불완전(partial) blob 정리. Ollama는 다운로드 중인 레이어를
// blobs 디렉터리에 "sha256-<digest>-partial(-N)" 파일로 저장하는데, pull을 취소하면
// 이 파일들이 그대로 남아 디스크를 차지한다. API 서버가 Ollama와 같은 호스트에서
// 돌기 때문에(localhost 전용) 직접 정리한다.
async function cleanupPartialBlobs(): Promise<{ deletedCount: number; freedBytes: number; errors: string[] }> {
  let deletedCount = 0;
  let freedBytes = 0;
  const errors: string[] = [];
  for (const dir of candidateBlobDirs()) {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue; // 디렉터리 없음 → 다음 후보
    }
    for (const name of entries) {
      if (!PARTIAL_BLOB_RE.test(name)) continue;
      const filePath = path.join(dir, name);
      try {
        const stat = await fs.stat(filePath);
        await fs.unlink(filePath);
        deletedCount += 1;
        freedBytes += stat.size;
      } catch (err) {
        errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return { deletedCount, freedBytes, errors };
}
