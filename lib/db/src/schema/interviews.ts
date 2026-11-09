import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const interviewSessionsTable = pgTable("interview_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  resumeId: integer("resume_id").notNull(),
  companyId: integer("company_id").notNull(),
  status: text("status").notNull().default("pending"),
  overallScore: integer("overall_score"),
  overallFeedback: text("overall_feedback"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
});

export const interviewQuestionsTable = pgTable("interview_questions", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  question: text("question").notNull(),
  order: integer("order").notNull(),
  answer: text("answer"),
  feedback: text("feedback"),
  score: integer("score"),
  // 꼬리 질문: 어떤 질문의 답변에서 이어진 질문인지(null이면 기본 질문)와 몇 번째 꼬리인지(0 = 기본 질문)
  parentQuestionId: integer("parent_question_id"),
  depth: integer("depth").notNull().default(0),
  // 질문 의도: 서류 심사에서 찾은 약점(탈락 원인) 등 이 질문을 묻는 이유
  focus: text("focus"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInterviewSessionSchema = createInsertSchema(interviewSessionsTable).omit({
  id: true,
  createdAt: true,
});
export const insertInterviewQuestionSchema = createInsertSchema(interviewQuestionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertInterviewSession = z.infer<typeof insertInterviewSessionSchema>;
export type InsertInterviewQuestion = z.infer<typeof insertInterviewQuestionSchema>;
export type InterviewSession = typeof interviewSessionsTable.$inferSelect;
export type InterviewQuestion = typeof interviewQuestionsTable.$inferSelect;
