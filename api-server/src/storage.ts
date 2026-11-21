import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  aiProviders,
  comparisons,
  conversations,
  messages,
  retryLeases,
  type AiProvider,
  type Comparison,
  type Conversation,
  type InsertAiProvider,
  type InsertComparison,
  type InsertConversation,
  type InsertMessage,
  type Message,
} from "@workspace/db";

export interface IStorage {
  getAiProviders(): Promise<AiProvider[]>;
  getAiProvider(id: string): Promise<AiProvider | undefined>;
  createAiProvider(provider: InsertAiProvider): Promise<AiProvider>;
  updateAiProvider(id: string, updates: Partial<AiProvider>): Promise<AiProvider | undefined>;

  getConversations(providerId: string | undefined, ownerId: string): Promise<Conversation[]>;
  getConversation(id: string, ownerId: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation, ownerId: string): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>, ownerId: string): Promise<Conversation | undefined>;
  deleteConversation(id: string, ownerId: string): Promise<boolean>;

  getMessages(conversationId: string, ownerId: string): Promise<Message[] | undefined>;
  createMessage(message: InsertMessage, ownerId: string): Promise<Message | undefined>;
  createAssistantReply(
    conversationId: string,
    userMessageId: string,
    content: string,
    responseTime: string,
    ownerId: string,
  ): Promise<Message | undefined>;
  claimRetryLease(conversationId: string, messageId: string, ownerId: string): Promise<string | undefined>;
  renewRetryLease(conversationId: string, messageId: string, ownerId: string, token: string): Promise<boolean>;
  releaseRetryLease(conversationId: string, messageId: string, ownerId: string, token: string): Promise<void>;

  getComparisons(ownerId: string): Promise<Comparison[]>;
  createComparison(comparison: InsertComparison, ownerId: string): Promise<Comparison>;
}

function requireOwner(ownerId: string): string {
  if (typeof ownerId !== "string" || !ownerId) throw new Error("Authenticated owner is required");
  return ownerId;
}

function ownerFilter(ownerId: string) {
  return eq(conversations.ownerId, requireOwner(ownerId));
}

function withRuntimeKeyStatus(provider: AiProvider): AiProvider {
  const configured = (() => {
    switch (provider.name) {
      case "chatgpt":
        return Boolean(process.env.OPENAI_API_KEY);
      case "claude":
        return Boolean(process.env.ANTHROPIC_API_KEY);
      case "groq":
        return Boolean(process.env.GROQ_API_KEY || process.env.GROK_API_KEY);
      case "perplexity":
        return Boolean(process.env.PERPLEXITY_API_KEY);
      case "gemini":
      case "grok":
        return Boolean(process.env.GEMINI_API_KEY);
      default:
        return false;
    }
  })();

  return {
    ...provider,
    apiKeySet: configured,
    isActive: configured,
    description: provider.name === "perplexity"
      ? "Perplexity Sonar · live web search"
      : provider.description,
  };
}

const defaultProviders: InsertAiProvider[] = [
  {
    name: "chatgpt",
    displayName: "ChatGPT",
    icon: "fas fa-robot",
    color: "bg-green-500",
    description: "OpenAI GPT-4",
    isActive: !!process.env.OPENAI_API_KEY,
    apiKeySet: !!process.env.OPENAI_API_KEY,
  },
  {
    name: "claude",
    displayName: "Claude",
    icon: "fas fa-brain",
    color: "bg-orange-500",
    description: "Anthropic",
    isActive: !!process.env.ANTHROPIC_API_KEY,
    apiKeySet: !!process.env.ANTHROPIC_API_KEY,
  },
  {
    name: "gemini",
    displayName: "Gemini",
    icon: "fas fa-star",
    color: "bg-blue-500",
    description: "Google AI · Free tier",
    isActive: !!process.env.GEMINI_API_KEY,
    apiKeySet: !!process.env.GEMINI_API_KEY,
  },
  {
    name: "grok",
    displayName: "Grok",
    icon: "fas fa-bolt",
    color: "bg-slate-700",
    description: "Preview · powered by Gemini",
    isActive: !!process.env.GEMINI_API_KEY,
    apiKeySet: !!process.env.GEMINI_API_KEY,
  },
  {
    name: "perplexity",
    displayName: "Perplexity",
    icon: "fas fa-search",
    color: "bg-purple-500",
    description: "Perplexity Sonar · live web search",
    isActive: !!process.env.PERPLEXITY_API_KEY,
    apiKeySet: !!process.env.PERPLEXITY_API_KEY,
  },
  {
    name: "groq",
    displayName: "Groq",
    icon: "fas fa-bolt",
    color: "bg-orange-500",
    description: "GPT OSS 20B · Free plan limits apply",
    isActive: !!(process.env.GROQ_API_KEY || process.env.GROK_API_KEY),
    apiKeySet: !!(process.env.GROQ_API_KEY || process.env.GROK_API_KEY),
  },
];

export class DatabaseStorage implements IStorage {
  private providerSeedPromise: Promise<void> | null = null;

  private async ensureProviders() {
    const existing = await db.select({ name: aiProviders.name }).from(aiProviders);
    if (defaultProviders.every(provider => existing.some(row => row.name === provider.name))) return;

    if (!this.providerSeedPromise) {
      this.providerSeedPromise = (async () => {
        const afterCheck = await db.select({ name: aiProviders.name }).from(aiProviders);
        const missing = defaultProviders.filter(provider => !afterCheck.some(row => row.name === provider.name));
        if (missing.length > 0) {
          await db.insert(aiProviders).values(missing);
        }
      })().finally(() => {
        this.providerSeedPromise = null;
      });
    }

    await this.providerSeedPromise;
  }

  async getAiProviders(): Promise<AiProvider[]> {
    await this.ensureProviders();
    const providers = await db.select().from(aiProviders);
    return providers
      .map(withRuntimeKeyStatus)
      .sort((a, b) => {
        const position = (name: string) => {
          const index = defaultProviders.findIndex(provider => provider.name === name);
          return index === -1 ? defaultProviders.length : index;
        };
        return position(a.name) - position(b.name);
      });
  }

  async getAiProvider(id: string): Promise<AiProvider | undefined> {
    await this.ensureProviders();
    const [provider] = await db.select().from(aiProviders).where(eq(aiProviders.id, id)).limit(1);
    return provider && withRuntimeKeyStatus(provider);
  }

  async createAiProvider(provider: InsertAiProvider): Promise<AiProvider> {
    const [created] = await db.insert(aiProviders).values(provider).returning();
    return created;
  }

  async updateAiProvider(id: string, updates: Partial<AiProvider>): Promise<AiProvider | undefined> {
    const [updated] = await db
      .update(aiProviders)
      .set({
        name: updates.name,
        displayName: updates.displayName,
        icon: updates.icon,
        color: updates.color,
        description: updates.description,
        isActive: updates.isActive,
        apiKeySet: updates.apiKeySet,
      })
      .where(eq(aiProviders.id, id))
      .returning();
    return updated;
  }

  async getConversations(providerId: string | undefined, ownerId: string): Promise<Conversation[]> {
    if (providerId) {
      return db
        .select()
        .from(conversations)
        .where(and(ownerFilter(ownerId), eq(conversations.providerId, providerId)))
        .orderBy(desc(conversations.isPinned), desc(conversations.updatedAt));
    }

    return db
      .select()
      .from(conversations)
      .where(ownerFilter(ownerId))
      .orderBy(desc(conversations.isPinned), desc(conversations.updatedAt));
  }

  async getConversation(id: string, ownerId: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), ownerFilter(ownerId)))
      .limit(1);
    return conversation;
  }

  async createConversation(conversation: InsertConversation, ownerId: string): Promise<Conversation> {
    const [created] = await db.insert(conversations).values({ ...conversation, ownerId: requireOwner(ownerId) }).returning();
    return created;
  }

  async updateConversation(id: string, updates: Partial<Conversation>, ownerId: string): Promise<Conversation | undefined> {
    const [updated] = await db
      .update(conversations)
      .set({
        providerId: updates.providerId,
        title: updates.title,
        isPinned: updates.isPinned,
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, id), ownerFilter(ownerId)))
      .returning();
    return updated;
  }

  async deleteConversation(id: string, ownerId: string): Promise<boolean> {
    const conversation = await this.getConversation(id, ownerId);
    if (!conversation) return false;

    await db.delete(messages).where(eq(messages.conversationId, id));
    const deleted = await db
      .delete(conversations)
      .where(and(eq(conversations.id, id), ownerFilter(ownerId)))
      .returning({ id: conversations.id });
    return deleted.length > 0;
  }

  async getMessages(conversationId: string, ownerId: string): Promise<Message[] | undefined> {
    const conversation = await this.getConversation(conversationId, ownerId);
    if (!conversation) return undefined;

    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.timestamp);
  }

  async createMessage(message: InsertMessage, ownerId: string): Promise<Message | undefined> {
    if (!message.conversationId || !await this.getConversation(message.conversationId, ownerId)) {
      return undefined;
    }

    const [created] = await db.insert(messages).values(message).returning();
    if (message.conversationId) {
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(and(eq(conversations.id, message.conversationId), ownerFilter(ownerId)));
    }
    return created;
  }

  async createAssistantReply(
    conversationId: string,
    userMessageId: string,
    content: string,
    responseTime: string,
    ownerId: string,
  ): Promise<Message | undefined> {
    const threadMessages = await this.getMessages(conversationId, ownerId);
    const latest = threadMessages?.at(-1);
    if (!latest || latest.id !== userMessageId || latest.role !== "user") return undefined;

    const [created] = await db.insert(messages).values({
      conversationId,
      role: "assistant",
      content,
      responseTime,
      replyToMessageId: userMessageId,
    }).onConflictDoNothing({ target: messages.replyToMessageId }).returning();

    const [reply] = created
      ? [created]
      : await db.select().from(messages).where(eq(messages.replyToMessageId, userMessageId)).limit(1);

    if (reply) {
      await db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(and(eq(conversations.id, conversationId), ownerFilter(ownerId)));
    }
    return reply;
  }

  async claimRetryLease(conversationId: string, messageId: string, ownerId: string): Promise<string | undefined> {
    const threadMessages = await this.getMessages(conversationId, ownerId);
    const latest = threadMessages?.at(-1);
    if (!latest || latest.id !== messageId || latest.role !== "user") return undefined;

    const token = randomUUID();
    const [lease] = await db.insert(retryLeases).values({
      ownerId: requireOwner(ownerId),
      conversationId,
      messageId,
      leaseToken: token,
      expiresAt: sql`now() + interval '2 minutes'`,
    }).onConflictDoUpdate({
      target: [retryLeases.ownerId, retryLeases.conversationId, retryLeases.messageId],
      set: {
        leaseToken: token,
        expiresAt: sql`now() + interval '2 minutes'`,
      },
      setWhere: lte(retryLeases.expiresAt, sql`now()`),
    }).returning({ leaseToken: retryLeases.leaseToken });
    return lease?.leaseToken;
  }

  async renewRetryLease(conversationId: string, messageId: string, ownerId: string, token: string): Promise<boolean> {
    const renewed = await db.update(retryLeases).set({
      expiresAt: sql`now() + interval '2 minutes'`,
    }).where(and(
      eq(retryLeases.ownerId, requireOwner(ownerId)),
      eq(retryLeases.conversationId, conversationId),
      eq(retryLeases.messageId, messageId),
      eq(retryLeases.leaseToken, token),
      gt(retryLeases.expiresAt, sql`now()`),
    )).returning({ id: retryLeases.id });
    return renewed.length > 0;
  }

  async releaseRetryLease(conversationId: string, messageId: string, ownerId: string, token: string): Promise<void> {
    await db.delete(retryLeases).where(and(
      eq(retryLeases.ownerId, requireOwner(ownerId)),
      eq(retryLeases.conversationId, conversationId),
      eq(retryLeases.messageId, messageId),
      eq(retryLeases.leaseToken, token),
    ));
  }

  async getComparisons(ownerId: string): Promise<Comparison[]> {
    const comparisonOwnerFilter = eq(comparisons.ownerId, requireOwner(ownerId));
    return db.select().from(comparisons).where(comparisonOwnerFilter).orderBy(desc(comparisons.createdAt));
  }

  async createComparison(comparison: InsertComparison, ownerId: string): Promise<Comparison> {
    const [created] = await db.insert(comparisons).values({ ...comparison, ownerId: requireOwner(ownerId) }).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();