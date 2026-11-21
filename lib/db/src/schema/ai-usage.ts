import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Aggregate request counters only. Never store prompts, responses or credentials.
export const aiUsageBuckets = pgTable("ai_usage_buckets", {
  key: text("key").primaryKey(),
  used: integer("used").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("ai_usage_buckets_expiry_idx").on(table.expiresAt),
]);
