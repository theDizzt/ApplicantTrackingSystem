import { Router, type IRouter } from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db, companiesTable, resumesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { openai } from "../lib/openai";
import { logger } from "../lib/logger";
import { scrapeJobkorea, scrapeSaramin, buildKeyword, type ScrapedPosting } from "../lib/job-scrapers";

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
    careerLevel: c.careerLevel ?? null,
    educationLevel: c.educationLevel ?? null,
    recruitmentField: c.recruitmentField ?? null,
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
  const { name, siteUrl, jobPostingUrl, talentProfile, jobDescription, notes,
          careerLevel, educationLevel, recruitmentField } = req.body;
  if (!name) {
    res.status(400).json({ error: "회사명을 입력해주세요." });
    return;
  }
  const [company] = await db
    .insert(companiesTable)
    .values({ userId: req.session.userId!, name, siteUrl, jobPostingUrl, talentProfile, jobDescription, notes,
              careerLevel: careerLevel ?? null, educationLevel: educationLevel ?? null, recruitmentField: recruitmentField ?? null })
    .returning();
  res.status(201).json(serializeCompany(company));
});

// ─── 필터 기반 채용공고 가져오기 (잡코리아 + 사람인 + AI 보강) ───────────────
router.post("/companies/fetch-postings", requireAuth, async (req, res): Promise<void> => {
  const { careerLevel, educationLevel, recruitmentField } = req.body as {
    careerLevel?: string[];
    educationLevel?: string;
    recruitmentField?: string[];
  };

  if (
    (!careerLevel || careerLevel.length === 0) &&
    !educationLevel &&
    (!recruitmentField || recruitmentField.length === 0)
  ) {
    res.status(400).json({ error: "필터 조건을 하나 이상 선택해주세요." });
    return;
  }

  const conditions: string[] = [];
  if (careerLevel?.length)      conditions.push(`경력구분: ${careerLevel.join(", ")}`);
  if (educationLevel)           conditions.push(`최소 학력: ${educationLevel} 이상`);
  if (recruitmentField?.length) conditions.push(`모집분야: ${recruitmentField.join(", ")}`);

  try {
    // ── 1단계: 잡코리아 · 사람인 병렬 스크래핑 ──────────────────────────────
    const keyword = buildKeyword({ careerLevel, recruitmentField });
    logger.info({ keyword, conditions }, "채용공고 스크래핑 시작");

    const [jobkoreaResults, saraminResults] = await Promise.all([
      scrapeJobkorea(keyword, 5),
      scrapeSaramin(keyword, 5),
    ]);

    const scraped: ScrapedPosting[] = [...jobkoreaResults, ...saraminResults];
    logger.info(
      { jobkorea: jobkoreaResults.length, saramin: saraminResults.length },
      "스크래핑 완료"
    );

    // ── 2단계: AI로 구조화·보강 (스크래핑 성공 여부와 무관하게 항상 실행) ──
    const scrapedSummary = scraped.length > 0
      ? scraped.map(p =>
          `[${p.source === "jobkorea" ? "잡코리아" : "사람인"}] ` +
          `회사: ${p.name} / 공고: ${p.title} / URL: ${p.jobPostingUrl}` +
          (p.location      ? ` / 근무지: ${p.location}` : "") +
          (p.careerText    ? ` / 경력: ${p.careerText}` : "") +
          (p.educationText ? ` / 학력: ${p.educationText}` : "")
        ).join("\n")
      : "스크래핑된 공고 없음 (AI가 조건에 맞는 공고를 직접 생성하세요)";

    const systemPrompt = `당신은 한국 채용 공고 데이터 분석 전문가입니다.
잡코리아와 사람인에서 수집한 채용공고 원본 데이터와 필터 조건을 바탕으로, 조건에 맞는 공고를 정리하고 누락된 정보를 보완하여 정확한 JSON 배열로 반환하세요.

반환 형식 (JSON 배열, 주석 없이):
[
  {
    "name": "회사명",
    "siteUrl": "https://회사공식홈페이지.com",
    "jobPostingUrl": "공고 원본 URL (스크래핑된 URL 그대로 사용)",
    "talentProfile": "인재상 1~2문장",
    "jobDescription": "담당업무 및 자격요건 (200자 내외)",
    "careerLevel": ["신입"],
    "educationLevel": "대학교",
    "recruitmentField": ["개발"]
  }
]

규칙:
- 스크래핑된 공고가 있으면 해당 데이터를 기반으로 작성하고 jobPostingUrl은 원본 URL을 유지
- 스크래핑 데이터가 없으면 조건에 맞는 실제 한국 기업 공고를 6개 생성
- careerLevel 값은 ["신입","1년이내","3년이내"] 중 조건에 맞는 것만 사용
- educationLevel 값은 "전문대","대학교","석사" 중 하나만 사용
- recruitmentField 값은 ["개발","기획","디자인","영업","품질관리","테스터","기타"] 중 맞는 것 사용
- 6개를 초과하지 않도록 반환`;

    const userPrompt =
      `필터 조건:\n${conditions.join("\n")}\n\n수집된 채용공고:\n${scrapedSummary}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2500,
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";

    // JSON 배열만 추출 (마크다운 코드블록 제거)
    const cleaned = raw.replace(/```json?\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn({ raw }, "AI 응답에서 JSON 배열을 찾지 못함");
      res.json([]);
      return;
    }

    const postings = JSON.parse(jsonMatch[0]);
    res.json(postings);

  } catch (err) {
    logger.error({ err }, "fetch-postings 오류");
    res.status(500).json({ error: "채용공고를 가져오는 중 오류가 발생했습니다." });
  }
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

  const { name, siteUrl, jobPostingUrl, talentProfile, jobDescription, notes,
          careerLevel, educationLevel, recruitmentField } = req.body;
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (siteUrl !== undefined) updateData.siteUrl = siteUrl;
  if (jobPostingUrl !== undefined) updateData.jobPostingUrl = jobPostingUrl;
  if (talentProfile !== undefined) updateData.talentProfile = talentProfile;
  if (jobDescription !== undefined) updateData.jobDescription = jobDescription;
  if (notes !== undefined) updateData.notes = notes;
  if (careerLevel !== undefined) updateData.careerLevel = careerLevel;
  if (educationLevel !== undefined) updateData.educationLevel = educationLevel;
  if (recruitmentField !== undefined) updateData.recruitmentField = recruitmentField;

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
