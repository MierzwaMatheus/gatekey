import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const checkApiKeyScope = internalQuery({
  args: { publicId: v.string(), requiredScope: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { publicId, requiredScope }) => {
    const key = await ctx.db
      .query("api_keys")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .unique();
    if (!key) return false;
    return key.scopes.includes(requiredScope);
  },
});

export const checkApiKeyValid = internalQuery({
  args: { publicId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { publicId }) => {
    const key = await ctx.db
      .query("api_keys")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .unique();
    return key?.status === "active";
  },
});

export const checkSessionValid = internalQuery({
  args: { sessionId: v.id("sessions") },
  returns: v.boolean(),
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return false;
    if (session.expiresAt <= Date.now()) return false;
    const blacklisted = await ctx.db
      .query("session_blacklist")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .unique();
    return blacklisted === null;
  },
});

export const checkUserActive = internalQuery({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return false;
    return user.status === "active";
  },
});
