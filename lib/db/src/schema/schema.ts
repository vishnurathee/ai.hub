import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiProviders = pgTable("ai_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").default(false),
  apiKeySet: boolean("api_key_set").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: text("owner_id"),
  providerId: varchar("provider_id").references(() => aiProviders.id),
  title: text("title").notNull().default("New Conversation"),
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  role: text("role").notNull(), // "user" or "assistant"
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").default(sql`now()`),
  responseTime: text("response_time"), // Duration in ms for AI responses
  replyToMessageId: varchar("reply_to_message_id").references((): AnyPgColumn => messages.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("messages_reply_to_message_unique").on(table.replyToMessageId),
]);

export const comparisons = pgTable("comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: text("owner_id"),
  prompt: text("prompt").notNull(),
  responses: jsonb("responses").notNull(), // Array of {providerId, response, responseTime}
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertAiProviderSchema = createInsertSchema(aiProviders).pick({
  name: true,
  displayName: true,
  icon: true,
  color: true,
  description: true,
  isActive: true,
  apiKeySet: true,
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  providerId: true,
  title: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  role: true,
  content: true,
  responseTime: true,
});

export const insertComparisonSchema = createInsertSchema(comparisons).pick({
  prompt: true,
  responses: true,
});

export type InsertAiProvider = z.infer<typeof insertAiProviderSchema>;
export type AiProvider = typeof aiProviders.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertComparison = z.infer<typeof insertComparisonSchema>;
export type Comparison = typeof comparisons.$inferSelect;
