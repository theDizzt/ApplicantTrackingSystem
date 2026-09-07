import { integer, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const guidedPromptAlertOutboxTable = pgTable("guided_prompt_alert_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  payload: jsonb("payload").notNull(),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  leaseToken: uuid("lease_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GuidedPromptAlertOutboxItem = typeof guidedPromptAlertOutboxTable.$inferSelect;