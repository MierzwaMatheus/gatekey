// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

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
