import { beforeEach, describe, expect, it, vi } from "vitest";

const { rows } = vi.hoisted(() => ({ rows: { value: [] as { key: string; value: string }[] } }));

vi.mock("@workspace/db", () => ({
  settingsTable: { key: "key" },
  db: {
    select: () => ({ from: () => ({ where: async () => rows.value }) }),
  },
}));

import { getAI, getAIConfig, invalidateAICache, resolveRoleModel } from "./openai";

describe("resolveRoleModel", () => {
  const config = {
    apiKey: "k",
    baseUrl: undefined,
    model: "main-model",
    roleModels: { interview: "interview-model", light: "  " },
  };

  it("uses the base model for screening", () => {
    expect(resolveRoleModel(config, "screening")).toBe("main-model");
  });

  it("uses the role model when set", () => {
    expect(resolveRoleModel(config, "interview")).toBe("interview-model");
  });

  it("falls back to the base model when the role model is empty or missing", () => {
    expect(resolveRoleModel(config, "light")).toBe("main-model");
    expect(resolveRoleModel(config, "vision")).toBe("main-model");
    expect(resolveRoleModel({ apiKey: "k", baseUrl: undefined, model: "m" }, "vision")).toBe("m");
  });
});

describe("getAI role selection", () => {
  beforeEach(() => {
    invalidateAICache();
    rows.value = [
      { key: "ai_api_key", value: "test-key" },
      { key: "ai_model", value: "main-model" },
      { key: "ai_model_interview", value: "interview-model" },
      { key: "ai_model_vision", value: "vision-model" },
    ];
  });

  it("reads role models from settings", async () => {
    const config = await getAIConfig();
    expect(config.roleModels).toEqual({ interview: "interview-model", vision: "vision-model" });
  });

  it("returns the model for each role, including from the cache", async () => {
    expect((await getAI()).model).toBe("main-model");
    expect((await getAI("interview")).model).toBe("interview-model");
    expect((await getAI("vision")).model).toBe("vision-model");
    expect((await getAI("light")).model).toBe("main-model");
  });
});
