import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, usersTable, organizationsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { isAdminEmail } from "../lib/admin-emails";

declare module "express-session" {
  interface SessionData {
    userId: number;
    isAdmin?: boolean;
  }
}

const router: IRouter = Router();

// 공개: 활성 기관 목록 조회 (회원가입 드롭다운용)
router.get("/auth/organizations", async (_req, res): Promise<void> => {
  const orgs = await db
    .select({ id: organizationsTable.id, name: organizationsTable.name, plan: organizationsTable.plan })
    .from(organizationsTable)
    .where(eq(organizationsTable.status, "active"))
    .orderBy(organizationsTable.name);
  res.json(orgs);
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, name, organizationId } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: "이메일, 비밀번호, 이름을 모두 입력해주세요." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "비밀번호는 6자 이상이어야 합니다." });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "이미 사용 중인 이메일입니다." });
    return;
  }

  // 소속기관이 선택된 경우 기관의 플랜을 사용자 등급으로 적용
  let subscriptionStatus = "free";
  let resolvedOrgId: number | null = null;
  if (organizationId) {
    const orgIdNum = parseInt(organizationId, 10);
    if (!isNaN(orgIdNum)) {
      const [org] = await db
        .select({ id: organizationsTable.id, plan: organizationsTable.plan, status: organizationsTable.status })
        .from(organizationsTable)
        .where(eq(organizationsTable.id, orgIdNum));
      if (org && org.status === "active") {
        subscriptionStatus = org.plan;
        resolvedOrgId = org.id;
      }
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash, name, subscriptionStatus, organizationId: resolvedOrgId })
    .returning();

  req.session.userId = user.id;
  res.status(201).json({
    id: user.id,
    email: user.email,
    name: user.name,
    subscriptionStatus: user.subscriptionStatus,
    organizationId: user.organizationId,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "이메일과 비밀번호를 입력해주세요." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." });
    return;
  }

  req.session.userId = user.id;
  // ADMIN_EMAILS에 등록된 계정이면 관리자 페이지 권한도 켠다
  if (isAdminEmail(user.email)) req.session.isAdmin = true;
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    subscriptionStatus: user.subscriptionStatus,
    createdAt: user.createdAt.toISOString(),
    isAdmin: req.session.isAdmin === true,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy((err) => {
    if (err) {
      logger.error({ err }, "Session destroy error");
    }
  });
  res.json({ message: "로그아웃 되었습니다." });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    res.status(401).json({ error: "사용자를 찾을 수 없습니다." });
    return;
  }
  // 이미 로그인된 세션도 다시 로그인하지 않고 관리자 권한을 받도록 여기서도 확인한다
  if (isAdminEmail(user.email)) req.session.isAdmin = true;
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    subscriptionStatus: user.subscriptionStatus,
    createdAt: user.createdAt.toISOString(),
    isAdmin: req.session.isAdmin === true,
  });
});

export default router;
