// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const upsertPendingMfaConfig = internalMutation({
  args: {
    userId: v.id("users"),
    pendingSecret: v.string(),
    pendingSecretExpiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { userId, pendingSecret, pendingSecretExpiresAt }) => {
    const existing = await ctx.db
      .query("mfa_configs")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { pendingSecret, pendingSecretExpiresAt });
    } else {
      await ctx.db.insert("mfa_configs", {
        userId,
        backupCodes: [],
        pendingSecret,
        pendingSecretExpiresAt,
      });
    }
    return null;
  },
});

export const activateMfaConfig = internalMutation({
  args: {
    userId: v.id("users"),
    secret: v.string(),
    backupCodes: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { userId, secret, backupCodes }) => {
    const existing = await ctx.db
      .query("mfa_configs")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const data = {
      secret,
      backupCodes,
      activatedAt: Date.now(),
      pendingSecret: undefined,
      pendingSecretExpiresAt: undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("mfa_configs", { userId, ...data });
    }
    return null;
  },
});

export const getActiveMfaConfig = internalQuery({
  args: { userId: v.id("users") },
  returns: v.any(),
  handler: async (ctx, { userId }) => {
    const config = await ctx.db
      .query("mfa_configs")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!config || !config.activatedAt) return null;
    return config;
  },
});

export const getAnyMfaConfig = internalQuery({
  args: { userId: v.id("users") },
  returns: v.any(),
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("mfa_configs")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
  },
});

export const invalidateBackupCode = internalMutation({
  args: { userId: v.id("users"), code: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, code }) => {
    const config = await ctx.db
      .query("mfa_configs")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!config) return null;
    await ctx.db.patch(config._id, {
      backupCodes: config.backupCodes.filter((c) => c !== code),
    });
    return null;
  },
});
