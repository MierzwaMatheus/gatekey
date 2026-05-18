// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const storeImpersonationSession = internalMutation({
  args: {
    rootUserId: v.string(),
    targetUserId: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  returns: v.id("impersonation_sessions"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("impersonation_sessions", {
      rootUserId: args.rootUserId,
      targetUserId: args.targetUserId,
      tokenHash: args.tokenHash,
      createdAt: Date.now(),
      expiresAt: args.expiresAt,
    });
  },
});

export const endImpersonationSession = internalMutation({
  args: {
    impersonationSessionId: v.id("impersonation_sessions"),
  },
  returns: v.null(),
  handler: async (ctx, { impersonationSessionId }) => {
    const session = await ctx.db.get(impersonationSessionId);
    if (!session) throw new Error("impersonation_session_not_found");
    await ctx.db.patch(impersonationSessionId, { endedAt: Date.now() });
    return null;
  },
});

export const getImpersonationSessionByHash = internalQuery({
  args: { tokenHash: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("impersonation_sessions"),
      rootUserId: v.string(),
      targetUserId: v.string(),
      tokenHash: v.string(),
      createdAt: v.number(),
      expiresAt: v.number(),
      endedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, { tokenHash }) => {
    return await ctx.db
      .query("impersonation_sessions")
      .filter((q) => q.eq(q.field("tokenHash"), tokenHash))
      .first();
  },
});
