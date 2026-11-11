import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, companiesTable, resumesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getAI } from "../lib/openai";
import { logger } from "../lib/logger";
import { parseScheduleInput } from "../lib/application-schedule";
import { scrapeSaramin, buildKeyword, getJobkoreaSearchUrl } from "../lib/job-scrapers";
import { extractPostingDates, parseSaraminDeadline } from "../lib/posting-dates";

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
    applicationStatus: c.applicationStatus ?? null,
    deadlineDate: c.deadlineDate ?? null,
    announcementDate: c.announcementDate ?? null,
    interviewDate: c.interviewDate ?? null,
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
  const schedule = parseScheduleInput(req.body ?? {});
  if (!schedule.ok) { res.status(400).json({ error: schedule.error }); return; }
  const [company] = await db
    .insert(companiesTable)
    .values({ userId: req.session.userId!, name, siteUrl, jobPostingUrl, talentProfile, jobDescription, notes,
              careerLevel: careerLevel ?? null, educationLevel: educationLevel ?? null, recruitmentField: recruitmentField ?? null,
              ...schedule.value })
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

    // ── 1단계: 사람인 스크래핑 + 잡코리아 검색 URL 생성 (병렬) ──────────────
    const [saraminResults] = await Promise.all([
      scrapeSaramin(keyword, 8),
    ]);
    const jobkoreaSearchUrl = getJobkoreaSearchUrl(keyword);

    logger.info({ saramin: saraminResults.length, jobkoreaUrl: jobkoreaSearchUrl }, "스크래핑 완료");

    // ── 2단계: AI로 구조화·보강 ───────────────────────────────────────────────
    const saraminSummary = saraminResults.length > 0
      ? saraminResults.map(p =>
          `[사람인] 회사: ${p.name} / 공고: ${p.title} / URL: ${p.jobPostingUrl}` +
          (p.location      ? ` / 근무지: ${p.location}` : "") +
          (p.careerText    ? ` / 경력: ${p.careerText}` : "") +
          (p.educationText ? ` / 학력: ${p.educationText}` : "")
        ).join("\n")
      : "사람인 스크래핑 결과 없음";

    const systemPrompt = `당신은 한국 채용 공고 데이터 전문가입니다.
사람인에서 수집한 실제 채용공고와 잡코리아 검색 URL을 바탕으로, 조건에 맞는 공고 6개를 JSON 배열로 반환하세요.

반환 형식 (순수 JSON 배열, 마크다운·주석 없이):
[
  {
    "name": "회사명",
    "siteUrl": "https://회사공식홈페이지.com",
    "jobPostingUrl": "공고 URL",
    "talentProfile": "인재상 1~2문장",
    "jobDescription": "담당업무 및 자격요건 200자 내외",
    "careerLevel": ["신입"],
    "educationLevel": "대학교",
    "recruitmentField": ["개발"]
  }
]

규칙:
1. 사람인 스크래핑 데이터가 있으면 해당 공고를 우선 사용하고, jobPostingUrl은 원본 URL 그대로 유지
2. 사람인 공고 수가 6개 미만이면 잡코리아 검색 URL(${jobkoreaSearchUrl})을 jobPostingUrl로 하여 조건에 맞는 실제 한국 기업 공고를 생성해 채워넣기
3. careerLevel: ["신입","1년이내","3년이내"] 중 조건에 맞는 것만
4. educationLevel: "전문대","대학교","석사" 중 하나
5. recruitmentField: ["개발","기획","디자인","영업","품질관리","테스터","기타"] 중 맞는 것
6. 반환 총 6개 이하`;

    const userPrompt = `필터 조건:\n${conditions.join("\n")}\n\n사람인 수집 공고:\n${saraminSummary}`;

    const ai = await getAI("light");
      const completion = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      max_completion_tokens: 2500,
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
    const ai = await getAI("light");
      const completion = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 800,
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
// ─── 이력서 기반 채용공고 찾기 ───────────────────────────────────────────────
// 이력서 → 맞는 직무 검색어 → 사람인 실제 공고 검색 → 공고별 적합도 평가.
// 공고는 실제로 수집한 것만 돌려준다. (AI가 공고를 지어내지 않는다)
const CAREER_LEVELS = ["신입", "1년이내", "3년이내"] as const;
const EDUCATION_LEVELS = ["전문대", "대학교", "석사"] as const;
const RECRUITMENT_FIELDS = ["개발", "기획", "디자인", "영업", "품질관리", "테스터", "기타"] as const;
const DISCOVER_MAX_KEYWORDS = 3;
const DISCOVER_PER_KEYWORD = 8;
const DISCOVER_MAX_POSTINGS = 15;

function htmlToPlain(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```json?\s*/gi, "").replace(/```\s*/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]) as Record<string, unknown>; } catch { return null; }
}

function pickAllowed<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return [...new Set(list.filter((v): v is T => typeof v === "string" && (allowed as readonly string[]).includes(v)))];
}

router.post("/companies/discover", requireAuth, async (req, res): Promise<void> => {
  const resumeId = Number((req.body as { resumeId?: unknown })?.resumeId);
  if (!Number.isInteger(resumeId) || resumeId <= 0) {
    res.status(400).json({ error: "이력서를 선택해주세요." });
    return;
  }
  const userId = req.session.userId!;
  const [resume] = await db.select().from(resumesTable)
    .where(and(eq(resumesTable.id, resumeId), eq(resumesTable.userId, userId)));
  if (!resume) { res.status(404).json({ error: "이력서를 찾을 수 없습니다." }); return; }

  const resumeText = htmlToPlain([resume.title, resume.content ?? "", resume.coverLetter ?? ""].join("\n\n"));
  if (resumeText.replace(/\s/g, "").length < 50) {
    res.status(400).json({ error: "이력서 내용이 너무 짧습니다. 내용을 채운 뒤 다시 시도해주세요." });
    return;
  }

  try {
    const ai = await getAI("light");

    // ── 1단계: 검색어 정하기 ─────────────────────────────────────────────
    // 커리어 분석 결과가 있으면 추천 직업을 참고하고, 검색어 자체는 AI가 사람인 검색에 맞게 짧게 만든다.
    let recommendedJobs: string[] = [];
    if (resume.careerAnalysisResult) {
      try {
        const parsed = JSON.parse(resume.careerAnalysisResult) as { recommendedJobs?: Array<{ job?: unknown }> };
        recommendedJobs = (parsed.recommendedJobs ?? [])
          .map((j) => (typeof j.job === "string" ? j.job.trim() : ""))
          .filter(Boolean);
      } catch { /* 분석 결과가 깨져 있으면 무시 */ }
    }

    const keywordCompletion = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: "system",
          content: `당신은 한국 채용 시장 전문가입니다. 지원자의 이력서를 읽고 사람인에서 검색할 직무 검색어를 정하세요.
JSON 객체만 반환하세요:
{"jobs": ["이력서에 맞는 직무명", ...], "keywords": ["사람인 검색어", ...], "careerLevel": "신입" | "경력"}
규칙:
- jobs: 지원자에게 맞는 직무 1~3개 (예: "임베디드 소프트웨어 개발자")
- keywords: 사람인 검색창에 넣을 2~4단어 검색어 1~${DISCOVER_MAX_KEYWORDS}개. 직무 핵심어 + 주요 기술 위주 (예: "임베디드 C 펌웨어")
- careerLevel: 회사 근무 경력이 1년 이상이면 "경력", 아니면 "신입"`,
        },
        {
          role: "user",
          content: `${recommendedJobs.length ? `커리어 분석의 추천 직업: ${recommendedJobs.join(", ")}\n\n` : ""}이력서:\n${resumeText.slice(0, 3000)}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4000,
    });
    const keywordData = parseJsonObject(keywordCompletion.choices[0]?.message?.content ?? "") ?? {};
    const jobs = (Array.isArray(keywordData.jobs) ? keywordData.jobs : [])
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .map((v) => v.trim()).slice(0, 3);
    const careerWord = keywordData.careerLevel === "경력" ? "경력" : "신입";
    let keywords = (Array.isArray(keywordData.keywords) ? keywordData.keywords : [])
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .map((v) => v.trim().slice(0, 40));
    if (keywords.length === 0) keywords = [...jobs, ...recommendedJobs];
    keywords = [...new Set(keywords)].slice(0, DISCOVER_MAX_KEYWORDS);
    if (keywords.length === 0) {
      res.status(422).json({ error: "이력서에서 직무를 찾지 못했습니다. 경력·기술 내용을 보강해주세요." });
      return;
    }

    // ── 2단계: 사람인 실제 공고 검색 (사이트 부담을 줄이려고 순서대로) ────────
    const seen = new Set<string>();
    const scraped: Awaited<ReturnType<typeof scrapeSaramin>> = [];
    for (const keyword of keywords) {
      const found = await scrapeSaramin(`${keyword} ${careerWord}`, DISCOVER_PER_KEYWORD);
      for (const p of found) {
        if (seen.has(p.jobPostingUrl)) continue;
        seen.add(p.jobPostingUrl);
        scraped.push(p);
      }
      if (scraped.length >= DISCOVER_MAX_POSTINGS) break;
    }
    const candidates = scraped.slice(0, DISCOVER_MAX_POSTINGS);
    logger.info({ resumeId, keywords, found: candidates.length }, "이력서 기반 공고 검색 완료");
    if (candidates.length === 0) {
      res.json({ jobs, keywords, postings: [] });
      return;
    }

    // ── 3단계: 공고별 적합도 평가 ─────────────────────────────────────────
    const postingList = candidates.map((p, i) =>
      `[${i + 1}] 회사: ${p.name} / 공고: ${p.title}` +
      (p.location ? ` / 근무지: ${p.location}` : "") +
      (p.careerText ? ` / 경력: ${p.careerText}` : "") +
      (p.educationText ? ` / 학력: ${p.educationText}` : ""),
    ).join("\n");

    const scoreCompletion = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: "system",
          content: `당신은 경험 많은 채용 컨설턴트입니다. 지원자의 이력서와 실제 채용공고 목록(제목·조건)을 비교해 공고마다 지원 적합도를 평가하세요.
JSON 객체만 반환하세요:
{"results": [{"index": 공고 번호, "score": 0-100, "reason": "적합 이유 또는 부족한 점 (한국어 1~2문장, 이력서 근거 포함)", "careerLevel": [...], "educationLevel": "...", "recruitmentField": [...]}]}
규칙:
- 목록의 모든 공고를 평가하세요. 공고를 새로 만들거나 회사명을 바꾸지 마세요.
- 공고 제목과 조건만으로 판단하고, 확인할 수 없는 내용은 추측하지 마세요.
- careerLevel: ${JSON.stringify(CAREER_LEVELS)} 중 공고 조건에 맞는 것 (경력 3년 초과만 받으면 빈 배열)
- educationLevel: ${JSON.stringify(EDUCATION_LEVELS)} 중 하나, 학력무관이면 빈 문자열
- recruitmentField: ${JSON.stringify(RECRUITMENT_FIELDS)} 중 맞는 것`,
        },
        { role: "user", content: `## 지원자 이력서\n${resumeText.slice(0, 3000)}\n\n## 채용공고 목록\n${postingList}` },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 6000,
    });
    const scoreData = parseJsonObject(scoreCompletion.choices[0]?.message?.content ?? "") ?? {};
    const evaluations = new Map<number, Record<string, unknown>>();
    for (const item of Array.isArray(scoreData.results) ? scoreData.results : []) {
      const o = (item ?? {}) as Record<string, unknown>;
      const index = Number(o.index);
      if (Number.isInteger(index) && index >= 1 && index <= candidates.length) evaluations.set(index, o);
    }

    const postings = candidates.map((p, i) => {
      const ev = evaluations.get(i + 1) ?? {};
      const rawScore = Number(ev.score);
      const education = pickAllowed(ev.educationLevel, EDUCATION_LEVELS)[0];
      const conditions = [p.location && `근무지: ${p.location}`, p.careerText && `경력: ${p.careerText}`, p.educationText && `학력: ${p.educationText}`]
        .filter(Boolean).join(" · ");
      return {
        name: p.name,
        siteUrl: null,
        jobPostingUrl: p.jobPostingUrl,
        talentProfile: null,
        jobDescription: [p.title, conditions].filter(Boolean).join("\n"),
        careerLevel: pickAllowed(ev.careerLevel, CAREER_LEVELS),
        educationLevel: education ?? null,
        recruitmentField: pickAllowed(ev.recruitmentField, RECRUITMENT_FIELDS),
        deadlineDate: parseSaraminDeadline(p.deadlineText),
        deadlineText: p.deadlineText || null,
        matchScore: Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : null,
        matchReason: typeof ev.reason === "string" ? ev.reason.trim() : null,
      };
    }).sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));

    res.json({ jobs, keywords, postings });
  } catch (err) {
    logger.error({ err, resumeId }, "discover 오류");
    res.status(500).json({ error: "이력서에 맞는 채용공고를 찾는 중 오류가 발생했습니다." });
  }
});

// ─── 공고 본문에서 지원 일정 추출 ────────────────────────────────────────────
router.post("/companies/extract-dates", requireAuth, async (req, res): Promise<void> => {
  const text = (req.body as { text?: unknown })?.text;
  if (typeof text !== "string" || text.trim().length < 20) {
    res.status(400).json({ error: "일정을 찾을 채용공고 내용이 없습니다. 공고 내용을 먼저 채워주세요." });
    return;
  }
  try {
    const dates = await extractPostingDates(text);
    res.json({ dates });
  } catch (err) {
    logger.error({ err }, "extract-dates 오류");
    res.status(500).json({ error: "공고에서 일정을 읽는 중 오류가 발생했습니다." });
  }
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
  const schedule = parseScheduleInput(req.body ?? {});
  if (!schedule.ok) { res.status(400).json({ error: schedule.error }); return; }
  Object.assign(updateData, schedule.value);
  if (Object.keys(updateData).length === 0) { res.status(400).json({ error: "수정할 항목이 없습니다." }); return; }

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
