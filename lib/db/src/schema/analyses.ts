import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  resumeId: integer("resume_id").notNull(),
  companyId: integer("company_id").notNull(),
  status: text("status").notNull().default("pending"),
  overallResult: text("overall_result"),
  overallScore: integer("overall_score"),
  aiWritingScore: integer("ai_writing_score"),
  aiWritingFeedback: text("ai_writing_feedback"),
  languageScore: integer("language_score"),
  languageFeedback: text("language_feedback"),
  jobMatchScore: integer("job_match_score"),
  jobMatchFeedback: text("job_match_feedback"),
  improvementSuggestions: text("improvement_suggestions"),
  urlAnalysisResult: text("url_analysis_result"),
  richAnalysisResult: text("rich_analysis_result"), // JSON: technicalSkills, personality, orgFit, urlAiEvaluation
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
