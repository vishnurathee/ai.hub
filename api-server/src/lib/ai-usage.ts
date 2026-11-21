import type { Request, Response } from "express";
import { aiUsageBuckets, db } from "@workspace/db";
import { and, like, lt, sql } from "drizzle-orm";

export { MAX_PROMPT_CHARS, MAX_COMPARISON_PROVIDERS } from "@workspace/api-zod/input-limits";

export type UsageLimits = {
  accountMinute: number;
  accountHour: number;
  workspaceHour: number;
};

export const AI_USAGE_LIMITS: Readonly<UsageLimits> = Object.freeze({
  accountMinute: 8,
  accountHour: 40,
  workspaceHour: 200,
});

export class AiUsageLimitError extends Error {
  constructor(
    public readonly scope: "account" | "workspace",
    public readonly retryAfterSeconds: number,
    label = "AI request",
  ) {
    super(`${scope === "account" ? "Account" : "Workspace"} ${label} limit reached. Try again after ${retryAfterSeconds} seconds.`);
  }
}

/** Atomic, shared across instances and restarts. Rejected reservations roll back. */
export function createUsageLimiter({
  now = Date.now,
  namespace = "ai-hub",
  limits = AI_USAGE_LIMITS,
  label = "AI request",
}: {
  now?: () => number;
  namespace?: string;
  limits?: UsageLimits;
  label?: string;
} = {}) {
  const policy = Object.freeze({ ...limits });
  if (!/^[a-z0-9:-]+$/i.test(namespace)) throw new Error("Invalid AI usage namespace");
  if (Object.values(policy).some(limit => !Number.isSafeInteger(limit) || limit < 1)) {
    throw new Error("AI usage limits must be positive integers");
  }

  return async function reserve(ownerId: string, units = 1) {
    if (typeof ownerId !== "string" || !ownerId) throw new Error("Authenticated owner is required");
    if (!Number.isSafeInteger(units) || units < 1) throw new Error("AI usage units must be positive");
    const time = now();
    const minuteEnd = (Math.floor(time / 60_000) + 1) * 60_000;
    const hourEnd = (Math.floor(time / 3_600_000) + 1) * 3_600_000;
    // Stable lock order prevents competing requests from deadlocking.
    const buckets = [
      { scope: "workspace", key: `${namespace}:workspace:${hourEnd}`, limit: policy.workspaceHour, end: hourEnd },
      { scope: "account", key: `${namespace}:account-hour:${ownerId}:${hourEnd}`, limit: policy.accountHour, end: hourEnd },
      { scope: "account", key: `${namespace}:account-minute:${ownerId}:${minuteEnd}`, limit: policy.accountMinute, end: minuteEnd },
    ] as const;

    await db.transaction(async tx => {
      for (const bucket of buckets) {
        const denied = () => new AiUsageLimitError(
          bucket.scope, Math.max(1, Math.ceil((bucket.end - time) / 1_000)), label,
        );
        if (units > bucket.limit) throw denied();
        const updated = await tx.insert(aiUsageBuckets).values({
          key: bucket.key, used: units, expiresAt: new Date(bucket.end),
        }).onConflictDoUpdate({
          target: aiUsageBuckets.key,
          set: { used: sql`${aiUsageBuckets.used} + ${units}` },
          setWhere: sql`${aiUsageBuckets.used} + ${units} <= ${bucket.limit}`,
        }).returning({ used: aiUsageBuckets.used });
        if (!updated.length) throw denied();
      }
      // Counters are not an account-history ledger; expire them opportunistically.
      await tx.delete(aiUsageBuckets).where(and(
        like(aiUsageBuckets.key, `${namespace}:%`),
        lt(aiUsageBuckets.expiresAt, new Date(time)),
      ));
    });
  };
}

export const reserveAiUsage = createUsageLimiter();

export function createAiUsageGuard(reserve = reserveAiUsage, label = "AI usage") {
  return async (req: Request, res: Response, units = 1): Promise<boolean> => {
    const ownerId = res.locals.hubUserId;
    if (typeof ownerId !== "string" || !ownerId) {
      res.status(401).json({ message: "Unauthorized" });
      return false;
    }
    try {
      await reserve(ownerId, units);
      return true;
    } catch (error) {
      if (error instanceof AiUsageLimitError) {
        res.setHeader("Retry-After", String(error.retryAfterSeconds));
        res.status(429).json({ message: error.message, retryAfterSeconds: error.retryAfterSeconds });
      } else {
        req.log.error({ check: label }, "Usage check failed; request blocked");
        res.status(503).json({ message: `${label} checks are temporarily unavailable. Please try again later.` });
      }
      return false;
    }
  };
}

export const allowAiUsage = createAiUsageGuard();

// Metadata writes have their own budget and cannot consume paid-provider units.
export const allowWorkspaceWrite = createAiUsageGuard(createUsageLimiter({
  namespace: "hub-writes",
  label: "workspace write",
  limits: { accountMinute: 30, accountHour: 300, workspaceHour: 3_000 },
}), "Workspace request");
