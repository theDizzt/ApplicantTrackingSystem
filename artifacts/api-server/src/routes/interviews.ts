import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, interviewSessionsTable, interviewQuestionsTable, resumesTable, companiesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { openai } from "../lib/openai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function getSessionWithQuestions(sessionId: number, userId: number) {
  const [session] = await db.select().from(interviewSessionsTable)
    .where(and(eq(interviewSessionsTable.id, sessionId), eq(interviewSessionsTable.userId, userId)));
  if (!session) return null;

  const questions = await db.select().from(interviewQuestionsTable)
    .where(eq(interviewQuestionsTable.sessionId, sessionId))
    .orderBy(interviewQuestionsTable.order);

  const [resume] = await db.select({ title: resumesTable.title }).from(resumesTable).where(eq(resumesTable.id, session.resumeId));
  const [company] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, session.companyId));

  return {
    id: session.id,
    userId: session.userId,
    resumeId: session.resumeId,
    companyId: session.companyId,
    status: session.status,
    questions: questions.map(q => ({
      id: q.id,
      question: q.question,
      order: q.order,
      answer: q.answer ?? null,
      feedback: q.feedback ?? null,
      score: q.score ?? null,
    })),
    overallScore: session.overallScore ?? null,
    overallFeedback: session.overallFeedback ?? null,
    resumeTitle: resume?.title ?? null,
    companyName: company?.name ?? null,
    createdAt: session.createdAt.toISOString(),
    evaluatedAt: session.evaluatedAt ? session.evaluatedAt.toISOString() : null,
  };
}

router.get("/interviews", requireAuth, async (req, res): Promise<void> => {
  const sessions = await db.select().from(interviewSessionsTable)
    .where(eq(interviewSessionsTable.userId, req.session.userId!))
    .orderBy(interviewSessionsTable.createdAt);

  const resumeIds = [...new Set(sessions.map(s => s.resumeId))];
  const companyIds = [...new Set(sessions.map(s => s.companyId))];

  const resumes = resumeIds.length > 0
    ? await db.select({ id: resumesTable.id, title: resumesTable.title }).from(resumesTable).where(eq(resumesTable.userId, req.session.userId!))
    : [];
  const companies = companyIds.length > 0
    ? await db.select({ id: companiesTable.id, name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.userId, req.session.userId!))
    : [];

  const resumeMap = Object.fromEntries(resumes.map(r => [r.id, r.title]));
  const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));

  const result = await Promise.all(sessions.map(async s => {
    const questions = await db.select().from(interviewQuestionsTable)
      .where(eq(interviewQuestionsTable.sessionId, s.id))
      .orderBy(interviewQuestionsTable.order);
    return {
      id: s.id,
      userId: s.userId,
      resumeId: s.resumeId,
      companyId: s.companyId,
      status: s.status,
      questions: questions.map(q => ({
        id: q.id, question: q.question, order: q.order,
        answer: q.answer ?? null, feedback: q.feedback ?? null, score: q.score ?? null,
      })),
      overallScore: s.overallScore ?? null,
      overallFeedback: s.overallFeedback ?? null,
      resumeTitle: resumeMap[s.resumeId] ?? null,
      companyName: companyMap[s.companyId] ?? null,
      createdAt: s.createdAt.toISOString(),
      evaluatedAt: s.evaluatedAt ? s.evaluatedAt.toISOString() : null,
    };
  }));

  res.json(result);
});

router.post("/interviews", requireAuth, async (req, res): Promise<void> => {
  const { resumeId, companyId } = req.body;
  if (!resumeId || !companyId) {
    res.status(400).json({ error: "이력서와 회사를 선택해주세요." });
    return;
  }

  const [resume] = await db.select().from(resumesTable)
    .where(and(eq(resumesTable.id, resumeId), eq(resumesTable.userId, req.session.userId!)));
  if (!resume) { res.status(400).json({ error: "이력서를 찾을 수 없습니다." }); return; }

  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, companyId), eq(companiesTable.userId, req.session.userId!)));
  if (!company) { res.status(400).json({ error: "회사를 찾을 수 없습니다." }); return; }

  const [session] = await db.insert(interviewSessionsTable)
    .values({ userId: req.session.userId!, resumeId, companyId, status: "pending" })
    .returning();

  // Generate questions
  const resumeText = [resume.content, resume.coverLetter].filter(Boolean).join("\n\n");
  const companyInfo = [
    company.name,
    company.talentProfile ? `인재상: ${company.talentProfile}` : "",
    company.jobDescription ? `채용공고: ${company.jobDescription}` : "",
  ].filter(Boolean).join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      messages: [
        {
          role: "system",
          content: `당신은 채용 면접관입니다. 구직자의 이력서와 지원 회사 정보를 바탕으로 면접 질문 5개를 생성하세요.
JSON 형식으로 반환: { "questions": ["질문1", "질문2", "질문3", "질문4", "질문5"] }
질문은 구체적이고 이력서 내용을 기반으로 해야 합니다. 마크다운 없이 JSON만 반환하세요.`,
        },
        {
          role: "user",
          content: `이력서:\n${resumeText || "(내용 없음)"}\n\n지원 회사:\n${companyInfo}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { questions?: string[] };
    const questions: string[] = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 5) : [];

    if (questions.length > 0) {
      await db.insert(interviewQuestionsTable).values(
        questions.map((q, i) => ({ sessionId: session.id, question: q, order: i + 1 }))
      );
      await db.update(interviewSessionsTable).set({ status: "questions_generated" }).where(eq(interviewSessionsTable.id, session.id));
    }
  } catch (err) {
    logger.error({ err, sessionId: session.id }, "Failed to generate interview questions");
  }

  const result = await getSessionWithQuestions(session.id, req.session.userId!);
  res.status(201).json(result);
});

router.get("/interviews/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const result = await getSessionWithQuestions(id, req.session.userId!);
  if (!result) { res.status(404).json({ error: "면접 세션을 찾을 수 없습니다." }); return; }
  res.json(result);
});

router.post("/interviews/:id/answers", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const { answers } = req.body as { answers: { questionId: number; answer: string }[] };
  if (!Array.isArray(answers)) { res.status(400).json({ error: "답변 형식이 올바르지 않습니다." }); return; }

  for (const { questionId, answer } of answers) {
    await db.update(interviewQuestionsTable).set({ answer })
      .where(eq(interviewQuestionsTable.id, questionId));
  }

  await db.update(interviewSessionsTable).set({ status: "answers_submitted" })
    .where(and(eq(interviewSessionsTable.id, id), eq(interviewSessionsTable.userId, req.session.userId!)));

  const result = await getSessionWithQuestions(id, req.session.userId!);
  res.json(result);
});

router.post("/interviews/:id/evaluate", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const session = await getSessionWithQuestions(id, req.session.userId!);
  if (!session) { res.status(404).json({ error: "면접 세션을 찾을 수 없습니다." }); return; }

  const questionsWithAnswers = session.questions.filter(q => q.answer);
  if (questionsWithAnswers.length === 0) { res.status(400).json({ error: "제출된 답변이 없습니다." }); return; }

  const qaText = questionsWithAnswers.map((q, i) =>
    `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.answer}`
  ).join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    messages: [
      {
        role: "system",
        content: `면접 답변을 평가하세요. JSON으로 반환:
{
  "evaluations": [{"questionId": number, "score": 0-100, "feedback": "피드백(한국어)"}],
  "overallScore": 0-100,
  "overallFeedback": "종합 피드백(한국어, 2-3문장)"
}
마크다운 없이 JSON만 반환.`,
      },
      {
        role: "user",
        content: `회사: ${session.companyName ?? ""}\n\n면접 Q&A:\n${qaText}\n\n각 질문 ID: ${questionsWithAnswers.map(q => q.id).join(", ")}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: {
    evaluations?: { questionId: number; score: number; feedback: string }[];
    overallScore?: number;
    overallFeedback?: string;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    res.status(500).json({ error: "평가 처리 중 오류가 발생했습니다." });
    return;
  }

  if (Array.isArray(parsed.evaluations)) {
    for (const ev of parsed.evaluations) {
      await db.update(interviewQuestionsTable).set({ score: ev.score, feedback: ev.feedback })
        .where(eq(interviewQuestionsTable.id, ev.questionId));
    }
  }

  await db.update(interviewSessionsTable).set({
    status: "evaluated",
    overallScore: parsed.overallScore ?? null,
    overallFeedback: parsed.overallFeedback ?? null,
    evaluatedAt: new Date(),
  }).where(eq(interviewSessionsTable.id, id));

  const result = await getSessionWithQuestions(id, req.session.userId!);
  res.json(result);
});

export default router;
