import { pgTable, text, serial, timestamp, integer, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const CAREER_LEVELS    = ["신입", "1년이내", "3년이내"] as const;
export const EDUCATION_LEVELS = ["전문대", "대학교", "석사"] as const;
export const RECRUITMENT_FIELDS = ["개발", "기획", "디자인", "영업", "품질관리", "테스터", "기타"] as const;
/** 지원 진행 상태 (지원 일정 캘린더·회사 목록 표시용) */
export const APPLICATION_STATUSES = ["관심", "지원 예정", "지원 완료", "서류 합격", "면접 진행", "최종 합격", "불합격"] as const;
export type ApplicationStatus = typeof APPLICATION_STATUSES[number];

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
  // ── 지원 일정 (YYYY-MM-DD) ──────────────────────
  applicationStatus: text("application_status"),     // APPLICATION_STATUSES 중 하나
  deadlineDate: date("deadline_date", { mode: "string" }),         // 서류 마감일
  announcementDate: date("announcement_date", { mode: "string" }), // 결과 발표일
  interviewDate: date("interview_date", { mode: "string" }),       // 면접일
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
