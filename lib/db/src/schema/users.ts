import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  subscriptionStatus: text("subscription_status").notNull().default("free"),
  subscriptionPlanId: text("subscription_plan_id"),
  subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }),
  hasUnlimitedAnalyses: boolean("has_unlimited_analyses").notNull().default(false),
  organizationId: integer("organization_id"),
  analysesUsedThisMonth: integer("analyses_used_this_month").notNull().default(0),
  usageResetAt: timestamp("usage_reset_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
