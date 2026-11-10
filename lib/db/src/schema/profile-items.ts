import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * 이력 항목 — 자격증·어학·프로젝트·수상/공모전·대외활동·경력·교육을 한 곳에서 관리하고
 * 여러 이력서에 골라 넣는다. (로드맵 5번 "이력서 항목 통합 관리")
 */
export const PROFILE_ITEM_KINDS = ["certificate", "language", "project", "award", "activity", "career", "education"] as const;
export type ProfileItemKind = typeof PROFILE_ITEM_KINDS[number];

export const profileItemsTable = pgTable("profile_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  kind: text("kind").notNull(),               // PROFILE_ITEM_KINDS
  title: text("title").notNull(),             // 자격증명·프로젝트명·대회명 등
  organization: text("organization"),         // 발급기관·주최·소속
  startDate: text("start_date"),              // YYYY-MM 또는 YYYY-MM-DD (취득일·시작일)
  endDate: text("end_date"),                  // 종료일 (기간 항목)
  score: text("score"),                       // 점수·등급·수상 결과 (예: 900점, 1급, 대상)
  description: text("description"),           // 역할·성과 설명
  url: text("url"),                           // 결과물·증빙 링크
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProfileItemSchema = createInsertSchema(profileItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProfileItem = z.infer<typeof insertProfileItemSchema>;
export type ProfileItem = typeof profileItemsTable.$inferSelect;
