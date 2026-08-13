import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const PLANS = [
  {
    id: "free",
    name: "무료",
    price: 0,
    analysesPerMonth: 1,
    description: "부담 없이 먼저 경험해보세요",
    features: ["기본 분석 리포트", "개선사항 제시"],
  },
  {
    id: "basic",
    name: "베이직",
    price: 9900,
    analysesPerMonth: 5,
    description: "취업 준비를 막 시작한 분들을 위한 플랜",
    features: ["월 5회 서류 심사", "AI 면접 질문 생성", "이력서 언어 검토", "직무 적합도 분석"],
  },
  {
    id: "premium",
    name: "프리미엄",
    price: 19900,
    analysesPerMonth: 20,
    description: "집중적인 취업 활동을 하는 분들을 위한 플랜",
    features: [
      "월 20회 서류 심사",
      "AI 면접 질문 생성",
      "이력서 언어 검토",
      "직무 적합도 분석",
      "관상 분석",
      "우선 처리",
      "상세 개선 리포트",
    ],
  },
];

const LIMITS: Record<string, number> = { free: 1, basic: 5, premium: 20 };

router.get("/subscription/plans", async (_req, res): Promise<void> => {
  res.json(PLANS);
});

router.get("/subscription/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) {
    res.status(401).json({ error: "사용자를 찾을 수 없습니다." });
    return;
  }
  res.json({
    status: user.subscriptionStatus,
    planId: user.subscriptionPlanId ?? null,
    analysesUsed: user.analysesUsedThisMonth,
    analysesLimit: LIMITS[user.subscriptionStatus] ?? 1,
    expiresAt: user.subscriptionExpiresAt ? user.subscriptionExpiresAt.toISOString() : null,
  });
});

router.post("/subscription/subscribe", requireAuth, async (req, res): Promise<void> => {
  const { planId } = req.body;
  if (!planId || !["basic", "premium"].includes(planId)) {
    res.status(400).json({ error: "유효하지 않은 플랜입니다." });
    return;
  }

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const [user] = await db
    .update(usersTable)
    .set({
      subscriptionStatus: planId,
      subscriptionPlanId: planId,
      subscriptionExpiresAt: expiresAt,
      analysesUsedThisMonth: 0,
    })
    .where(eq(usersTable.id, req.session.userId!))
    .returning();

  res.json({
    status: user.subscriptionStatus,
    planId: user.subscriptionPlanId ?? null,
    analysesUsed: user.analysesUsedThisMonth,
    analysesLimit: LIMITS[user.subscriptionStatus] ?? 1,
    expiresAt: user.subscriptionExpiresAt ? user.subscriptionExpiresAt.toISOString() : null,
  });
});

router.post("/subscription/cancel", requireAuth, async (req, res): Promise<void> => {
  await db
    .update(usersTable)
    .set({ subscriptionStatus: "free", subscriptionPlanId: null, subscriptionExpiresAt: null })
    .where(eq(usersTable.id, req.session.userId!));
  res.json({ message: "구독이 취소되었습니다." });
});

export default router;
