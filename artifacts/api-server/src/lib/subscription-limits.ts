import { eq, and, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

/**
 * 플랜별 월간 심사 한도. subscriptionStatus(free/basic/premium) 기준.
 * 알 수 없는 상태나 -1 등의 값은 free(1)로 처리한다.
 */
export const LIMITS: Record<string, number> = { free: 1, basic: 5, premium: 20 };

function limitFor(status: string): number {
  const limit = LIMITS[status];
  return typeof limit === "number" && limit >= 0 ? limit : LIMITS.free;
}

type UserRow = typeof usersTable.$inferSelect;

/** 서버에 영속된 무제한 이용 권한 여부. */
export function hasUnlimitedAnalyses(user: UserRow): boolean {
  return user.hasUnlimitedAnalyses;
}

/** KST(UTC+9) 기준 "YYYY-M" 형태의 달력 월 키를 만든다. */
function kstMonthKey(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${kst.getUTCMonth()}`;
}

/**
 * 구독 상태를 동기화한다(소비 없음).
 * - basic/premium인데 만료일이 지났으면 free로 다운그레이드하고 영속화한다.
 * - 월간 사용량 리셋: usageResetAt이 null이거나 KST 기준 이전 달이면
 *   analysesUsedThisMonth=0, usageResetAt=now 로 초기화하고 영속화한다.
 * 반환값은 동기화가 반영된(메모리상) 사용자 행이다.
 */
type SubscriptionUpdateExecutor = Pick<typeof db, "update">;

async function syncLockedSubscription(
  user: UserRow,
  now: Date,
  executor: SubscriptionUpdateExecutor,
): Promise<UserRow> {
  let current = user;

  // 1) 만료된 유료 구독 다운그레이드
  const isPaid = current.subscriptionStatus === "basic" || current.subscriptionStatus === "premium";
  if (
    !hasUnlimitedAnalyses(current) &&
    isPaid &&
    current.subscriptionExpiresAt &&
    current.subscriptionExpiresAt.getTime() <= now.getTime()
  ) {
    const [downgraded] = await executor
      .update(usersTable)
      .set({ subscriptionStatus: "free", subscriptionPlanId: null })
      .where(eq(usersTable.id, current.id))
      .returning();
    if (downgraded) current = downgraded;
  }

  // 2) 월간 사용량 리셋 (KST 달력 월 기준)
  const needsReset =
    !current.usageResetAt || kstMonthKey(current.usageResetAt) !== kstMonthKey(now);
  if (needsReset) {
    const [reset] = await executor
      .update(usersTable)
      .set({ analysesUsedThisMonth: 0, usageResetAt: now })
      .where(eq(usersTable.id, current.id))
      .returning();
    if (reset) current = reset;
  }

  return current;
}

export async function syncSubscription(user: UserRow, now: Date = new Date()): Promise<UserRow> {
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .for("update");
    return locked ? syncLockedSubscription(locked, now, tx) : user;
  });
}

/**
 * 심사 한도를 확인하고 원자적으로 1회 소비한다.
 * - 먼저 syncSubscription으로 만료 다운그레이드 + 월간 리셋을 반영한다.
 * - 그런 다음 analyses_used_this_month < limit 조건으로 원자적 증가(UPDATE ... RETURNING).
 * - 한도 초과(증가 실패) 시 402를 반환한다.
 */
export async function consumeAnalysisQuota(
  userId: number,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  return db.transaction(async (tx) => {
    // 월간 리셋과 소비를 같은 행 잠금 트랜잭션에서 처리해 이전 달의 stale reset이
    // 다른 요청의 증가분을 덮어쓰지 못하게 한다.
    const [user] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .for("update");
    if (!user) {
      return { ok: false, status: 401, error: "사용자를 찾을 수 없습니다." };
    }

    const synced = await syncLockedSubscription(user, new Date(), tx);
    // 무제한 권한은 서버가 관리하는 boolean entitlement로만 판단하며 사용량을 소비하지 않는다.
    if (hasUnlimitedAnalyses(synced)) {
      return { ok: true };
    }

    const limit = limitFor(synced.subscriptionStatus);

    // 원자적 소비: 한도 미만일 때만 +1. 반영된 행이 없으면 한도 초과.
    const [consumed] = await tx
      .update(usersTable)
      .set({ analysesUsedThisMonth: sql`${usersTable.analysesUsedThisMonth} + 1` })
      .where(
        and(
          eq(usersTable.id, userId),
          sql`${usersTable.analysesUsedThisMonth} < ${limit}`,
        ),
      )
      .returning();

    if (!consumed) {
      return {
        ok: false,
        status: 402,
        error:
          "이번 달 심사 횟수를 모두 사용했습니다. 플랜을 업그레이드하면 더 많은 심사를 이용할 수 있습니다.",
      };
    }

    return { ok: true };
  });
}
