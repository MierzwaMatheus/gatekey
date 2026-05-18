// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export function getRateLimitKey(endpoint: string, identifier: string): string {
  return `rl:${endpoint}:${identifier}`;
}

export const checkRateLimit = internalMutation({
  args: {
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  returns: v.union(
    v.object({ allowed: v.literal(true), remaining: v.number() }),
    v.object({ allowed: v.literal(false), retryAfterMs: v.number() }),
  ),
  handler: async (ctx, { key, limit, windowMs }) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("rate_limit_counters")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (!existing || now - existing.windowStart >= windowMs) {
      if (existing) {
        await ctx.db.patch(existing._id, { count: 1, windowStart: now, windowMs });
      } else {
        await ctx.db.insert("rate_limit_counters", { key, count: 1, windowStart: now, windowMs });
      }
      return { allowed: true as const, remaining: limit - 1 };
    }

    if (existing.count >= limit) {
      const retryAfterMs = existing.windowStart + windowMs - now;
      return { allowed: false as const, retryAfterMs };
    }

    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return { allowed: true as const, remaining: limit - existing.count - 1 };
  },
});

export const checkOrgRateLimit = internalMutation({
  args: {
    orgId: v.id("orgs"),
    endpoint: v.string(),
    defaultLimit: v.number(),
    windowMs: v.number(),
  },
  returns: v.union(
    v.object({ allowed: v.literal(true) }),
    v.object({ allowed: v.literal(false), retryAfterMs: v.number() }),
  ),
  handler: async (ctx, { orgId, endpoint, defaultLimit, windowMs }) => {
    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();

    const rateLimits = settings?.rateLimits as Record<string, number | undefined> | undefined;
    const customLimit = rateLimits?.[endpoint + "PerMin"];
    const limit = customLimit ?? defaultLimit;

    const key = getRateLimitKey(endpoint, orgId as string);
    const now = Date.now();

    const existing = await ctx.db
      .query("rate_limit_counters")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (!existing || now - existing.windowStart >= windowMs) {
      if (existing) {
        await ctx.db.patch(existing._id, { count: 1, windowStart: now, windowMs });
      } else {
        await ctx.db.insert("rate_limit_counters", { key, count: 1, windowStart: now, windowMs });
      }
      return { allowed: true as const };
    }

    if (existing.count >= limit) {
      const retryAfterMs = existing.windowStart + windowMs - now;
      await ctx.db.insert("audit_log", {
        timestamp: now,
        actorType: "system" as const,
        actorId: orgId as string,
        action: "ratelimit.exceeded",
        target: { type: endpoint, id: orgId as string },
        orgId,
        result: "deny" as const,
        reason: `rate_limit_exceeded:${endpoint}`,
      });
      return { allowed: false as const, retryAfterMs };
    }

    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return { allowed: true as const };
  },
});
