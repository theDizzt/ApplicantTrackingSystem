import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  AnswerFollowUpBody,
  AnswerFollowUpParams,
  AnswerFollowUpResponse,
  AnswerLiveQuestionParams,
  AnswerLiveQuestionResponse,
  CreateInterviewBody,
  CreateInterviewResponse,
  EvaluateAnswersParams,
  EvaluateAnswersResponse,
  FinishLiveInterviewParams,
  FinishLiveInterviewResponse,
  GetInterviewParams,
  GetInterviewResponse,
  ListInterviewsResponse,
  SubmitAnswersBody,
  SubmitAnswersParams,
  SubmitAnswersResponse,
} from "@workspace/api-zod";
import { db, interviewSessionsTable, interviewQuestionsTable, resumesTable, companiesTable, analysesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { aiBlockedMessage, getAI } from "../lib/openai";
import { resumeHtmlToText } from "../lib/resume-text";
import { handleAudioUpload, limitConcurrentAudioJobs, transcribeUpload } from "../lib/audio-transcription";
import {
  FOLLOW_UP_ANSWER_SYSTEM,
  FOLLOW_UP_RULES,
  LIVE_ANSWER_SYSTEM,
  LIVE_SUMMARY_SYSTEM,
  COMPANY_CONTEXT_LIMITS,
  DIFFICULTY_RULES,
  buildChain,
  canAddFollowUp,
  chainFrom,
  cleanFollowUpQuestion,
  descendantIds,
  extractWeaknesses,
  followUpTone,
  formatChain,
  parseDifficulty,
  questionStyleInstruction,
  toneInstruction,
  truncateForPrompt,
  weaknessInstruction,
} from "../lib/interview-followups";

const router: IRouter = Router();
const LIVE_ONLY_MESSAGE = "실시간 면접은 음성으로 한 문제씩 답합니다. 실시간 면접 화면에서 이어서 진행해주세요.";
const MIN_SPOKEN_ANSWER_LENGTH = 2;

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
    mode: session.mode === "live" ? "live" as const : "text" as const,
    difficulty: parseDifficulty(session.difficulty),
    questions: questions.map((q) => ({
      id: q.id,
      question: q.question,
      order: q.order,
      answer: q.answer ?? null,
      feedback: q.feedback ?? null,
      score: q.score ?? null,
      parentQuestionId: q.parentQuestionId ?? null,
      depth: q.depth ?? 0,
      focus: q.focus ?? null,
      tone: q.tone === "pressure" || q.tone === "neutral" || q.tone === "positive" ? q.tone : null,
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

/**
 * 프롬프트에 넣을 회사 정보. compact는 답변 하나마다 반복해서 보내는 호출(꼬리 질문·실시간 답변)용으로,
 * 인재상·공고를 잘라 토큰을 아낀다. 질문 생성·일괄 평가·종합 평가는 전문을 쓴다.
 */
function companyContext(
  company: { name: string; talentProfile: string | null; jobDescription: string | null },
  compact = false,
) {
  const talentProfile = compact ? truncateForPrompt(company.talentProfile, COMPANY_CONTEXT_LIMITS.talentProfile) : company.talentProfile;
  const jobDescription = compact ? truncateForPrompt(company.jobDescription, COMPANY_CONTEXT_LIMITS.jobDescription) : company.jobDescription;
  return [
    `회사명(정확히 이 회사): ${company.name}`,
    `인재상: ${talentProfile || "(등록된 인재상 없음)"}`,
    `채용공고/직무기술서: ${jobDescription || "(등록된 직무기술서 없음)"}`,
  ].join("\n");
}

function abstractQuestion(paper: { title?: string; abstract?: string }): string {
  const evidence = resumeHtmlToText(paper.abstract).replace(/\s+/g, " ").slice(0, 180);
  return `"${paper.title || "해당 논문"}"의 Abstract에 기재된 “${evidence}${evidence.length === 180 ? "…" : ""}” 내용을 바탕으로, 연구 문제와 본인의 구체적인 기여를 설명해 주세요.`;
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
  const mode = input.data.mode ?? "text";
  const difficulty = input.data.difficulty ?? "normal";
  const [[resume], [company], [latestAnalysis]] = await Promise.all([
    db.select().from(resumesTable).where(and(eq(resumesTable.id, resumeId), eq(resumesTable.userId, userId))),
    db.select().from(companiesTable).where(and(eq(companiesTable.id, companyId), eq(companiesTable.userId, userId))),
    // 같은 이력서·회사로 완료된 가장 최근 서류 심사 — 약점 기반 질문에 쓴다
    db.select({ richAnalysisResult: analysesTable.richAnalysisResult }).from(analysesTable)
      .where(and(
        eq(analysesTable.userId, userId),
        eq(analysesTable.resumeId, resumeId),
        eq(analysesTable.companyId, companyId),
        eq(analysesTable.status, "completed"),
      ))
      .orderBy(desc(analysesTable.createdAt))
      .limit(1),
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
    .values({ userId, resumeId, companyId, mode, difficulty, status: "pending" })
    .returning();

  let generated = false; // 질문을 실제로 저장했는지
  const resumeText = [resume.content, resume.coverLetter].map(resumeHtmlToText).filter(Boolean).join("\n\n");
  let papers: Array<{ title?: string; authors?: string[]; venue?: string; abstract?: string }> = [];
  try {
    const career = JSON.parse(resume.careerAnalysisResult ?? "{}") as { papers?: unknown };
    if (Array.isArray(career.papers)) papers = career.papers.slice(0, 10);
  } catch { papers = []; }
  const paperWithAbstract = papers.find((paper) => typeof paper.abstract === "string" && paper.abstract.trim().length > 0);
  const paperContext = papers.length > 0
    ? `\n\n논문 정보:\n${papers.map((paper, index) => `${index + 1}. 제목: ${paper.title || "(미상)"}\n저자순: ${(paper.authors || []).join(", ") || "(미상)"}\n학회/저널: ${paper.venue || "(미상)"}\nAbstract: ${paper.abstract || "(기재 없음)"}`).join("\n\n")}`
    : "";
  const gradYear = detectGraduationYear(resumeText);
  const currentYear = new Date().getFullYear();
  const gapInstruction = gradYear !== null && currentYear - gradYear >= 3
    ? `\n지원자의 최종학력 졸업연도는 ${gradYear}년입니다. 졸업 후 기간 및 역량 유지 노력 질문을 1~2개 반드시 포함하세요.`
    : "";
  const weaknesses = extractWeaknesses(latestAnalysis?.richAnalysisResult);
  const weaknessTitles = new Set(weaknesses.map((w) => w.title));

  try {
    const ai = await getAI("interview");
    const response = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: "system",
          content: `당신은 채용 면접관입니다. 반드시 아래에 제공된 정확한 회사명, 인재상, 채용공고/직무기술서에 맞춰 이력서 기반 면접 질문 5개를 생성하세요. 다른 회사나 일반적인 회사로 바꾸지 마세요.${questionStyleInstruction(difficulty)}${gapInstruction}${paperWithAbstract ? "\n논문 Abstract가 제공된 경우 그 연구 내용·방법·기여를 직접 확인하는 질문을 1개 포함하고 source를 paper_abstract로 지정하세요." : ""}
JSON 형식으로만 반환: { "questions": [{ "question": "질문", "source": "resume|company|paper_abstract|weakness", "focus": "weakness일 때 약점 제목, 아니면 빈 문자열" }] }`,
        },
        { role: "user", content: `이력서:\n${resumeText || "(내용 없음)"}${paperContext}\n\n지원 회사 정보:\n${companyContext(company)}${weaknessInstruction(weaknesses)}` },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}") as { questions?: unknown[] };
    const items = Array.isArray(parsed.questions) ? parsed.questions : [];
    let questions: { question: string; source: unknown; focus?: string | null }[] = items.map((item) => {
      if (typeof item === "string") return { question: item, source: "" };
      const obj = item as { question?: unknown; source?: unknown; focus?: unknown };
      // focus는 실제 약점 제목과 일치할 때만 남긴다(AI가 지어낸 의도 표기 방지)
      const focus = obj.source === "weakness" && typeof obj.focus === "string" && weaknessTitles.has(obj.focus.trim())
        ? obj.focus.trim()
        : null;
      return { question: typeof obj.question === "string" ? obj.question : "", source: obj.source, focus };
    }).filter((item) => item.question.trim().length > 0);
    if (paperWithAbstract) {
      questions = questions.filter((item) => item.source !== "paper_abstract");
      questions.unshift({ question: abstractQuestion(paperWithAbstract), source: "paper_abstract" });
    }
    questions = [...new Map(questions.map((item) => [item.question.trim(), item])).values()].slice(0, 5);
    const fallbackQuestions = [
      `${company.name}의 지원 직무에서 가장 먼저 기여할 수 있는 본인의 경험을 설명해 주세요.`,
      "이력서에 기재한 성과 중 가장 어려운 문제를 해결한 과정을 구체적으로 설명해 주세요.",
      "협업 중 의견 충돌을 조정하고 결과를 만든 경험을 설명해 주세요.",
      "지원 직무 역량을 최근까지 발전시키기 위해 어떤 노력을 했는지 설명해 주세요.",
      `${company.name}의 인재상과 본인이 부합한다고 생각하는 근거를 사례로 설명해 주세요.`,
    ];
    for (const fallback of fallbackQuestions) {
      if (questions.length >= 5) break;
      if (!questions.some((item) => item.question === fallback)) questions.push({ question: fallback, source: "resume" });
    }
    if (questions.length > 0) {
      await db.insert(interviewQuestionsTable).values(
        questions.map((item, index) => ({
          sessionId: session.id,
          question: item.question.trim(),
          order: index + 1,
          focus: item.focus ?? null,
        })),
      );
      await db.update(interviewSessionsTable).set({ status: "questions_generated" })
        .where(and(eq(interviewSessionsTable.id, session.id), eq(interviewSessionsTable.userId, userId)));
      generated = true;
    }
  } catch (err) {
    req.log.error({ err, sessionId: session.id }, "Failed to generate interview questions");
  }

  if (!generated) {
    // 질문 없이 남은 세션은 화면에서 "생성 중"으로 영원히 멈추므로 지우고 오류를 알린다.
    await db.delete(interviewQuestionsTable).where(eq(interviewQuestionsTable.sessionId, session.id));
    await db.delete(interviewSessionsTable)
      .where(and(eq(interviewSessionsTable.id, session.id), eq(interviewSessionsTable.userId, userId)));
    res.status(502).json({ error: aiBlockedMessage() ?? "면접 질문을 만들지 못했습니다. 잠시 후 다시 시도해주세요." });
    return;
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
  if (session.mode === "live") {
    res.status(409).json({ error: LIVE_ONLY_MESSAGE });
    return;
  }
  // 일괄 제출은 기본 질문만 받는다. 꼬리 질문은 /follow-ups/:questionId/answer로 하나씩 답한다.
  const baseQuestions = session.questions.filter((question) => question.parentQuestionId == null);
  const submittedIds = input.data.answers.map((item) => item.questionId);
  if (new Set(submittedIds).size !== submittedIds.length || submittedIds.some((id) => !baseQuestions.some((question) => question.id === id))) {
    res.status(400).json({ error: "이 면접 세션에 속하지 않는 질문이 포함되어 있습니다." });
    return;
  }

  await Promise.all(input.data.answers.map(({ questionId, answer }) =>
    db.update(interviewQuestionsTable).set({ answer, feedback: null, score: null })
      .where(and(eq(interviewQuestionsTable.id, questionId), eq(interviewQuestionsTable.sessionId, session.id))),
  ));
  // 답변이 바뀌었으므로 이전 답변에서 나온 꼬리 질문은 모두 무효
  const staleFollowUpIds = session.questions.filter((question) => question.parentQuestionId != null).map((question) => question.id);
  if (staleFollowUpIds.length > 0) {
    await db.delete(interviewQuestionsTable)
      .where(and(eq(interviewQuestionsTable.sessionId, session.id), inArray(interviewQuestionsTable.id, staleFollowUpIds)));
  }
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
  if (session.mode === "live") {
    res.status(409).json({ error: LIVE_ONLY_MESSAGE });
    return;
  }
  const baseQuestions = session.questions.filter((question) => question.parentQuestionId == null);
  if (baseQuestions.length === 0 || baseQuestions.some((question) => question.answer == null)) {
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
    const ai = await getAI("interview");
    const response = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: "system",
          content: `당신은 채용 면접관입니다. 답변을 반드시 제공된 정확한 회사명, 인재상, 채용공고/직무기술서 기준으로 평가하세요. 각 질문을 0~100 정수 점수와 한국어 피드백 2~4문장으로 평가하고, 종합 점수와 피드백을 반환하세요. 각 답변마다 이어서 물어볼 꼬리 질문(followUp)도 함께 작성하세요. JSON만 반환하세요:
{ "overallScore": 0, "overallFeedback": "종합 피드백", "evaluations": [{ "questionId": 1, "score": 0, "feedback": "피드백", "followUp": "꼬리 질문 또는 빈 문자열" }] }

${FOLLOW_UP_RULES}

${toneInstruction(session.difficulty)}`,
        },
        {
          role: "user",
          content: `지원 회사 정보:\n${companyContext(company)}\n\n질문과 답변:\n${baseQuestions.map((question) => `질문 ID ${question.id}${question.focus ? ` (확인할 약점: ${question.focus})` : ""}: ${question.question}\n답변: ${question.answer}`).join("\n\n")}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const evaluation = JSON.parse(response.choices[0]?.message?.content ?? "{}") as {
      overallScore?: unknown; overallFeedback?: unknown;
      evaluations?: Array<{ questionId?: unknown; score?: unknown; feedback?: unknown; followUp?: unknown }>;
    };
    if (typeof evaluation.overallScore !== "number" || !Number.isInteger(evaluation.overallScore) || evaluation.overallScore < 0 || evaluation.overallScore > 100 ||
      typeof evaluation.overallFeedback !== "string" || !Array.isArray(evaluation.evaluations)) {
      throw new Error("AI returned an invalid interview evaluation");
    }
    const evaluations = new Map(evaluation.evaluations
      .filter((item): item is { questionId: number; score: number; feedback: string; followUp?: unknown } =>
        typeof item.questionId === "number" && Number.isInteger(item.questionId) &&
        typeof item.score === "number" && Number.isInteger(item.score) && item.score >= 0 && item.score <= 100 &&
        typeof item.feedback === "string")
      .map((item) => [item.questionId, item]));
    if (evaluations.size !== baseQuestions.length || baseQuestions.some((question) => !evaluations.has(question.id))) {
      throw new Error("AI evaluation did not cover every interview question");
    }
    await Promise.all(baseQuestions.map((question) => {
      const item = evaluations.get(question.id)!;
      return db.update(interviewQuestionsTable).set({ score: item.score, feedback: item.feedback })
        .where(and(eq(interviewQuestionsTable.id, question.id), eq(interviewQuestionsTable.sessionId, session.id)));
    }));

    // 꼬리 질문: 재평가라면 이전 꼬리 질문을 지우고 새로 만든다
    const oldFollowUpIds = session.questions.filter((question) => question.parentQuestionId != null).map((question) => question.id);
    if (oldFollowUpIds.length > 0) {
      await db.delete(interviewQuestionsTable)
        .where(and(eq(interviewQuestionsTable.sessionId, session.id), inArray(interviewQuestionsTable.id, oldFollowUpIds)));
    }
    // 면접 전체 꼬리 질문 수 상한이 있으므로, 점수가 낮은(더 파고들 필요가 있는) 답변부터 꼬리 질문을 붙인다
    const followUps = baseQuestions
      .flatMap((question) => {
        const item = evaluations.get(question.id)!;
        const text = cleanFollowUpQuestion(item.followUp);
        return text ? [{ question, score: item.score, text }] : [];
      })
      .sort((a, b) => a.score - b.score || a.question.order - b.question.order)
      .slice(0, DIFFICULTY_RULES[session.difficulty].maxFollowUps)
      .map(({ question, score, text }) => ({
        sessionId: session.id,
        question: text,
        order: question.order,
        parentQuestionId: question.id,
        depth: 1,
        focus: question.focus ?? null,
        tone: followUpTone(score, session.difficulty),
      }));
    if (followUps.length > 0) {
      await db.insert(interviewQuestionsTable).values(followUps);
    }
    await db.update(interviewSessionsTable).set({
      status: "evaluated",
      overallScore: evaluation.overallScore,
      overallFeedback: evaluation.overallFeedback,
      evaluatedAt: new Date(),
    }).where(and(eq(interviewSessionsTable.id, session.id), eq(interviewSessionsTable.userId, userId)));
  } catch (err) {
    req.log.error({ err, sessionId: session.id }, "Failed to evaluate interview answers");
    // "답변 평가 중" 상태로 멈추지 않도록 답변 입력 상태로 되돌린다 (저장된 답변은 그대로 남음)
    if (session.status === "answers_submitted") {
      await db.update(interviewSessionsTable).set({ status: "questions_generated" })
        .where(and(eq(interviewSessionsTable.id, session.id), eq(interviewSessionsTable.userId, userId)));
    }
    res.status(502).json({ error: aiBlockedMessage() ?? "면접 답변 평가를 완료하지 못했습니다. 저장된 답변으로 다시 제출해주세요." });
    return;
  }

  const result = await getSessionWithQuestions(session.id, userId);
  res.json(EvaluateAnswersResponse.parse(result));
});

router.post("/interviews/:id/follow-ups/:questionId/answer", requireAuth, async (req, res): Promise<void> => {
  const params = AnswerFollowUpParams.safeParse(req.params);
  const input = AnswerFollowUpBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!input.success || input.data.answer.trim().length === 0) {
    res.status(400).json({ error: "꼬리 질문에 대한 답변을 입력해주세요." });
    return;
  }
  const userId = req.session.userId!;
  const session = await getSessionWithQuestions(params.data.id, userId);
  if (!session) {
    res.status(404).json({ error: "면접 세션을 찾을 수 없습니다." });
    return;
  }
  if (session.mode === "live") {
    res.status(409).json({ error: LIVE_ONLY_MESSAGE });
    return;
  }
  const target = session.questions.find((question) => question.id === params.data.questionId);
  if (!target || target.parentQuestionId == null) {
    res.status(404).json({ error: "꼬리 질문을 찾을 수 없습니다." });
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

  const answer = input.data.answer.trim();
  // 기본 질문부터 지금 질문까지의 흐름. 마지막 질문의 답변은 이번에 받은 답변으로 채운다.
  const chain = buildChain(session.questions, target.id)
    .map((question) => (question.id === target.id ? { ...question, answer } : question));
  const depth = target.depth ?? 1;
  // 다시 답한 경우, 이전 답변에서 이어졌던 더 깊은 꼬리 질문은 무효 (개수 상한 계산에서도 뺀다)
  const stale = descendantIds(session.questions, target.id);
  const followUpCount = session.questions.filter((question) => question.parentQuestionId != null && !stale.includes(question.id)).length;
  const canGoDeeper = canAddFollowUp(depth, followUpCount, session.difficulty);

  try {
    const ai = await getAI("interview");
    const response = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        { role: "system", content: `${FOLLOW_UP_ANSWER_SYSTEM}\n\n${toneInstruction(session.difficulty)}` },
        {
          role: "user",
          content: `지원 회사 정보:\n${companyContext(company, true)}${target.focus ? `\n\n이 질문으로 확인하려는 약점: ${target.focus}` : ""}\n\n질문·답변 흐름:\n${chain.map((question, index) => `${index === 0 ? "기본 질문" : `꼬리 질문 ${index}`}: ${question.question}\n답변: ${question.answer ?? "(없음)"}`).join("\n\n")}${canGoDeeper ? "" : "\n\n이번이 마지막 꼬리 질문입니다. followUp은 빈 문자열로 두세요."}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}") as { score?: unknown; feedback?: unknown; followUp?: unknown };
    if (typeof parsed.score !== "number" || !Number.isInteger(parsed.score) || parsed.score < 0 || parsed.score > 100 ||
      typeof parsed.feedback !== "string" || parsed.feedback.trim().length === 0) {
      throw new Error("AI returned an invalid follow-up evaluation");
    }

    await db.update(interviewQuestionsTable).set({ answer, score: parsed.score, feedback: parsed.feedback.trim() })
      .where(and(eq(interviewQuestionsTable.id, target.id), eq(interviewQuestionsTable.sessionId, session.id)));
    if (stale.length > 0) {
      await db.delete(interviewQuestionsTable)
        .where(and(eq(interviewQuestionsTable.sessionId, session.id), inArray(interviewQuestionsTable.id, stale)));
    }
    const next = canGoDeeper ? cleanFollowUpQuestion(parsed.followUp) : null;
    if (next) {
      await db.insert(interviewQuestionsTable).values({
        sessionId: session.id,
        question: next,
        order: target.order,
        parentQuestionId: target.id,
        depth: depth + 1,
        focus: target.focus ?? null,
        tone: followUpTone(parsed.score, session.difficulty),
      });
    }
  } catch (err) {
    req.log.error({ err, sessionId: session.id, questionId: target.id }, "Failed to evaluate follow-up answer");
    res.status(502).json({ error: "꼬리 질문 답변 평가를 완료하지 못했습니다. 잠시 후 다시 시도해주세요." });
    return;
  }

  const result = await getSessionWithQuestions(session.id, userId);
  res.json(AnswerFollowUpResponse.parse(result));
});

// ── 실시간(음성) 면접 ─────────────────────────────────────────────────────────
// 질문 하나에 음성으로 답하면 STT → 바로 평가 → (필요하면) 꼬리 질문 추가. 화면은 돌려받은 세션에서 다음 질문을 고른다.

async function getCompanyContext(companyId: number, userId: number) {
  const [company] = await db.select({
    name: companiesTable.name,
    talentProfile: companiesTable.talentProfile,
    jobDescription: companiesTable.jobDescription,
  }).from(companiesTable).where(and(eq(companiesTable.id, companyId), eq(companiesTable.userId, userId)));
  return company ?? null;
}

router.post(
  "/interviews/:id/live/answers/:questionId",
  requireAuth,
  limitConcurrentAudioJobs,
  handleAudioUpload,
  async (req, res): Promise<void> => {
    const params = AnswerLiveQuestionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "답변 녹음을 첨부해주세요." });
      return;
    }
    const userId = req.session.userId!;
    const session = await getSessionWithQuestions(params.data.id, userId);
    if (!session) {
      res.status(404).json({ error: "면접 세션을 찾을 수 없습니다." });
      return;
    }
    if (session.mode !== "live") {
      res.status(409).json({ error: "실시간 면접 세션이 아닙니다." });
      return;
    }
    if (session.status === "evaluated") {
      res.status(409).json({ error: "이미 끝난 면접입니다." });
      return;
    }
    const target = session.questions.find((question) => question.id === params.data.questionId);
    if (!target) {
      res.status(404).json({ error: "질문을 찾을 수 없습니다." });
      return;
    }
    if (target.answer != null) {
      res.status(409).json({ error: "이미 답한 질문입니다." });
      return;
    }
    const company = await getCompanyContext(session.companyId, userId);
    if (!company) {
      res.status(404).json({ error: "회사를 찾을 수 없습니다." });
      return;
    }

    let transcript: string;
    try {
      transcript = await transcribeUpload(req.file, req.log);
    } catch (err) {
      req.log.error({ err, sessionId: session.id, questionId: target.id }, "Live interview transcription failed");
      res.status(502).json({
        error: err instanceof Error && err.message.includes("설정되지 않았습니다")
          ? err.message
          : "음성을 글로 옮기지 못했습니다. 다시 답해주세요.",
      });
      return;
    }
    if (transcript.length < MIN_SPOKEN_ANSWER_LENGTH) {
      res.status(422).json({ error: "답변 음성을 인식하지 못했습니다. 마이크를 확인하고 다시 답해주세요." });
      return;
    }

    const chain = buildChain(session.questions, target.id)
      .map((question) => (question.id === target.id ? { ...question, answer: transcript } : question));
    const depth = target.depth ?? 0;
    const followUpCount = session.questions.filter((question) => question.parentQuestionId != null).length;
    const canGoDeeper = canAddFollowUp(depth, followUpCount, session.difficulty);

    try {
      const ai = await getAI("interview");
      const response = await ai.openai.chat.completions.create({
        model: ai.model,
        messages: [
          { role: "system", content: `${LIVE_ANSWER_SYSTEM}\n\n${toneInstruction(session.difficulty)}` },
          {
            role: "user",
            content: `지원 회사 정보:\n${companyContext(company, true)}${target.focus ? `\n\n이 질문으로 확인하려는 약점: ${target.focus}` : ""}\n\n질문·답변 흐름:\n${formatChain(chain)}${canGoDeeper ? "" : "\n\n이번이 마지막 꼬리 질문입니다. followUp은 빈 문자열로 두세요."}`,
          },
        ],
        response_format: { type: "json_object" },
      });
      const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}") as { score?: unknown; feedback?: unknown; followUp?: unknown };
      if (typeof parsed.score !== "number" || !Number.isInteger(parsed.score) || parsed.score < 0 || parsed.score > 100 ||
        typeof parsed.feedback !== "string" || parsed.feedback.trim().length === 0) {
        throw new Error("AI returned an invalid live answer evaluation");
      }

      await db.update(interviewQuestionsTable).set({ answer: transcript, score: parsed.score, feedback: parsed.feedback.trim() })
        .where(and(eq(interviewQuestionsTable.id, target.id), eq(interviewQuestionsTable.sessionId, session.id)));
      const next = canGoDeeper ? cleanFollowUpQuestion(parsed.followUp) : null;
      if (next) {
        await db.insert(interviewQuestionsTable).values({
          sessionId: session.id,
          question: next,
          order: target.order,
          parentQuestionId: target.id,
          depth: depth + 1,
          focus: target.focus ?? null,
          tone: followUpTone(parsed.score, session.difficulty),
        });
      }
    } catch (err) {
      req.log.error({ err, sessionId: session.id, questionId: target.id }, "Failed to evaluate live interview answer");
      res.status(502).json({ error: aiBlockedMessage() ?? "답변을 평가하지 못했습니다. 다시 답해주세요." });
      return;
    }

    const result = await getSessionWithQuestions(session.id, userId);
    res.json(AnswerLiveQuestionResponse.parse({ transcript, session: result }));
  },
);

router.post("/interviews/:id/live/finish", requireAuth, async (req, res): Promise<void> => {
  const params = FinishLiveInterviewParams.safeParse(req.params);
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
  if (session.mode !== "live") {
    res.status(409).json({ error: "실시간 면접 세션이 아닙니다." });
    return;
  }
  if (session.status === "evaluated") {
    res.json(FinishLiveInterviewResponse.parse(session));
    return;
  }
  const baseQuestions = session.questions.filter((question) => question.parentQuestionId == null);
  if (!baseQuestions.some((question) => question.answer != null)) {
    res.status(400).json({ error: "질문에 하나 이상 답한 뒤 면접을 끝낼 수 있습니다." });
    return;
  }
  const company = await getCompanyContext(session.companyId, userId);
  if (!company) {
    res.status(404).json({ error: "회사를 찾을 수 없습니다." });
    return;
  }

  // 답하지 않고 끝낸 꼬리 질문은 기록에서 뺀다 (기본 질문은 "답하지 않음"으로 남겨 평가에 반영)
  const unansweredFollowUps = session.questions
    .filter((question) => question.parentQuestionId != null && question.answer == null)
    .map((question) => question.id);
  const answeredQuestions = session.questions.filter((question) => !unansweredFollowUps.includes(question.id));
  const transcriptText = baseQuestions
    .map((base, index) =>
      `[질문 ${index + 1}]${base.focus ? ` (확인할 약점: ${base.focus})` : ""}\n${formatChain(chainFrom(answeredQuestions, base.id))}`)
    .join("\n\n");

  try {
    const ai = await getAI("interview");
    const response = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        { role: "system", content: `${LIVE_SUMMARY_SYSTEM}\n${DIFFICULTY_RULES[session.difficulty].scoringStyle}` },
        { role: "user", content: `지원 회사 정보:\n${companyContext(company)}\n\n면접 기록:\n${transcriptText}` },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}") as { overallScore?: unknown; overallFeedback?: unknown };
    if (typeof parsed.overallScore !== "number" || !Number.isInteger(parsed.overallScore) || parsed.overallScore < 0 || parsed.overallScore > 100 ||
      typeof parsed.overallFeedback !== "string" || parsed.overallFeedback.trim().length === 0) {
      throw new Error("AI returned an invalid live interview summary");
    }
    if (unansweredFollowUps.length > 0) {
      await db.delete(interviewQuestionsTable)
        .where(and(eq(interviewQuestionsTable.sessionId, session.id), inArray(interviewQuestionsTable.id, unansweredFollowUps)));
    }
    await db.update(interviewSessionsTable).set({
      status: "evaluated",
      overallScore: parsed.overallScore,
      overallFeedback: parsed.overallFeedback.trim(),
      evaluatedAt: new Date(),
    }).where(and(eq(interviewSessionsTable.id, session.id), eq(interviewSessionsTable.userId, userId)));
  } catch (err) {
    req.log.error({ err, sessionId: session.id }, "Failed to summarize live interview");
    res.status(502).json({ error: aiBlockedMessage() ?? "종합 평가를 만들지 못했습니다. 잠시 후 다시 시도해주세요." });
    return;
  }

  const result = await getSessionWithQuestions(session.id, userId);
  res.json(FinishLiveInterviewResponse.parse(result));
});

export default router;