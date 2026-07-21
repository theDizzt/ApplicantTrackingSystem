import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const CLEANUP_TOKEN = "myats-prod-cleanup-jh-2026";

/**
 * 임시 관리자 엔드포인트 — 특정 이메일 계정 데이터 전체 삭제
 * 사용 후 즉시 이 파일과 라우터 등록을 제거할 것
 */
router.delete("/admin-cleanup", async (req, res) => {
  const token = req.headers["x-admin-token"];
  const email = req.body?.email as string | undefined;

  if (token !== CLEANUP_TOKEN) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (!email) {
    return res.status(400).json({ error: "email required" });
  }

  try {
    const users = await db.execute(sql`SELECT id FROM users WHERE email = ${email}`);
    const rows = users.rows as { id: number }[];
    if (rows.length === 0) {
      return res.json({ message: "User not found — nothing deleted" });
    }
    const userId = rows[0].id;

    // FK 순서에 맞게 삭제
    await db.execute(sql`
      DELETE FROM interview_questions
      WHERE session_id IN (
        SELECT id FROM interview_sessions WHERE user_id = ${userId}
      )
    `);
    await db.execute(sql`DELETE FROM interview_sessions WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM analyses WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM resumes WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM companies WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);

    return res.json({ message: `Deleted all data for user ${email} (id=${userId})` });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
