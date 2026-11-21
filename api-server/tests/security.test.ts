import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import express from "express";
import { createServer } from "node:http";
import type { Request, Response } from "express";
import { and, eq, inArray, like } from "drizzle-orm";
import { aiUsageBuckets, comparisons, conversations, db, messages, pool, retryLeases } from "@workspace/db";
import { pool as storagePool } from "../src/db";
import { DatabaseStorage, storage } from "../src/storage";
import { registerRoutes } from "../src/routes/routes";
import { AiUsageLimitError, createAiUsageGuard, createUsageLimiter } from "../src/lib/ai-usage";

if (process.env.NODE_ENV === "production") {
  throw new Error("Database security fixture tests must only run in development.");
}

test("API authentication and browser protections cover every alias and path casing", async () => {
  const { createServer } = await import("node:http");
  const { default: app } = await import("../src/app");
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const health = await fetch(`${origin}/api/healthz`);
    assert.equal(health.status, 200);
    await health.arrayBuffer();
    for (const path of [
      "/api/conversations", "/API/conversations", "/api/hub/conversations",
      "/ai-hub-motion/api/hub/conversations",
    ]) {
      const response = await fetch(`${origin}${path}`);
      assert.equal(response.status, 401, path);
      assert.match(response.headers.get("cache-control") || "", /private, no-store/);
      assert.match(response.headers.get("vary") || "", /Cookie/);
      assert.equal(response.headers.get("access-control-allow-origin"), null);
      await response.arrayBuffer();
    }
    const crossSite = await fetch(`${origin}/API/conversations`, {
      method: "POST", headers: { Origin: "https://untrusted.example" }, body: "",
    });
    assert.equal(crossSite.status, 403);
    await crossSite.arrayBuffer();
    const oversized = await fetch(`${origin}/api/conversations`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ content: "x".repeat(70_000) }),
    });
    assert.equal(oversized.status, 413);
    assert.match((await oversized.json()).message, /64 KB/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

const run = `security-${randomUUID()}`;
const namespaces: string[] = [];
const conversationIds: string[] = [];
const comparisonIds: string[] = [];
const ownerA = `${run}-a`;
const ownerB = `${run}-b`;
const fixedTime = Math.floor(Date.now() / 3_600_000) * 3_600_000 + 5_000;

after(async () => {
  try {
    if (conversationIds.length) {
      await db.delete(messages).where(inArray(messages.conversationId, conversationIds));
      await db.delete(conversations).where(inArray(conversations.id, conversationIds));
    }
    if (comparisonIds.length) await db.delete(comparisons).where(inArray(comparisons.id, comparisonIds));
    for (const namespace of namespaces) {
      await db.delete(aiUsageBuckets).where(like(aiUsageBuckets.key, `${namespace}:%`));
    }
  } finally { await Promise.all([pool.end(), storagePool.end()]); }
});

function namespace() {
  const value = `${run}:${namespaces.length}`;
  namespaces.push(value);
  return value;
}

test("customer storage isolates conversations, messages and comparison history", async () => {
  const provider = (await storage.getAiProviders())[0];
  assert.ok(provider, "The existing development provider catalogue must be present");
  const a = await storage.createConversation({ providerId: provider.id, title: run }, ownerA);
  conversationIds.push(a.id);
  const b = await storage.createConversation({ providerId: provider.id, title: run }, ownerB);
  conversationIds.push(b.id);
  const [legacy] = await db.insert(conversations).values({ providerId: provider.id, title: run, ownerId: null }).returning();
  conversationIds.push(legacy.id);
  await storage.createMessage({ conversationId: a.id, role: "user", content: "isolated test fixture" }, ownerA);
  assert.deepEqual((await storage.getConversations(undefined, ownerA)).map(row => row.id), [a.id]);
  assert.equal(await storage.getConversation(a.id, ownerB), undefined);
  assert.equal(await storage.getConversation(legacy.id, ownerA), undefined);
  assert.equal(await storage.getMessages(a.id, ownerB), undefined);
  assert.equal(await storage.createMessage({ conversationId: a.id, role: "user", content: "denied fixture" }, ownerB), undefined);
  assert.equal(await storage.updateConversation(a.id, { title: "must not apply" }, ownerB), undefined);
  assert.equal(await storage.deleteConversation(a.id, ownerB), false);
  assert.equal((await storage.getMessages(a.id, ownerA))?.length, 1);
  const updated = await storage.updateConversation(a.id, { ownerId: ownerB, title: run }, ownerA);
  assert.equal(updated?.ownerId, ownerA, "Updating a record must not transfer ownership");
  const comparison = await storage.createComparison({ prompt: "isolated test fixture", responses: [] }, ownerA);
  comparisonIds.push(comparison.id);
  const [legacyComparison] = await db.insert(comparisons).values({ prompt: "isolated legacy fixture", responses: [], ownerId: null }).returning();
  comparisonIds.push(legacyComparison.id);
  assert.deepEqual((await storage.getComparisons(ownerA)).map(row => row.id), [comparison.id]);
  assert.deepEqual(await storage.getComparisons(ownerB), []);
});

test("missing or null owners never grant access to legacy data", async () => {
  await assert.rejects(storage.getConversations(undefined, null as never), /Authenticated owner/);
  await assert.rejects(storage.getComparisons(undefined as never), /Authenticated owner/);
  await assert.rejects(storage.createComparison({ prompt: "must not persist", responses: [] }, "" as never), /Authenticated owner/);
});

test("concurrent reservations share one database limit across limiter instances", async () => {
  const prefix = namespace();
  const options = { namespace: prefix, now: () => fixedTime, limits: { accountMinute: 3, accountHour: 20, workspaceHour: 30 } };
  const first = createUsageLimiter(options);
  const second = createUsageLimiter(options);
  const attempts = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => (index % 2 ? first : second)(ownerA)));
  assert.equal(attempts.filter(result => result.status === "fulfilled").length, 3);
  assert.ok(attempts.filter(result => result.status === "rejected").every(result => result.status === "rejected" && result.reason instanceof AiUsageLimitError));
  const rows = await db.select().from(aiUsageBuckets).where(like(aiUsageBuckets.key, `${prefix}:%`));
  assert.equal(rows.length, 3);
  assert.ok(rows.every(row => row.used === 3), "Denied requests must roll back all partially reserved buckets");
});

test("comparison units are weighted, and the next minute does not reset hourly limits", async () => {
  let time = fixedTime;
  const prefix = namespace();
  const reserve = createUsageLimiter({
    namespace: prefix, now: () => time,
    limits: { accountMinute: 6, accountHour: 8, workspaceHour: 30 },
  });
  await reserve(ownerA, 6);
  await assert.rejects(reserve(ownerA), AiUsageLimitError);
  time += 60_000;
  await reserve(ownerA, 2);
  await assert.rejects(reserve(ownerA), AiUsageLimitError);
  const accountHour = await db.select().from(aiUsageBuckets).where(and(
    like(aiUsageBuckets.key, `${prefix}:account-hour:%`),
    like(aiUsageBuckets.key, `%${ownerA}%`),
  ));
  assert.equal(accountHour[0].used, 8);
});

test("workspace limits cannot be bypassed with another account or process", async () => {
  const prefix = namespace();
  const limits = { accountMinute: 10, accountHour: 10, workspaceHour: 3 };
  const first = createUsageLimiter({ namespace: prefix, now: () => fixedTime, limits });
  await first(ownerA, 2);
  const anotherProcess = createUsageLimiter({ namespace: prefix, now: () => fixedTime, limits });
  await anotherProcess(ownerB);
  await assert.rejects(anotherProcess(ownerB), error => error instanceof AiUsageLimitError && error.scope === "workspace");
});

test("new windows reset counters and invalid usage cannot be recorded", async () => {
  let time = fixedTime;
  const reserve = createUsageLimiter({
    namespace: namespace(), now: () => time,
    limits: { accountMinute: 1, accountHour: 1, workspaceHour: 1 },
  });
  await reserve(ownerA);
  await assert.rejects(reserve(ownerA), AiUsageLimitError);
  time += 3_600_000;
  await reserve(ownerA);
  await assert.rejects(reserve(ownerA, 0), /positive/);
  await assert.rejects(reserve("", 1), /Authenticated owner/);
});

test("retry leases are shared across storage instances and reclaim after expiry", async () => {
  const provider = (await storage.getAiProviders())[0];
  assert.ok(provider);
  const conversation = await storage.createConversation({ providerId: provider.id, title: run }, ownerA);
  conversationIds.push(conversation.id);
  const userMessage = await storage.createMessage({
    conversationId: conversation.id,
    role: "user",
    content: "stale retry lease fixture",
  }, ownerA);
  assert.ok(userMessage);
  const secondInstance = new DatabaseStorage();

  const firstToken = await storage.claimRetryLease(conversation.id, userMessage.id, ownerA);
  assert.ok(firstToken);
  assert.equal(await secondInstance.claimRetryLease(conversation.id, userMessage.id, ownerA), undefined);
  assert.equal(await secondInstance.claimRetryLease(conversation.id, userMessage.id, ownerB), undefined);

  await db.update(retryLeases).set({ expiresAt: new Date(Date.now() - 1_000) }).where(
    and(
      eq(retryLeases.ownerId, ownerA),
      eq(retryLeases.conversationId, conversation.id),
      eq(retryLeases.messageId, userMessage.id),
    ),
  );
  const recoveredToken = await secondInstance.claimRetryLease(conversation.id, userMessage.id, ownerA);
  assert.ok(recoveredToken);
  assert.notEqual(recoveredToken, firstToken);
  await secondInstance.releaseRetryLease(conversation.id, userMessage.id, ownerA, recoveredToken);
});

test("two API instances accept only one concurrent retry and one controlled provider attempt", async () => {
  const provider = (await storage.getAiProviders())[0];
  assert.ok(provider);
  const conversation = await storage.createConversation({ providerId: provider.id, title: run }, ownerA);
  conversationIds.push(conversation.id);
  const userMessage = await storage.createMessage({
    conversationId: conversation.id,
    role: "user",
    content: "concurrent retry fixture",
  }, ownerA);
  assert.ok(userMessage);

  let releaseProvider!: () => void;
  let providerStarted!: () => void;
  const providerGate = new Promise<void>((resolve) => { releaseProvider = resolve; });
  const started = new Promise<void>((resolve) => { providerStarted = resolve; });
  let providerCalls = 0;
  const startApiInstance = () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      res.locals.hubUserId = req.get("x-test-owner") || "";
      next();
    });
    registerRoutes(app, "/api", {
      storage: new DatabaseStorage(),
      allowUsage: async () => true,
      providerConfigurationError: () => undefined,
      generateReply: async (_selectedProvider, prompt) => {
        providerCalls += 1;
        providerStarted();
        await providerGate;
        return `Controlled response: ${prompt}`;
      },
    });
    return createServer(app);
  };

  const firstServer = startApiInstance();
  const secondServer = startApiInstance();
  await Promise.all([firstServer, secondServer].map((server) =>
    new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)),
  ));
  const firstAddress = firstServer.address();
  const secondAddress = secondServer.address();
  assert.ok(firstAddress && typeof firstAddress !== "string");
  assert.ok(secondAddress && typeof secondAddress !== "string");
  const urlFor = (port: number) => `http://127.0.0.1:${port}/api/conversations/${conversation.id}/messages`;
  const body = JSON.stringify({ retryMessageId: userMessage.id });
  const request = (port: number, owner = ownerA) => fetch(urlFor(port), {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-owner": owner },
    body,
  });

  try {
    const denied = await request(firstAddress.port, ownerB);
    assert.equal(denied.status, 404);
    await denied.arrayBuffer();
    assert.equal(providerCalls, 0, "another account cannot start a provider attempt");

    const concurrent = Promise.all([
      request(firstAddress.port),
      request(secondAddress.port),
    ]);
    await started;
    assert.equal(providerCalls, 1);
    releaseProvider();
    const responses = await concurrent;
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    const payloads = await Promise.all(responses.map((response) => response.json()));
    assert.ok(payloads.some((payload) => (payload as { message?: string }).message?.includes("already in progress")));
    assert.equal(providerCalls, 1);

    const savedMessages = await storage.getMessages(conversation.id, ownerA);
    assert.equal(savedMessages?.filter((message) => message.role === "user").length, 1);
    assert.equal(savedMessages?.filter((message) => message.role === "assistant").length, 1);
    assert.equal(savedMessages?.find((message) => message.role === "assistant")?.replyToMessageId, userMessage.id);
  } finally {
    releaseProvider();
    for (const server of [firstServer, secondServer]) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }
});

function response() {
  const value = { locals: { hubUserId: ownerA }, statusCode: 200, body: null as unknown, headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    setHeader(name: string, text: string) { this.headers[name] = text; return this; },
  };
  return value;
}

test("HTTP usage guard fails closed, with Retry-After and no internal error details", async () => {
  const req = { log: { error() {} } } as unknown as Request;
  const limited = response();
  const limitedGuard = createAiUsageGuard(async () => { throw new AiUsageLimitError("account", 42); });
  assert.equal(await limitedGuard(req, limited as unknown as Response), false);
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers["Retry-After"], "42");
  const unavailable = response();
  const brokenGuard = createAiUsageGuard(async () => { throw new Error("internal database diagnostics must not be returned"); });
  assert.equal(await brokenGuard(req, unavailable as unknown as Response), false);
  assert.equal(unavailable.statusCode, 503);
  assert.ok(!JSON.stringify(unavailable.body).includes("diagnostics"));
  const unauthenticated = response();
  unauthenticated.locals.hubUserId = "";
  let called = false;
  const guarded = createAiUsageGuard(async () => { called = true; });
  assert.equal(await guarded(req, unauthenticated as unknown as Response), false);
  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(called, false);
});
