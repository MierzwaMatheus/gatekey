import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getActiveKeyPair = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    return await ctx.db
      .query("key_pairs")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "active"))
      .order("desc")
      .first();
  },
});

export const getAllActivePublicKeys = internalQuery({
  args: {},
  returns: v.array(v.object({ kid: v.string(), publicKeyJwk: v.string() })),
  handler: async (ctx) => {
    const keys = await ctx.db
      .query("key_pairs")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "active"))
      .take(10);
    return keys.map((k) => ({ kid: k.kid, publicKeyJwk: k.publicKeyJwk }));
  },
});

export const storeKeyPair = internalMutation({
  args: {
    kid: v.string(),
    privateKeyJwk: v.string(),
    publicKeyJwk: v.string(),
    createdAt: v.number(),
  },
  returns: v.id("key_pairs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("key_pairs", { ...args, status: "active" });
  },
});

export const getOrgJwtExpiry = internalQuery({
  args: { orgId: v.id("orgs") },
  returns: v.union(
    v.null(),
    v.object({
      jwtExpiryAccess: v.number(),
      jwtExpiryRefresh: v.number(),
    }),
  ),
  handler: async (ctx, { orgId }) => {
    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();
    if (!settings) return null;
    return {
      jwtExpiryAccess: settings.jwtExpiryAccess,
      jwtExpiryRefresh: settings.jwtExpiryRefresh,
    };
  },
});

export const createSession = internalMutation({
  args: {
    userId: v.id("users"),
    refreshTokenHash: v.string(),
    expiresAt: v.number(),
    deviceInfo: v.optional(v.string()),
    ip: v.optional(v.string()),
  },
  returns: v.id("sessions"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", args);
  },
});

export const blacklistSession = internalMutation({
  args: { sessionId: v.id("sessions"), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { sessionId, expiresAt }) => {
    await ctx.db.insert("session_blacklist", { sessionId, expiresAt });
    return null;
  },
});

export const isSessionBlacklisted = internalQuery({
  args: { sessionId: v.id("sessions") },
  returns: v.boolean(),
  handler: async (ctx, { sessionId }) => {
    const entry = await ctx.db
      .query("session_blacklist")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .first();
    return entry !== null;
  },
});

export const getSession = internalQuery({
  args: { sessionId: v.id("sessions") },
  returns: v.any(),
  handler: async (ctx, { sessionId }) => {
    return await ctx.db.get(sessionId);
  },
});
