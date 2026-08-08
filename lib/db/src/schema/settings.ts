import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// 전역 앱 설정 (key-value). 예: AI 공급자 설정 (api key, base url, model)
export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
