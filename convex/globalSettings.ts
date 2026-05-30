// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_CHECK_PER_MIN = 100;
const DEFAULT_CHECK_BATCH_PER_MIN = 20;

export const getGlobalRateLimits = internalQuery({
  args: {},
  returns: v.object({ checkPerMin: v.number(), checkBatchPerMin: v.number() }),
  handler: async (ctx) => {
    const settings = await ctx.db.query("global_settings").first();
    return {
      checkPerMin: settings?.checkRateLimitPerMin ?? DEFAULT_CHECK_PER_MIN,
      checkBatchPerMin: settings?.checkBatchRateLimitPerMin ?? DEFAULT_CHECK_BATCH_PER_MIN,
    };
  },
});

export const updateGlobalRateLimits = internalMutation({
  args: {
    checkPerMin: v.optional(v.number()),
    checkBatchPerMin: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { checkPerMin, checkBatchPerMin }) => {
    const existing = await ctx.db.query("global_settings").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        checkRateLimitPerMin: checkPerMin ?? existing.checkRateLimitPerMin,
        checkBatchRateLimitPerMin: checkBatchPerMin ?? existing.checkBatchRateLimitPerMin,
      });
    } else {
      await ctx.db.insert("global_settings", {
        checkRateLimitPerMin: checkPerMin ?? DEFAULT_CHECK_PER_MIN,
        checkBatchRateLimitPerMin: checkBatchPerMin ?? DEFAULT_CHECK_BATCH_PER_MIN,
      });
    }
    return null;
  },
});
