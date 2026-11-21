import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createHubDataClient } from "../src/lib/queryClient";

test("each artifact keeps its own immutable API namespace", () => {
  const root = createHubDataClient("/api/hub");
  const motion = createHubDataClient("/ai-hub-motion/api/hub/");
  assert.equal(root.apiUrl("/api/providers"), "/api/hub/providers");
  assert.equal(motion.apiUrl("/api/providers"), "/ai-hub-motion/api/hub/providers");
  assert.equal(root.apiUrl("/api/providers"), "/api/hub/providers");
  assert.equal(motion.apiUrl("/api/hub/conversations?providerId=a%20b"),
    "/ai-hub-motion/api/hub/conversations?providerId=a%20b");
  assert.equal(root.apiUrl("/api/hub/providers"), "/api/hub/providers");
  assert.equal(motion.apiUrl("/ai-hub-motion/api/hub/providers"),
    "/ai-hub-motion/api/hub/providers");
});

test("query caches do not leak across artifacts or identities", () => {
  const adapter = createHubDataClient("/api/hub");
  const firstIdentity = adapter.createQueryClient();
  const secondIdentity = adapter.createQueryClient();
  const otherArtifact = createHubDataClient("/ai-hub-motion/api/hub").createQueryClient();
  firstIdentity.setQueryData(["/api/conversations"], ["first-identity-only"]);
  assert.equal(secondIdentity.getQueryData(["/api/conversations"]), undefined);
  assert.equal(otherArtifact.getQueryData(["/api/conversations"]), undefined);
  assert.equal(firstIdentity.getDefaultOptions().queries?.retry, false);
  firstIdentity.clear();
  secondIdentity.clear();
  otherArtifact.clear();
});

test("mutations retain cookie credentials, JSON bodies and their artifact route", async () => {
  const originalFetch = globalThis.fetch;
  const seen: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    seen.push({ url: String(input), init });
    return new Response('{"ok":true}', { status: 200 });
  };
  try {
    await createHubDataClient("/api/hub").apiRequest("POST", "/api/conversations", { title: "one" });
    await createHubDataClient("/ai-hub-motion/api/hub").apiRequest("PATCH", "/api/conversations/test", { isPinned: true });
    assert.equal(seen[0].url, "/api/hub/conversations");
    assert.equal(seen[1].url, "/ai-hub-motion/api/hub/conversations/test");
    assert.equal(seen[0].init?.credentials, "include");
    assert.equal(seen[1].init?.credentials, "include");
    assert.deepEqual(JSON.parse(String(seen[1].init?.body)), { isPinned: true });
    assert.deepEqual(seen[0].init?.headers, { "Content-Type": "application/json" });
  } finally { globalThis.fetch = originalFetch; }
});

test("default queries preserve the artifact prefix and reject unauthorized reads", async () => {
  const originalFetch = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = async (input) => {
    seen.push(String(input));
    return new Response('{"error":"Unauthorized"}', { status: 401 });
  };
  const client = createHubDataClient("/ai-hub-motion/api/hub").createQueryClient();
  try {
    await assert.rejects(client.fetchQuery({ queryKey: ["/api/conversations"] }), /401/);
    assert.deepEqual(seen, ["/ai-hub-motion/api/hub/conversations"]);
  } finally { globalThis.fetch = originalFetch; client.clear(); }
});

test("explicit anonymous queries retain the optional null-on-401 behavior", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Unauthorized", { status: 401 });
  const adapter = createHubDataClient("/api/hub");
  const client = adapter.createQueryClient();
  try {
    const queryFn = adapter.getQueryFn({ on401: "returnNull" });
    const result = await queryFn({
      queryKey: ["/api/providers"], client,
      signal: new AbortController().signal, meta: undefined,
    });
    assert.equal(result, null);
  } finally { globalThis.fetch = originalFetch; client.clear(); }
});

test("mutation error text is not hidden by the shared adapter", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Owner mismatch", { status: 403 });
  try {
    await assert.rejects(
      createHubDataClient("/api/hub").apiRequest("DELETE", "/api/conversations/not-owned"),
      /403: Owner mismatch/,
    );
  } finally { globalThis.fetch = originalFetch; }
});
