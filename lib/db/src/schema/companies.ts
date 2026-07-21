import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const CAREER_LEVELS    = ["신입", "1년이내", "3년이내"] as const;
export const EDUCATION_LEVELS = ["전문대", "대학교", "석사"] as const;
export const RECRUITMENT_FIELDS = ["개발", "기획", "디자인", "영업", "품질관리", "테스터", "기타"] as const;

export type CareerLevel       = typeof CAREER_LEVELS[number];
export type EducationLevel    = typeof EDUCATION_LEVELS[number];
export type RecruitmentField  = typeof RECRUITMENT_FIELDS[number];

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  siteUrl: text("site_url"),
  jobPostingUrl: text("job_posting_url"),
  talentProfile: text("talent_profile"),
  jobDescription: text("job_description"),
  notes: text("notes"),
  // ── 신규 분류 필드 ──────────────────────────────
  careerLevel: text("career_level").array(),        // 복수 선택: 신입·1년이내·3년이내
  educationLevel: text("education_level"),           // 단일 선택: 전문대·대학교·석사
  recruitmentField: text("recruitment_field").array(), // 복수 선택: 개발·기획·디자인 등
  // ──────────────────────────────────────────────
  isRecommended: boolean("is_recommended").notNull().default(false),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
