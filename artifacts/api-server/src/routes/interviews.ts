import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  CreateInterviewBody,
  CreateInterviewResponse,
  EvaluateAnswersParams,
  EvaluateAnswersResponse,
  GetInterviewParams,
  GetInterviewResponse,
  ListInterviewsResponse,
  SubmitAnswersBody,
  SubmitAnswersParams,
  SubmitAnswersResponse,
} from "@workspace/api-zod";
import { db, interviewSessionsTable, interviewQuestionsTable, resumesTable, companiesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getAI } from "../lib/openai";

const router: IRouter = Router();

function parseId(params: unknown, schema: typeof GetInterviewParams) {
  return schema.safeParse(params);
}

async function getSessionWithQuestions(sessionId: number, userId: number) {
  const [session] = await db.select().from(interviewSessionsTable)
    .where(and(eq(interviewSessionsTable.id, sessionId), eq(interviewSessionsTable.userId, userId)));
  if (!session) return null;

  const [[resume], [company], questions] = await Promise.all([
    db.select({ title: resumesTable.title }).from(resumesTable)
      .where(and(eq(resumesTable.id, session.resumeId), eq(resumesTable.userId, userId))),
    db.select({
      name: companiesTable.name,
      talentProfile: companiesTable.talentProfile,
      jobDescription: companiesTable.jobDescription,
    }).from(companiesTable)
      .where(and(eq(companiesTable.id, session.companyId), eq(companiesTable.userId, userId))),
    db.select().from(interviewQuestionsTable)
      .where(eq(interviewQuestionsTable.sessionId, sessionId))
      .orderBy(interviewQuestionsTable.order),
  ]);

  return {
    id: session.id,
    userId: session.userId,
    resumeId: session.resumeId,
    companyId: session.companyId,
    status: session.status,
    questions: questions.map((q) => ({
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
    evaluatedAt: session.evaluatedAt?.toISOString() ?? null,
  };
}

/** 이력서 텍스트에서 최종학력 졸업연도를 추출 (4자리 연도 패턴) */
function detectGraduationYear(resumeText: string): number | null {
  const matches = [
    ...resumeText.matchAll(/(\d{4})[^\d]{0,10}(?:졸업|수료|졸|학교\s*졸)/g),
    ...resumeText.matchAll(/(?:졸업|수료|졸)[^\d]{0,10}(\d{4})/g),
    ...resumeText.matchAll(/(\d{4})\s*\.\s*(?:02|08|2|8)\s*졸업/g),
  ];
  const years = [...matches]
    .map((m) => parseInt(m[1], 10))
    .filter((year) => year >= 1990 && year <= new Date().getFullYear());
  return years.length > 0 ? Math.max(...years) : null;
}

function companyContext(company: { name: string; talentProfile: string | null; jobDescription: string | null }) {
  return [
    `회사명(정확히 이 회사): ${company.name}`,
    `인재상: ${company.talentProfile || "(등록된 인재상 없음)"}`,
    `채용공고/직무기술서: ${company.jobDescription || "(등록된 직무기술서 없음)"}`,
  ].join("\n");
}

router.get("/interviews", requireAuth, async (req, res): Promise<void> => {
  const sessions = await db.select().from(interviewSessionsTable)
    .where(eq(interviewSessionsTable.userId, req.session.userId!))
    .orderBy(desc(interviewSessionsTable.createdAt));
  const results = await Promise.all(sessions.map((session) => getSessionWithQuestions(session.id, req.session.userId!)));
  res.json(ListInterviewsResponse.parse(results.filter((result) => result !== null)));
});

router.post("/interviews", requireAuth, async (req, res): Promise<void> => {
  const input = CreateInterviewBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  const userId = req.session.userId!;
  const { resumeId, companyId } = input.data;
  const [[resume], [company]] = await Promise.all([
    db.select().from(resumesTable).where(and(eq(resumesTable.id, resumeId), eq(resumesTable.userId, userId))),
    db.select().from(companiesTable).where(and(eq(companiesTable.id, companyId), eq(companiesTable.userId, userId))),
  ]);
  if (!resume) {
    res.status(400).json({ error: "이력서를 찾을 수 없습니다." });
    return;
  }
  if (!company) {
    res.status(400).json({ error: "회사를 찾을 수 없습니다." });
    return;
  }

  const [session] = await db.insert(interviewSessionsTable)
    .values({ userId, resumeId, companyId, status: "pending" })
    .returning();

  const resumeText = [resume.content, resume.coverLetter].filter(Boolean).join("\n\n");
  const gradYear = detectGraduationYear(resumeText);
  const currentYear = new Date().getFullYear();
  const gapInstruction = gradYear !== null && currentYear - gradYear >= 3
    ? `\n지원자의 최종학력 졸업연도는 ${gradYear}년입니다. 졸업 후 기간 및 역량 유지 노력 질문을 1~2개 반드시 포함하세요.`
    : "";

  try {
    const ai = await getAI();
    const response = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: "system",
          content: `당신은 채용 면접관입니다. 반드시 아래에 제공된 정확한 회사명, 인재상, 채용공고/직무기술서에 맞춰 이력서 기반 면접 질문 5개를 생성하세요. 다른 회사나 일반적인 회사로 바꾸지 마세요.${gapInstruction}
JSON 형식으로만 반환: { "questions": ["질문1", "질문2", "질문3", "질문4", "질문5"] }`,
        },
        { role: "user", content: `이력서:\n${resumeText || "(내용 없음)"}\n\n지원 회사 정보:\n${companyContext(company)}` },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}") as { questions?: unknown };
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.filter((question): question is string => typeof question === "string" && question.trim().length > 0).slice(0, 5)
      : [];
    if (questions.length > 0) {
      await db.insert(interviewQuestionsTable).values(
        questions.map((question, index) => ({ sessionId: session.id, question, order: index + 1 })),
      );
      await db.update(interviewSessionsTable).set({ status: "questions_generated" })
        .where(and(eq(interviewSessionsTable.id, session.id), eq(interviewSessionsTable.userId, userId)));
    }
  } catch (err) {
    req.log.error({ err, sessionId: session.id }, "Failed to generate interview questions");
  }

  const result = await getSessionWithQuestions(session.id, userId);
  res.status(201).json(CreateInterviewResponse.parse(result));
});

router.get("/interviews/:id", requireAuth, async (req, res): Promise<void> => {
  const params = parseId(req.params, GetInterviewParams);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const result = await getSessionWithQuestions(params.data.id, req.session.userId!);
  if (!result) {
    res.status(404).json({ error: "면접 세션을 찾을 수 없습니다." });
    return;
  }
  res.json(GetInterviewResponse.parse(result));
});

router.post("/interviews/:id/answers", requireAuth, async (req, res): Promise<void> => {
  const params = parseId(req.params, SubmitAnswersParams);
  const input = SubmitAnswersBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  const userId = req.session.userId!;
  const session = await getSessionWithQuestions(params.data.id, userId);
  if (!session) {
    res.status(404).json({ error: "면접 세션을 찾을 수 없습니다." });
    return;
  }
  const submittedIds = input.data.answers.map((item) => item.questionId);
  if (new Set(submittedIds).size !== submittedIds.length || submittedIds.some((id) => !session.questions.some((question) => question.id === id))) {
    res.status(400).json({ error: "이 면접 세션에 속하지 않는 질문이 포함되어 있습니다." });
    return;
  }

  await Promise.all(input.data.answers.map(({ questionId, answer }) =>
    db.update(interviewQuestionsTable).set({ answer, feedback: null, score: null })
      .where(and(eq(interviewQuestionsTable.id, questionId), eq(interviewQuestionsTable.sessionId, session.id))),
  ));
  await db.update(interviewSessionsTable).set({
    status: "answers_submitted",
    overallScore: null,
    overallFeedback: null,
    evaluatedAt: null,
  }).where(and(eq(interviewSessionsTable.id, session.id), eq(interviewSessionsTable.userId, userId)));

  const result = await getSessionWithQuestions(session.id, userId);
  res.json(SubmitAnswersResponse.parse(result));
});

router.post("/interviews/:id/evaluate", requireAuth, async (req, res): Promise<void> => {
  const params = parseId(req.params, EvaluateAnswersParams);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.session.userId!;
  const session = await getSessionWithQuestions(params.data.id, userId);
  if (!session) {
    res.status(404).json({ error: "면접 세션을 찾을 수 없습니다." });
    return;
  }
  if (session.questions.length === 0 || session.questions.some((question) => question.answer == null)) {
    res.status(400).json({ error: "모든 면접 질문에 답변을 제출한 후 평가할 수 있습니다." });
    return;
  }
  const [company] = await db.select({
    name: companiesTable.name,
    talentProfile: companiesTable.talentProfile,
    jobDescription: companiesTable.jobDescription,
  }).from(companiesTable).where(and(eq(companiesTable.id, session.companyId), eq(companiesTable.userId, userId)));
  if (!company) {
    res.status(404).json({ error: "회사를 찾을 수 없습니다." });
    return;
  }

  try {
    const ai = await getAI();
    const response = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: "system",
          content: `당신은 채용 면접관입니다. 답변을 반드시 제공된 정확한 회사명, 인재상, 채용공고/직무기술서 기준으로 평가하세요. 각 질문을 0~100 정수 점수와 한국어 피드백 2~4문장으로 평가하고, 종합 점수와 피드백을 반환하세요. JSON만 반환하세요:
{ "overallScore": 0, "overallFeedback": "종합 피드백", "evaluations": [{ "questionId": 1, "score": 0, "feedback": "피드백" }] }`,
        },
        {
          role: "user",
          content: `지원 회사 정보:\n${companyContext(company)}\n\n질문과 답변:\n${session.questions.map((question) => `질문 ID ${question.id}: ${question.question}\n답변: ${question.answer}`).join("\n\n")}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const evaluation = JSON.parse(response.choices[0]?.message?.content ?? "{}") as {
      overallScore?: unknown; overallFeedback?: unknown;
      evaluations?: Array<{ questionId?: unknown; score?: unknown; feedback?: unknown }>;
    };
    if (typeof evaluation.overallScore !== "number" || !Number.isInteger(evaluation.overallScore) || evaluation.overallScore < 0 || evaluation.overallScore > 100 ||
      typeof evaluation.overallFeedback !== "string" || !Array.isArray(evaluation.evaluations)) {
      throw new Error("AI returned an invalid interview evaluation");
    }
    const evaluations = new Map(evaluation.evaluations
      .filter((item): item is { questionId: number; score: number; feedback: string } =>
        typeof item.questionId === "number" && Number.isInteger(item.questionId) &&
        typeof item.score === "number" && Number.isInteger(item.score) && item.score >= 0 && item.score <= 100 &&
        typeof item.feedback === "string")
      .map((item) => [item.questionId, item]));
    if (evaluations.size !== session.questions.length || session.questions.some((question) => !evaluations.has(question.id))) {
      throw new Error("AI evaluation did not cover every interview question");
    }
    await Promise.all(session.questions.map((question) => {
      const item = evaluations.get(question.id)!;
      return db.update(interviewQuestionsTable).set({ score: item.score, feedback: item.feedback })
        .where(and(eq(interviewQuestionsTable.id, question.id), eq(interviewQuestionsTable.sessionId, session.id)));
    }));
    await db.update(interviewSessionsTable).set({
      status: "evaluated",
      overallScore: evaluation.overallScore,
      overallFeedback: evaluation.overallFeedback,
      evaluatedAt: new Date(),
    }).where(and(eq(interviewSessionsTable.id, session.id), eq(interviewSessionsTable.userId, userId)));
  } catch (err) {
    req.log.error({ err, sessionId: session.id }, "Failed to evaluate interview answers");
    res.status(502).json({ error: "면접 답변 평가를 완료하지 못했습니다. 잠시 후 다시 시도해주세요." });
    return;
  }

  const result = await getSessionWithQuestions(session.id, userId);
  res.json(EvaluateAnswersResponse.parse(result));
});

export default router;