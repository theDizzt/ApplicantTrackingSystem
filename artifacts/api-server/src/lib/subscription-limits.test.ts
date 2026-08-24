/**
 * 단위 테스트: 구독 한도 소비/동기화 로직.
 * @workspace/db를 인메모리 사용자 저장소로 스텁한다.
 * drizzle 쿼리 빌더 체인(select().from().where(), update().set().where().returning())과
 * eq/and/sql 헬퍼를 최소한으로 흉내낸다. 실제 조건 평가 대신, 각 라우트가 사용하는
 * 특정 호출 패턴을 재현하여 소비/리셋/다운그레이드 동작을 검증한다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeUser {
  id: number;
  subscriptionStatus: string;
  subscriptionPlanId: string | null;
  subscriptionExpiresAt: Date | null;
  hasUnlimitedAnalyses: boolean;
  analysesUsedThisMonth: number;
  usageResetAt: Date | null;
}

// 조건을 "설명 객체"로 표현해 update의 where에서 해석한다.
type Cond =
  | { kind: "idEq"; id: number }
  | { kind: "usedLt"; limit: number }
  | { kind: "and"; parts: Cond[] }
  | { kind: "other" };

// vi.mock 팩토리는 파일 최상단으로 호이스트되므로, 공유 상태도 vi.hoisted로 끌어올린다.
const { store, resetTransactionQueue, runTransaction } = vi.hoisted(() => {
  let transactionTail = Promise.resolve();
  return {
    store: new Map<number, FakeUser>(),
    resetTransactionQueue: () => {
      transactionTail = Promise.resolve();
    },
    runTransaction: async <T>(callback: (tx: unknown) => Promise<T>, tx: unknown): Promise<T> => {
      const previous = transactionTail;
      let release!: () => void;
      transactionTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await callback(tx);
      } finally {
        release();
      }
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown): Cond => {
    if (col === "COL_ID") return { kind: "idEq", id: val as number };
    return { kind: "other" };
  },
  and: (...parts: Cond[]): Cond => ({ kind: "and", parts }),
  // sql 태그: `${used} < ${limit}` 패턴을 감지
  sql: (strings: TemplateStringsArray, ...vals: unknown[]): Cond => {
    const joined = strings.join("?");
    if (joined.includes("<")) {
      return { kind: "usedLt", limit: vals[vals.length - 1] as number };
    }
    // used + 1 등 (set 표현식) — 조건이 아님. 마커 반환.
    return { kind: "other" };
  },
}));

vi.mock("@workspace/db", () => {
  const flatten = (c: Cond): Cond[] =>
    c.kind === "and" ? c.parts.flatMap(flatten) : [c];
  const matchWhere = (u: FakeUser, cond: Cond): boolean => {
    for (const p of flatten(cond)) {
      if (p.kind === "idEq" && u.id !== p.id) return false;
      if (p.kind === "usedLt" && !(u.analysesUsedThisMonth < p.limit)) return false;
    }
    return true;
  };
  const dbMock = {
    select: () => ({
      from: () => ({
        where: (cond: Cond) => {
          const idPart = flatten(cond).find(
            (p): p is Extract<Cond, { kind: "idEq" }> => p.kind === "idEq",
          );
          const u = idPart ? store.get(idPart.id) : undefined;
          const rows = u ? [{ ...u }] : [];
          return Object.assign(rows, { for: () => rows });
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: (cond: Cond) => {
          const idPart = flatten(cond).find(
            (p): p is Extract<Cond, { kind: "idEq" }> => p.kind === "idEq",
          );
          const u = idPart ? store.get(idPart.id) : undefined;
          const returning = () => {
            if (!u || !matchWhere(u, cond)) return [];
            const applied = { ...u } as unknown as Record<string, unknown>;
            for (const [k, v] of Object.entries(values)) {
              if (k === "analysesUsedThisMonth" && v && typeof v === "object") {
                applied.analysesUsedThisMonth = u.analysesUsedThisMonth + 1;
              } else {
                applied[k] = v;
              }
            }
            store.set(applied.id as number, applied as unknown as FakeUser);
            return [{ ...applied }];
          };
          return { returning };
        },
      }),
    }),
    transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> =>
      runTransaction(callback, dbMock),
  };
  return {
    db: dbMock,
    usersTable: { id: "COL_ID", analysesUsedThisMonth: "COL_USED" },
  };
});

import { consumeAnalysisQuota, syncSubscription } from "./subscription-limits";

function seed(u: Partial<FakeUser> & { id: number }): FakeUser {
  const full: FakeUser = {
    subscriptionStatus: "free",
    subscriptionPlanId: null,
    subscriptionExpiresAt: null,
    hasUnlimitedAnalyses: false,
    analysesUsedThisMonth: 0,
    usageResetAt: new Date(),
    ...u,
  };
  store.set(full.id, full);
  return full;
}

describe("consumeAnalysisQuota", () => {
  beforeEach(() => {
    store.clear();
    resetTransactionQueue();
  });

  it("free 사용자의 2번째 심사는 402로 차단된다", async () => {
    seed({ id: 1, subscriptionStatus: "free", analysesUsedThisMonth: 0 });

    const first = await consumeAnalysisQuota(1);
    expect(first.ok).toBe(true);
    expect(store.get(1)!.analysesUsedThisMonth).toBe(1);

    const second = await consumeAnalysisQuota(1);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe(402);
      expect(second.error).toContain("이번 달 심사 횟수를 모두 사용했습니다");
    }
    // 차단 시 사용량이 증가하지 않아야 함
    expect(store.get(1)!.analysesUsedThisMonth).toBe(1);
  });

  it("premium 사용자는 20회까지 허용된다", async () => {
    seed({ id: 2, subscriptionStatus: "premium", analysesUsedThisMonth: 19,
           subscriptionExpiresAt: new Date(Date.now() + 86_400_000) });
    const r = await consumeAnalysisQuota(2);
    expect(r.ok).toBe(true);
    const blocked = await consumeAnalysisQuota(2);
    expect(blocked.ok).toBe(false);
  });

  it("normal 플랜은 각각의 월간 한도를 원자적으로 적용한다", async () => {
    seed({ id: 20, subscriptionStatus: "basic", analysesUsedThisMonth: 4 });
    seed({ id: 21, subscriptionStatus: "premium", analysesUsedThisMonth: 20 });

    expect((await consumeAnalysisQuota(20)).ok).toBe(true);
    expect(store.get(20)!.analysesUsedThisMonth).toBe(5);
    expect((await consumeAnalysisQuota(20)).ok).toBe(false);
    expect((await consumeAnalysisQuota(21)).ok).toBe(false);
    expect(store.get(21)!.analysesUsedThisMonth).toBe(20);
  });

  it("서버 관리 unlimited entitlement는 기존 사용량과 관계없이 소비하지 않고 허용된다", async () => {
    seed({
      id: 22,
      subscriptionStatus: "free",
      hasUnlimitedAnalyses: true,
      analysesUsedThisMonth: 999,
    });

    expect(await consumeAnalysisQuota(22)).toEqual({ ok: true });
    expect(await consumeAnalysisQuota(22)).toEqual({ ok: true });
    expect(store.get(22)!.analysesUsedThisMonth).toBe(999);
  });

  it("동시 stale 월 리셋 요청 두 건은 각각 소비되어 사용량이 2가 된다", async () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    seed({
      id: 23,
      subscriptionStatus: "premium",
      analysesUsedThisMonth: 18,
      usageResetAt: lastMonth,
    });

    const [first, second] = await Promise.all([consumeAnalysisQuota(23), consumeAnalysisQuota(23)]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(store.get(23)!.analysesUsedThisMonth).toBe(2);
  });

  it("만료된 basic 구독은 free로 다운그레이드된 뒤 한도가 적용된다", async () => {
    seed({
      id: 3,
      subscriptionStatus: "basic",
      subscriptionPlanId: "basic",
      subscriptionExpiresAt: new Date(Date.now() - 86_400_000), // 어제 만료
      analysesUsedThisMonth: 0,
    });

    const r = await consumeAnalysisQuota(3);
    expect(r.ok).toBe(true);

    const after = store.get(3)!;
    expect(after.subscriptionStatus).toBe("free");
    expect(after.subscriptionPlanId).toBeNull();
    // free 한도(1)이므로 다음 소비는 차단
    const blocked = await consumeAnalysisQuota(3);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.status).toBe(402);
  });

  it("존재하지 않는 사용자는 401", async () => {
    const r = await consumeAnalysisQuota(999);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });
});

describe("syncSubscription", () => {
  beforeEach(() => {
    store.clear();
    resetTransactionQueue();
  });

  it("이전 달 usageResetAt이면 사용량을 0으로 리셋한다", async () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 2);
    const u = seed({ id: 10, analysesUsedThisMonth: 5, usageResetAt: lastMonth });
    const synced = await syncSubscription(u as never);
    expect(synced.analysesUsedThisMonth).toBe(0);
    expect(store.get(10)!.analysesUsedThisMonth).toBe(0);
  });

  it("같은 달이면 사용량을 유지한다", async () => {
    const u = seed({ id: 11, analysesUsedThisMonth: 3, usageResetAt: new Date() });
    const synced = await syncSubscription(u as never);
    expect(synced.analysesUsedThisMonth).toBe(3);
  });

  it("영속된 unlimited entitlement는 만료된 유료 상태에서도 보존된다", async () => {
    const u = seed({
      id: 12,
      subscriptionStatus: "premium",
      subscriptionExpiresAt: new Date(Date.now() - 86_400_000),
      hasUnlimitedAnalyses: true,
    });

    const synced = await syncSubscription(u as never);
    expect(synced.subscriptionStatus).toBe("premium");
    expect(synced.hasUnlimitedAnalyses).toBe(true);
    expect(store.get(12)!.hasUnlimitedAnalyses).toBe(true);
  });
});
