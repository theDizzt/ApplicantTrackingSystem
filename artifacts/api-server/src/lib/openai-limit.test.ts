import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// openai.ts는 DB 클라이언트를 불러오므로 막아 둔다 (여기서는 설정 조회를 쓰지 않음)
vi.mock("@workspace/db", () => ({ db: {}, settingsTable: {} }));

import { aiBlockedMessage, createAIClient, resetAIBlockForTest } from "./openai";

function chatOk() {
  return new Response(JSON.stringify({
    id: "x", object: "chat.completion", created: 0, model: "m",
    choices: [{ index: 0, message: { role: "assistant", content: "{}" }, finish_reason: "stop" }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

const ask = (client: ReturnType<typeof createAIClient>) =>
  client.chat.completions.create({ model: "m", messages: [{ role: "user", content: "hi" }] });

describe("AI 호출 제한", () => {
  beforeEach(() => resetAIBlockForTest());
  afterEach(() => { vi.unstubAllGlobals(); resetAIBlockForTest(); });

  it("동시에 한 개씩만 보낸다", async () => {
    let active = 0;
    let maxActive = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      active += 1; maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active -= 1;
      return chatOk();
    }));
    const client = createAIClient({ apiKey: "k", baseURL: "https://ai.example/v1" });
    await Promise.all([ask(client), ask(client), ask(client)]);
    expect(maxActive).toBe(1);
  });

  it("차단 응답을 받으면 쉬는 시간 동안 AI 서버에 다시 보내지 않는다", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ error: "security_policy_blocked", message: "[경고 3/10] 차단" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const client = createAIClient({ apiKey: "k", baseURL: "https://ai.example/v1" });

    await expect(ask(client)).rejects.toMatchObject({ status: 403 });
    expect(aiBlockedMessage()).toMatch(/일시 차단/);

    await expect(ask(client)).rejects.toMatchObject({ status: 503 });
    await expect(ask(client)).rejects.toThrow(/일시 차단/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("일반 403(키 오류)은 쉬는 시간을 시작하지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: { message: "invalid api key" } }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    )));
    const client = createAIClient({ apiKey: "k", baseURL: "https://ai.example/v1" });
    await expect(ask(client)).rejects.toMatchObject({ status: 403 });
    expect(aiBlockedMessage()).toBeNull();
  });
});
