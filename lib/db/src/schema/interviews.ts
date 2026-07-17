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
