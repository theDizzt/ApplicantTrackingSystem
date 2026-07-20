import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, resumesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function serializeResume(r: typeof resumesTable.$inferSelect) {
  return {
    id: r.id,
    userId: r.userId,
    title: r.title,
    content: r.content ?? null,
    coverLetter: r.coverLetter ?? null,
    desiredSalary: r.desiredSalary ?? null,
    photoUrl: r.photoUrl ?? null,
    fileUrl: r.fileUrl ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/resumes", requireAuth, async (req, res): Promise<void> => {
  const resumes = await db.select().from(resumesTable)
    .where(eq(resumesTable.userId, req.session.userId!))
    .orderBy(resumesTable.createdAt);
  res.json(resumes.map(serializeResume));
});

router.post("/resumes", requireAuth, async (req, res): Promise<void> => {
  const { title, content, coverLetter, desiredSalary, photoUrl, fileUrl } = req.body;
  if (!title) { res.status(400).json({ error: "이력서 제목을 입력해주세요." }); return; }

  const [resume] = await db.insert(resumesTable)
    .values({
      userId: req.session.userId!,
      title,
      content: content ?? null,
      coverLetter: coverLetter ?? null,
      desiredSalary: desiredSalary != null ? Number(desiredSalary) : null,
      photoUrl: photoUrl ?? null,
      fileUrl: fileUrl ?? null,
    })
    .returning();
  res.status(201).json(serializeResume(resume));
});

router.get("/resumes/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const [resume] = await db.select().from(resumesTable)
    .where(and(eq(resumesTable.id, id), eq(resumesTable.userId, req.session.userId!)));
  if (!resume) { res.status(404).json({ error: "이력서를 찾을 수 없습니다." }); return; }
  res.json(serializeResume(resume));
});

router.patch("/resumes/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const { title, content, coverLetter, desiredSalary, photoUrl, fileUrl } = req.body;
  const updateData: Record<string, unknown> = {};
  if (title        !== undefined) updateData.title        = title;
  if (content      !== undefined) updateData.content      = content;
  if (coverLetter  !== undefined) updateData.coverLetter  = coverLetter;
  if (desiredSalary !== undefined) updateData.desiredSalary = desiredSalary != null ? Number(desiredSalary) : null;
  if (photoUrl     !== undefined) updateData.photoUrl     = photoUrl;
  if (fileUrl      !== undefined) updateData.fileUrl      = fileUrl;

  const [resume] = await db.update(resumesTable).set(updateData)
    .where(and(eq(resumesTable.id, id), eq(resumesTable.userId, req.session.userId!)))
    .returning();
  if (!resume) { res.status(404).json({ error: "이력서를 찾을 수 없습니다." }); return; }
  res.json(serializeResume(resume));
});

router.delete("/resumes/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const [deleted] = await db.delete(resumesTable)
    .where(and(eq(resumesTable.id, id), eq(resumesTable.userId, req.session.userId!)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "이력서를 찾을 수 없습니다." }); return; }
  res.sendStatus(204);
});

export default router;
