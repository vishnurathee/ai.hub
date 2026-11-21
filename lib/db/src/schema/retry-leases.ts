import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { conversations, messages } from "./schema";

export const retryLeases = pgTable("retry_leases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: text("owner_id").notNull(),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  leaseToken: varchar("lease_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  uniqueIndex("retry_leases_owner_conversation_message_unique")
    .on(table.ownerId, table.conversationId, table.messageId),
  index("retry_leases_expires_at_idx").on(table.expiresAt),
]);
