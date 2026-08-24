import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

type FakeUser = {
  id: number;
  subscriptionStatus: string;
  subscriptionPlanId: string | null;
  subscriptionExpiresAt: Date | null;
  hasUnlimitedAnalyses: boolean;
  analysesUsedThisMonth: number;
};

const { users } = vi.hoisted(() => ({ users: new Map<number, FakeUser>() }));

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: { session: { userId?: number } }, _res: unknown, next: () => void) => {
    req.session = { userId: 1 };
    next();
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
}));

vi.mock("../lib/subscription-limits", () => ({
  LIMITS: { free: 1, basic: 5, premium: 20 },
  hasUnlimitedAnalyses: (user: FakeUser) => user.hasUnlimitedAnalyses,
  syncSubscription: async (user: FakeUser) => user,
}));

vi.mock("@workspace/db", () => {
  const db = {
    select: () => ({
      from: () => ({
        where: () => {
          const user = users.get(1);
          return Promise.resolve(user ? [{ ...user }] : []);
        },
      }),
    }),
    update: () => ({
      set: (values: Partial<FakeUser>) => ({
        where: () => {
          const user = users.get(1);
          if (user) Object.assign(user, values);
          return {
            returning: () => Promise.resolve(user ? [{ ...user }] : []),
            then: (resolve: (value: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
          };
        },
      }),
    }),
  };
  return {
    db,
    usersTable: {
      id: "id",
      subscriptionStatus: "subscriptionStatus",
      subscriptionPlanId: "subscriptionPlanId",
      subscriptionExpiresAt: "subscriptionExpiresAt",
      analysesUsedThisMonth: "analysesUsedThisMonth",
    },
  };
});

import subscriptionRouter from "./subscription";

function seed(overrides: Partial<FakeUser> = {}): FakeUser {
  const user: FakeUser = {
    id: 1,
    subscriptionStatus: "free",
    subscriptionPlanId: null,
    subscriptionExpiresAt: null,
    hasUnlimitedAnalyses: true,
    analysesUsedThisMonth: 0,
    ...overrides,
  };
  users.set(user.id, user);
  return user;
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(subscriptionRouter);
  return app;
}

describe("subscription entitlement routes", () => {
  beforeEach(() => users.clear());

  it("GET /subscription/me reports -1 analysesLimit for the unlimited entitlement", async () => {
    seed();

    const response = await request(makeApp()).get("/subscription/me");

    expect(response.status).toBe(200);
    expect(response.body.analysesLimit).toBe(-1);
  });

  it("POST /subscription/subscribe preserves the unlimited entitlement", async () => {
    seed();

    const response = await request(makeApp()).post("/subscription/subscribe").send({ planId: "basic" });

    expect(response.status).toBe(200);
    expect(response.body.analysesLimit).toBe(-1);
    expect(users.get(1)!.hasUnlimitedAnalyses).toBe(true);
  });

  it("POST /subscription/cancel preserves the unlimited entitlement", async () => {
    seed({ subscriptionStatus: "premium", subscriptionPlanId: "premium", subscriptionExpiresAt: new Date() });

    const response = await request(makeApp()).post("/subscription/cancel");

    expect(response.status).toBe(200);
    expect(users.get(1)).toMatchObject({
      subscriptionStatus: "free",
      subscriptionPlanId: null,
      hasUnlimitedAnalyses: true,
    });
  });
});