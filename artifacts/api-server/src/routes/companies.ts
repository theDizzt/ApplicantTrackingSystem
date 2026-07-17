import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, companiesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function serializeCompany(c: typeof companiesTable.$inferSelect) {
  return {
    id: c.id,
    userId: c.userId,
    name: c.name,
    siteUrl: c.siteUrl ?? null,
    jobPostingUrl: c.jobPostingUrl ?? null,
    talentProfile: c.talentProfile ?? null,
    jobDescription: c.jobDescription ?? null,
    notes: c.notes ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/companies", requireAuth, async (req, res): Promise<void> => {
  const companies = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.userId, req.session.userId!))
    .orderBy(companiesTable.createdAt);
  res.json(companies.map(serializeCompany));
});

router.post("/companies", requireAuth, async (req, res): Promise<void> => {
  const { name, siteUrl, jobPostingUrl, talentProfile, jobDescription, notes } = req.body;
  if (!name) {
    res.status(400).json({ error: "회사명을 입력해주세요." });
    return;
  }
  const [company] = await db
    .insert(companiesTable)
    .values({ userId: req.session.userId!, name, siteUrl, jobPostingUrl, talentProfile, jobDescription, notes })
    .returning();
  res.status(201).json(serializeCompany(company));
});

router.get("/companies/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, id), eq(companiesTable.userId, req.session.userId!)));
  if (!company) { res.status(404).json({ error: "회사를 찾을 수 없습니다." }); return; }
  res.json(serializeCompany(company));
});

router.patch("/companies/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const { name, siteUrl, jobPostingUrl, talentProfile, jobDescription, notes } = req.body;
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (siteUrl !== undefined) updateData.siteUrl = siteUrl;
  if (jobPostingUrl !== undefined) updateData.jobPostingUrl = jobPostingUrl;
  if (talentProfile !== undefined) updateData.talentProfile = talentProfile;
  if (jobDescription !== undefined) updateData.jobDescription = jobDescription;
  if (notes !== undefined) updateData.notes = notes;

  const [company] = await db.update(companiesTable).set(updateData)
    .where(and(eq(companiesTable.id, id), eq(companiesTable.userId, req.session.userId!)))
    .returning();
  if (!company) { res.status(404).json({ error: "회사를 찾을 수 없습니다." }); return; }
  res.json(serializeCompany(company));
});

router.delete("/companies/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const [deleted] = await db.delete(companiesTable)
    .where(and(eq(companiesTable.id, id), eq(companiesTable.userId, req.session.userId!)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "회사를 찾을 수 없습니다." }); return; }
  res.sendStatus(204);
});

export default router;
