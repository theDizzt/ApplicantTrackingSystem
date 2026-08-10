/**
 * 통합 테스트: 수동 '임시 파일 정리' 버튼(POST /admin/settings/ai/local-cleanup)이
 *   1) 정상 정리 시 deletedCount/freedBytes를 정확히 반환하고
 *   2) 삭제 불가 파일(디렉터리 쓰기 권한 제거)은 errors 배열로 정확히 보고하며
 *   3) 다운로드(pull) 진행 중에는 409로 거부하는지
 * 검증한다. admin.pull.test.ts의 mock 패턴을 재사용한다.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import express from "express";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// admin.ts가 끌어오는 무거운 의존성(DB, 세션, OpenAI)을 모두 스텁 처리
vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: {},
  analysesTable: {},
  organizationsTable: {},
}));
vi.mock("../middlewares/admin", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../lib/openai", () => ({
  getAI: vi.fn(),
  getAIConfig: vi.fn(async () => ({
    apiKey: "",
    baseUrl: "http://127.0.0.1:11434",
    model: "test-model",
  })),
  saveSetting: vi.fn(),
  invalidateAICache: vi.fn(),
  checkAIHealth: vi.fn(),
}));
vi.mock("../lib/ai-health-monitor", () => ({
  getAIHealthStatus: vi.fn(() => ({})),
}));

const OLLAMA_PORT = 11434; // resolveOllamaRoot는 이 포트만 로컬 Ollama로 인정
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 가짜 Ollama: /api/tags(빈 목록) + /api/pull(취소 전까지 진행 라인을 계속 보냄)
function startFakeOllama(): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/api/tags") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ models: [] }));
      return;
    }
    if (req.url === "/api/pull" && req.method === "POST") {
      req.resume();
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      const send = (obj: unknown) => res.write(JSON.stringify(obj) + "\n");
      send({ status: "pulling manifest" });
      let completed = 0;
      const timer = setInterval(() => {
        completed += 10_000;
        try {
          send({
            status: "pulling sha256:big",
            digest: "sha256:big",
            total: 1_000_000,
            completed: Math.min(completed, 999_999),
          });
        } catch {
          clearInterval(timer);
        }
      }, 25);
      const stop = () => { clearInterval(timer); try { res.end(); } catch { /* noop */ } };
      res.on("close", stop);
      res.on("error", stop);
      req.socket.on("close", stop);
      return;
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(OLLAMA_PORT, "127.0.0.1", () => resolve(server));
  });
}

let ollama: http.Server;
let api: http.Server;
let apiBase: string;

// 레지스트리 조회는 스텁, 그 외 요청은 진짜 fetch로 통과
const realFetch = globalThis.fetch;

let modelsDir: string;
let blobsDir: string;
const prevOllamaModels = process.env.OLLAMA_MODELS;

beforeAll(async () => {
  vi.stubGlobal("fetch", (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    if (url.includes("registry.ollama.ai")) {
      return new Response(
        JSON.stringify({ layers: [{ size: 1_000_000 }], config: { size: 100 } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return realFetch(input, init);
  }) as typeof fetch);

  // 격리된 OLLAMA_MODELS 경로 (candidateBlobDirs가 최우선으로 사용)
  modelsDir = await fs.mkdtemp(path.join(os.tmpdir(), "ollama-cleanup-"));
  blobsDir = path.join(modelsDir, "blobs");
  await fs.mkdir(blobsDir, { recursive: true });
  process.env.OLLAMA_MODELS = modelsDir;

  ollama = await startFakeOllama();

  const { default: adminRouter } = await import("./admin");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { isAdmin: true };
    next();
  });
  app.use(adminRouter);
  api = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = api.address();
  if (typeof addr === "string" || addr === null) throw new Error("no address");
  apiBase = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  if (prevOllamaModels === undefined) delete process.env.OLLAMA_MODELS;
  else process.env.OLLAMA_MODELS = prevOllamaModels;
  await fs.chmod(blobsDir, 0o755).catch(() => { /* noop */ });
  await fs.rm(modelsDir, { recursive: true, force: true });
  // setup이 중간에 실패했을 수 있으므로 서버가 실제로 생성된 경우에만 close 대기
  if (ollama) await new Promise((r) => ollama.close(r));
  if (api) await new Promise((r) => api.close(r));
});

afterEach(async () => {
  // 각 테스트 후 blobs 디렉터리 초기화 (권한 복구 포함)
  await fs.chmod(blobsDir, 0o755).catch(() => { /* noop */ });
  for (const name of await fs.readdir(blobsDir).catch(() => [] as string[])) {
    await fs.rm(path.join(blobsDir, name), { force: true });
  }
});

const partialName = (ch: string, suffix = "") => `sha256-${ch.repeat(64)}-partial${suffix}`;

async function postCleanup() {
  const resp = await realFetch(`${apiBase}/admin/settings/ai/local-cleanup`, { method: "POST" });
  return {
    status: resp.status,
    body: (await resp.json()) as {
      ok?: boolean;
      deletedCount?: number;
      freedBytes?: number;
      errors?: string[];
      error?: string;
    },
  };
}

describe("수동 임시 파일 정리 (POST /admin/settings/ai/local-cleanup)", () => {
  it("정상 정리 시 deletedCount/freedBytes를 반환하고 partial 파일만 삭제한다", async () => {
    const a = path.join(blobsDir, partialName("a"));
    const b = path.join(blobsDir, partialName("b", "-3"));
    const complete = path.join(blobsDir, "sha256-" + "c".repeat(64)); // 완성 blob — 삭제 금지
    await fs.writeFile(a, Buffer.alloc(1024, 1));
    await fs.writeFile(b, Buffer.alloc(2048, 2));
    await fs.writeFile(complete, Buffer.alloc(512, 3));

    const { status, body } = await postCleanup();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.deletedCount).toBe(2);
    expect(body.freedBytes).toBe(1024 + 2048);
    expect(body.errors).toEqual([]);

    await expect(fs.access(a)).rejects.toThrow();
    await expect(fs.access(b)).rejects.toThrow();
    await expect(fs.access(complete)).resolves.toBeUndefined(); // 완성 blob은 그대로
  });

  it("삭제 불가 파일은 파일명이 포함된 errors 항목으로 보고된다", async () => {
    const lockedName = partialName("d");
    await fs.writeFile(path.join(blobsDir, lockedName), Buffer.alloc(4096, 4));
    // 디렉터리 쓰기 권한 제거 → unlink가 EACCES로 실패
    await fs.chmod(blobsDir, 0o555);

    const { status, body } = await postCleanup();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.deletedCount).toBe(0);
    expect(body.freedBytes).toBe(0);
    expect(body.errors).toHaveLength(1);
    // 관리자가 어떤 파일이 왜 실패했는지 알 수 있어야 한다
    expect(body.errors![0]).toContain(lockedName);
    expect(body.errors![0]).toMatch(/EACCES|permission/i);

    // 파일은 여전히 남아 있음
    await fs.chmod(blobsDir, 0o755);
    await expect(fs.access(path.join(blobsDir, lockedName))).resolves.toBeUndefined();
  });

  it("모델 다운로드 진행 중에는 409로 거부한다", async () => {
    const startResp = await realFetch(`${apiBase}/admin/settings/ai/local-pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(startResp.status).toBe(202);
    try {
      // 진행 중 상태가 실제로 관찰될 때까지 대기
      let inProgress = false;
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const resp = await realFetch(`${apiBase}/admin/settings/ai/local-pull/status`);
        const body = (await resp.json()) as { active: boolean; inProgress?: boolean };
        if (body.active && body.inProgress) { inProgress = true; break; }
        await sleep(20);
      }
      expect(inProgress).toBe(true);

      const { status, body } = await postCleanup();
      expect(status).toBe(409);
      expect(body.error).toContain("진행 중");
    } finally {
      // 취소하고 정리 루프가 끝날 때까지 대기 (다른 테스트에 영향 없도록)
      await realFetch(`${apiBase}/admin/settings/ai/local-pull/cancel`, { method: "POST" });
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        const resp = await realFetch(`${apiBase}/admin/settings/ai/local-pull/status`);
        const body = (await resp.json()) as { active: boolean; inProgress?: boolean };
        if (!body.active || body.inProgress === false) break;
        await sleep(100);
      }
    }
  }, 40_000);
});
