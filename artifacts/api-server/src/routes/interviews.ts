import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, interviewSessionsTable, interviewQuestionsTable, resumesTable, companiesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getAI } from "../lib/openai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function getSessionWithQuestions(sessionId: number, userId: number) {
  const [session] = await db.select().from(interviewSessionsTable)
    .where(and(eq(interviewSessionsTable.id, sessionId), eq(interviewSessionsTable.userId, userId)));
  if (!session) return null;

  const questions = await db.select().from(interviewQuestionsTable)
    .where(eq(interviewQuestionsTable.sessionId, sessionId))
    .orderBy(interviewQuestionsTable.order);

  return {
    id:        session.id,
    userId:    session.userId,
    resumeId:  session.resumeId,
    companyId: session.companyId,
    status:    session.status,
    createdAt: session.createdAt.toISOString(),
    questions: questions.map(q => ({
      id:       q.id,
      question: q.question,
      order:    q.order,
      answer:   q.answer ?? null,
      feedback: q.feedback ?? null,
    })),
  };
}

router.get("/interviews", requireAuth, async (req, res): Promise<void> => {
  const sessions = await db.select().from(interviewSessionsTable)
    .where(eq(interviewSessionsTable.userId, req.session.userId!))
    .orderBy(interviewSessionsTable.createdAt);

  const results = await Promise.all(
    sessions.map(async (s) => {
      const questions = await db.select().from(interviewQuestionsTable)
        .where(eq(interviewQuestionsTable.sessionId, s.id))
        .orderBy(interviewQuestionsTable.order);
      return {
        id:        s.id,
        userId:    s.userId,
        resumeId:  s.resumeId,
        companyId: s.companyId,
        status:    s.status,
        createdAt: s.createdAt.toISOString(),
        questions: questions.map(q => ({
          id: q.id, question: q.question, order: q.order,
          answer: q.answer ?? null, feedback: q.feedback ?? null,
        })),
      };
    })
  );
  res.json(results);
});

/** 이력서 텍스트에서 최종학력 졸업연도를 추출 (4자리 연도 패턴) */
function detectGraduationYear(resumeText: string): number | null {
  // "졸업", "수료", "졸" 근처의 연도를 찾음
  const matches = [
    ...resumeText.matchAll(/(\d{4})[^\d]{0,10}(?:졸업|수료|졸|학교\s*졸)/g),
    ...resumeText.matchAll(/(?:졸업|수료|졸)[^\d]{0,10}(\d{4})/g),
    ...resumeText.matchAll(/(\d{4})\s*\.\s*(?:02|08|2|8)\s*졸업/g),
  ];
  const years = [...matches]
    .map(m => parseInt(m[1], 10))
    .filter(y => y >= 1990 && y <= new Date().getFullYear());
  if (years.length === 0) return null;
  return Math.max(...years); // 가장 최근 졸업연도
}

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

  // 졸업연도 공백 분석
  const fullText = [resume.content ?? "", resume.coverLetter ?? ""].join("\n");
  const gradYear = detectGraduationYear(fullText);
  const currentYear = new Date().getFullYear();
  const hasLongGap = gradYear !== null && (currentYear - gradYear) >= 3;

  // 면접 질문 생성
  const resumeText  = [resume.content, resume.coverLetter].filter(Boolean).join("\n\n");
  const companyInfo = [
    company.name,
    company.talentProfile  ? `인재상: ${company.talentProfile}`  : "",
    company.jobDescription ? `채용공고: ${company.jobDescription}` : "",
  ].filter(Boolean).join("\n");

  // 졸업 공백 조건 주입
  const gapInstruction = hasLongGap
    ? `\n\n⚠️ 중요: 지원자의 최종학력 졸업연도가 ${gradYear}년으로, 현재(${currentYear}년) 기준 ${currentYear - gradYear!}년이 경과했습니다.
면접 질문에 반드시 다음 유형의 질문을 1~2개 포함하세요:
- 졸업 후 ${currentYear - gradYear!}년간의 경험/공백 기간에 대한 질문
- 해당 기간 동안 역량 유지/향상을 위해 노력한 내용에 대한 질문`
    : "";

  try {
    const ai = await getAI();
      const response = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: "system",
          content: `당신은 채용 면접관입니다. 구직자의 이력서와 지원 회사 정보를 바탕으로 면접 질문 5개를 생성하세요.${gapInstruction}
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
      await db.update(interviewSessionsTable)
        .set({ status: "questions_generated" })
        .where(eq(interviewSessionsTable.id, session.id));
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
  const sessionId = parseInt(rawId, 10);
  if (isNaN(sessionId)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const { questionId, answer } = req.body;
  if (!questionId || !answer) {
    res.status(400).json({ error: "질문 ID와 답변을 입력해주세요." });
    return;
  }

  const [question] = await db.select().from(interviewQuestionsTable)
    .where(and(eq(interviewQuestionsTable.id, questionId), eq(interviewQuestionsTable.sessionId, sessionId)));
  if (!question) { res.status(404).json({ error: "질문을 찾을 수 없습니다." }); return; }

  await db.update(interviewQuestionsTable)
    .set({ answer })
    .where(eq(interviewQuestionsTable.id, questionId));

  // AI 피드백 생성
  try {
    const ai = await getAI();
      const feedbackResponse = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: "system",
          content: `당신은 채용 면접관입니다. 지원자의 면접 답변을 평가하고 개선 방향을 제시하세요.
JSON 형식으로 반환: { "feedback": "피드백 내용 (한국어, 2~4문장)" }`,
        },
        {
          role: "user",
          content: `면접 질문: ${question.question}\n지원자 답변: ${answer}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const feedbackRaw = feedbackResponse.choices[0]?.message?.content ?? "{}";
    const feedbackParsed = JSON.parse(feedbackRaw) as { feedback?: string };
    if (feedbackParsed.feedback) {
      await db.update(interviewQuestionsTable)
        .set({ feedback: feedbackParsed.feedback })
        .where(eq(interviewQuestionsTable.id, questionId));
    }
  } catch (err) {
    logger.error({ err }, "Failed to generate feedback");
  }

  const result = await getSessionWithQuestions(sessionId, req.session.userId!);
  res.json(result);
});

export default router;
