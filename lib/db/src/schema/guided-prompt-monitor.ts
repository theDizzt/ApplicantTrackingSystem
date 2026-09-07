import { bigint, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * AI 안내 문구 생성의 운영 지표만 저장한다.
 * 사용자/이력서 식별자나 생성 입력·출력 내용은 의도적으로 포함하지 않는다.
 */
export const guidedPromptGenerationEventsTable = pgTable(
  "guided_prompt_generation_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    outcome: text("outcome").notNull(),
    failureType: text("failure_type"),
  },
  table => [index("guided_prompt_generation_events_occurred_at_idx").on(table.occurredAt)],
);

/** 인스턴스 간 중복 알림을 막기 위한 공유 쿨다운 상태. */
export const guidedPromptAlertStatesTable = pgTable("guided_prompt_alert_states", {
  reasonKey: text("reason_key").primaryKey(),
  lastAlertedAt: timestamp("last_alerted_at", { withTimezone: true }).notNull(),
});