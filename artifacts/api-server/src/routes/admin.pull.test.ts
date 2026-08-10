/**
 * 통합 테스트: 모델 다운로드(pull) 진행률이 절대 뒤로 가지 않는지 검증.
 *
 * 시나리오: 가짜 Ollama 서버가 /api/pull 스트림으로
 *   1) 큰 레이어(1MB)를 0 → 100% 진행
 *   2) 작은 메타데이터 레이어(1KB)를 completed=0부터 진행 (naive 구현이면 percent가 0%로 떨어짐)
 * 를 순차 전송하는 동안, /admin/settings/ai/local-pull/status 의 percent가
 * 단조 증가하고 완료 시 100이 되는지 확인한다.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import express from "express";

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
const BIG_TOTAL = 1_000_000;
const SMALL_TOTAL = 1_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 가짜 Ollama: /api/tags(빈 목록) + /api/pull(레이어 2개 순차 스트림)
function startFakeOllama(): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/api/tags") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ models: [] }));
      return;
    }
    if (req.url === "/api/pull" && req.method === "POST") {
      req.resume(); // 본문 소비
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      const send = (obj: unknown) => res.write(JSON.stringify(obj) + "\n");
      send({ status: "pulling manifest" });
      await sleep(30);
      // 큰 레이어: 10단계로 진행
      for (let i = 1; i <= 10; i++) {
        send({
          status: "pulling sha256:big",
          digest: "sha256:big",
          total: BIG_TOTAL,
          completed: Math.round((BIG_TOTAL * i) / 10),
        });
        await sleep(30);
      }
      // 작은 메타데이터 레이어: completed=0부터 다시 시작 (회귀 유발 지점)
      send({ status: "pulling sha256:small", digest: "sha256:small", total: SMALL_TOTAL, completed: 0 });
      await sleep(60);
      send({ status: "pulling sha256:small", digest: "sha256:small", total: SMALL_TOTAL, completed: SMALL_TOTAL });
      await sleep(30);
      send({ status: "verifying sha256 digest" });
      send({ status: "success" });
      res.end();
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

// 실제 네트워크(레지스트리 조회)를 막고 "found + 작은 크기"로 응답,
// 그 외 요청은 진짜 fetch로 통과시킨다.
const realFetch = globalThis.fetch;

beforeAll(async () => {
  vi.stubGlobal("fetch", (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    if (url.includes("registry.ollama.ai")) {
      return new Response(
        JSON.stringify({ layers: [{ size: BIG_TOTAL }, { size: SMALL_TOTAL }], config: { size: 100 } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return realFetch(input, init);
  }) as typeof fetch);

  ollama = await startFakeOllama();

  const { default: adminRouter } = await import("./admin");
  const app = express();
  app.use(express.json());
  // 세션 스텁 (requireAdmin은 이미 통과 처리됨)
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
  await new Promise((r) => ollama?.close(r));
  await new Promise((r) => api?.close(r));
});

describe("모델 다운로드 진행률", () => {
  it("percent가 절대 감소하지 않고 완료 시 100이 된다", async () => {
    const startResp = await realFetch(`${apiBase}/admin/settings/ai/local-pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect([200, 202]).toContain(startResp.status);

    const percents: number[] = [];
    let lastPercent = -1;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const resp = await realFetch(`${apiBase}/admin/settings/ai/local-pull/status`);
      expect(resp.status).toBe(200);
      const body = (await resp.json()) as {
        active: boolean;
        inProgress?: boolean;
        percent?: number | null;
        error?: string | null;
        done?: boolean;
      };
      if (body.active && typeof body.percent === "number") {
        percents.push(body.percent);
        // 핵심 검증: 진행률이 뒤로 가지 않음
        expect(body.percent).toBeGreaterThanOrEqual(lastPercent);
        lastPercent = body.percent;
      }
      if (body.active && body.error) throw new Error(`pull 오류: ${body.error}`);
      if (body.active && body.done) break;
      await sleep(10);
    }

    // 완료 상태 확인
    const finalResp = await realFetch(`${apiBase}/admin/settings/ai/local-pull/status`);
    const final = (await finalResp.json()) as {
      done: boolean;
      percent: number | null;
      inProgress: boolean;
      error: string | null;
    };
    expect(final.error).toBeNull();
    expect(final.done).toBe(true);
    expect(final.inProgress).toBe(false);
    expect(final.percent).toBe(100);

    // 진행 중에 실제로 여러 샘플을 관찰했는지 (테스트 자체의 유효성)
    expect(percents.length).toBeGreaterThan(3);
    // 큰 레이어 완료 후 작은 레이어 시작 구간에서도 감소가 없었음은
    // 위 루프의 단조 증가 단언으로 이미 보장됨
  }, 30_000);
});
