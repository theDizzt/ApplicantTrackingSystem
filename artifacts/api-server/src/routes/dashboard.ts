import { Router, type IRouter } from "express";
import { eq, count, sql } from "drizzle-orm";
import { db, resumesTable, companiesTable, analysesTable, interviewSessionsTable, interviewQuestionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [resumeCount] = await db.select({ count: count() }).from(resumesTable).where(eq(resumesTable.userId, userId));
  const [companyCount] = await db.select({ count: count() }).from(companiesTable).where(eq(companiesTable.userId, userId));

  const analyses = await db.select().from(analysesTable)
    .where(eq(analysesTable.userId, userId))
    .orderBy(sql`${analysesTable.createdAt} DESC`)
    .limit(100);

  const totalAnalyses = analyses.length;
  const passedAnalyses = analyses.filter(a => a.overallResult === "pass").length;
  const failedAnalyses = analyses.filter(a => a.overallResult === "fail").length;
  const pendingAnalyses = analyses.filter(a => a.status !== "completed" && a.status !== "failed").length;

  const scores = analyses.filter(a => a.overallScore != null).map(a => a.overallScore!);
  const averageScore = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;

  const interviews = await db.select().from(interviewSessionsTable)
    .where(eq(interviewSessionsTable.userId, userId))
    .orderBy(sql`${interviewSessionsTable.createdAt} DESC`)
    .limit(100);

  const totalInterviews = interviews.length;

  // Get recent items with names
  const recentAnalysesRaw = analyses.slice(0, 5);
  const recentInterviewsRaw = interviews.slice(0, 5);

  const allResumeIds = [...new Set([...recentAnalysesRaw.map(a => a.resumeId), ...recentInterviewsRaw.map(i => i.resumeId)])];
  const allCompanyIds = [...new Set([...recentAnalysesRaw.map(a => a.companyId), ...recentInterviewsRaw.map(i => i.companyId)])];

  const resumesList = allResumeIds.length > 0
    ? await db.select({ id: resumesTable.id, title: resumesTable.title }).from(resumesTable).where(eq(resumesTable.userId, userId))
    : [];
  const companiesList = allCompanyIds.length > 0
    ? await db.select({ id: companiesTable.id, name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.userId, userId))
    : [];

  const resumeMap = Object.fromEntries(resumesList.map(r => [r.id, r.title]));
  const companyMap = Object.fromEntries(companiesList.map(c => [c.id, c.name]));

  const recentAnalyses = recentAnalysesRaw.map(a => ({
    id: a.id, userId: a.userId, resumeId: a.resumeId, companyId: a.companyId,
    status: a.status, overallResult: a.overallResult ?? null, overallScore: a.overallScore ?? null,
    aiWritingScore: a.aiWritingScore ?? null, aiWritingFeedback: a.aiWritingFeedback ?? null,
    languageScore: a.languageScore ?? null, languageFeedback: a.languageFeedback ?? null,
    jobMatchScore: a.jobMatchScore ?? null, jobMatchFeedback: a.jobMatchFeedback ?? null,
    improvementSuggestions: a.improvementSuggestions ?? null,
    resumeTitle: resumeMap[a.resumeId] ?? null, companyName: companyMap[a.companyId] ?? null,
    createdAt: a.createdAt.toISOString(), completedAt: a.completedAt ? a.completedAt.toISOString() : null,
  }));

  const recentInterviewsWithQuestions = await Promise.all(recentInterviewsRaw.map(async s => {
    const questions = await db.select().from(interviewQuestionsTable)
      .where(eq(interviewQuestionsTable.sessionId, s.id)).orderBy(interviewQuestionsTable.order);
    return {
      id: s.id, userId: s.userId, resumeId: s.resumeId, companyId: s.companyId,
      status: s.status,
      questions: questions.map(q => ({
        id: q.id, question: q.question, order: q.order,
        answer: q.answer ?? null, feedback: q.feedback ?? null, score: q.score ?? null,
        parentQuestionId: q.parentQuestionId ?? null, depth: q.depth ?? 0, focus: q.focus ?? null,
      })),
      overallScore: s.overallScore ?? null, overallFeedback: s.overallFeedback ?? null,
      resumeTitle: resumeMap[s.resumeId] ?? null, companyName: companyMap[s.companyId] ?? null,
      createdAt: s.createdAt.toISOString(), evaluatedAt: s.evaluatedAt ? s.evaluatedAt.toISOString() : null,
    };
  }));

  res.json({
    totalResumes: resumeCount.count,
    totalCompanies: companyCount.count,
    totalAnalyses,
    passedAnalyses,
    failedAnalyses,
    pendingAnalyses,
    totalInterviews,
    averageScore,
    recentAnalyses,
    recentInterviews: recentInterviewsWithQuestions,
  });
});

export default router;
