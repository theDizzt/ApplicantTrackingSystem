import { bigint, index, integer, pgTable, primaryKey, smallint, text, timestamp } from "drizzle-orm/pg-core";

/**
 * AI 안내 문구 생성의 운영 지표만 저장한다.
 * 사용자/이력서 식별자나 생성 입력·출력 내용은 의도적으로 포함하지 않는다.
 */
export const guidedPromptGenerationBucketsTable = pgTable("guided_prompt_generation_buckets", {
  bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
  shard: smallint("shard").notNull(),
  generatedCount: integer("generated_count").notNull().default(0),
  fallbackCount: integer("fallback_count").notNull().default(0),
  authenticationCount: integer("authentication_count").notNull().default(0),
  rateLimitCount: integer("rate_limit_count").notNull().default(0),
  timeoutCount: integer("timeout_count").notNull().default(0),
  upstreamCount: integer("upstream_count").notNull().default(0),
  invalidResponseCount: integer("invalid_response_count").notNull().default(0),
  unknownCount: integer("unknown_count").notNull().default(0),
}, table => [primaryKey({ columns: [table.bucketStart, table.shard] })]);

/**
 * 버킷 방식으로 전환하는 동안 이전 버전 인스턴스가 기록한 지표를 함께 읽기 위해 유지한다.
 * 버킷 전환이 모든 환경에 배포되고 최대 집계 시간이 지난 뒤 별도로 제거할 수 있다.
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