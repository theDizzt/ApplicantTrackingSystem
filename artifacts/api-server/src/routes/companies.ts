import { Router, type IRouter } from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db, companiesTable, resumesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import OpenAI from "openai";

const router: IRouter = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
    isRecommended: c.isRecommended,
    syncedAt: c.syncedAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  };
}

// ─── 목록 조회 ────────────────────────────────────────────────────────────────
router.get("/companies", requireAuth, async (req, res): Promise<void> => {
  const companies = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.userId, req.session.userId!))
    .orderBy(companiesTable.createdAt);
  res.json(companies.map(serializeCompany));
});

// ─── 회사 생성 ────────────────────────────────────────────────────────────────
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

// ─── 이력서 기반 추천 ─────────────────────────────────────────────────────────
router.post("/companies/recommend", requireAuth, async (req, res): Promise<void> => {
  const { resumeId } = req.body;
  if (!resumeId) {
    res.status(400).json({ error: "resumeId가 필요합니다." });
    return;
  }

  const userId = req.session.userId!;

  // 이력서 조회
  const [resume] = await db
    .select()
    .from(resumesTable)
    .where(and(eq(resumesTable.id, Number(resumeId)), eq(resumesTable.userId, userId)));
  if (!resume) {
    res.status(404).json({ error: "이력서를 찾을 수 없습니다." });
    return;
  }

  // 회사 목록 조회
  const companies = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.userId, userId))
    .orderBy(companiesTable.createdAt);

  if (companies.length === 0) {
    res.json([]);
    return;
  }

  const resumeText = [
    resume.content ?? "",
    resume.coverLetter ?? "",
  ].join("\n\n").trim();

  const companyList = companies
    .map((c, i) => `[${i + 1}] ${c.name}\n직무 설명:\n${(c.jobDescription ?? "").slice(0, 600)}\n인재상:\n${(c.talentProfile ?? "").slice(0, 200)}`)
    .join("\n\n---\n\n");

  const systemPrompt = `당신은 경험 많은 채용 컨설턴트입니다. 지원자의 이력서를 분석하여 가장 적합한 회사를 추천합니다.
각 회사의 채용 공고와 이력서를 비교해 매칭도(0~100점)를 산정하세요.
매칭도 65점 이상인 회사들을 추천합니다. 단, 전체 회사 수의 40%를 초과해서 추천하지 마세요.
반드시 JSON 배열만 반환하세요: [{"index": 1, "score": 85, "reason": "..."}, ...]`;

  const userPrompt = `## 지원자 이력서\n${resumeText.slice(0, 2000)}\n\n## 회사 목록\n${companyList}`;

  let recommendedIds: number[] = [];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";
    // JSON 추출
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed: Array<{ index: number; score: number; reason: string }> = JSON.parse(jsonMatch[0]);
      // score >= 65인 항목의 원본 회사 ID 추출
      recommendedIds = parsed
        .filter(p => p.score >= 65)
        .map(p => companies[p.index - 1]?.id)
        .filter((id): id is number => id != null);
    }
  } catch (err) {
    // AI 오류 시 빈 추천 (전체 초기화만)
    recommendedIds = [];
  }

  // 전체 초기화 후 추천 표시
  await db
    .update(companiesTable)
    .set({ isRecommended: false })
    .where(eq(companiesTable.userId, userId));

  if (recommendedIds.length > 0) {
    await db
      .update(companiesTable)
      .set({ isRecommended: true })
      .where(
        and(
          eq(companiesTable.userId, userId),
          inArray(companiesTable.id, recommendedIds)
        )
      );
  }

  // 갱신된 목록 반환 (추천 항목 먼저)
  const updated = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.userId, userId))
    .orderBy(companiesTable.createdAt);

  res.json(updated.map(serializeCompany));
});

// ─── 단건 조회 ────────────────────────────────────────────────────────────────
router.get("/companies/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, id), eq(companiesTable.userId, req.session.userId!)));
  if (!company) { res.status(404).json({ error: "회사를 찾을 수 없습니다." }); return; }
  res.json(serializeCompany(company));
});

// ─── 수정 ─────────────────────────────────────────────────────────────────────
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

// ─── 삭제 ─────────────────────────────────────────────────────────────────────
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
