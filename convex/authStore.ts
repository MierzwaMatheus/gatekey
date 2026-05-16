import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.any(),
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
  },
});

export const incrementLoginAttempts = internalMutation({
  args: { userId: v.id("users") },
  returns: v.number(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("user_not_found");
    const newAttempts = user.loginAttempts + 1;
    await ctx.db.patch(userId, { loginAttempts: newAttempts, updatedAt: Date.now() });
    return newAttempts;
  },
});

export const lockAccount = internalMutation({
  args: { userId: v.id("users"), lockedUntil: v.number() },
  returns: v.null(),
  handler: async (ctx, { userId, lockedUntil }) => {
    await ctx.db.patch(userId, { loginAttempts: 5, lockedUntil, updatedAt: Date.now() });
    return null;
  },
});

export const resetLoginAttempts = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, { loginAttempts: 0, lockedUntil: undefined, updatedAt: Date.now() });
    return null;
  },
});

export const createUserRecord = internalMutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, { email, passwordHash }) => {
    return await ctx.db.insert("users", {
      email,
      passwordHash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    });
  },
});

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

export const checkAndIncrementRateLimit = internalMutation({
  args: { ip: v.string(), endpoint: v.string() },
  returns: v.boolean(), // true = permitido, false = bloqueado
  handler: async (ctx, { ip, endpoint }) => {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    const existing = await ctx.db
      .query("ip_rate_limits")
      .withIndex("by_ip_and_endpoint", (q) => q.eq("ip", ip).eq("endpoint", endpoint))
      .first();

    if (!existing || existing.windowStart < windowStart) {
      // Nova janela
      if (existing) {
        await ctx.db.patch(existing._id, { count: 1, windowStart: now });
      } else {
        await ctx.db.insert("ip_rate_limits", { ip, endpoint, count: 1, windowStart: now });
      }
      return true;
    }

    if (existing.count >= RATE_LIMIT_MAX) {
      return false;
    }

    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return true;
  },
});

export const getOrgSettings = internalQuery({
  args: { orgId: v.id("orgs") },
  returns: v.any(),
  handler: async (ctx, { orgId }) => {
    return await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();
  },
});

export const getFirstActiveOrgForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.any(),
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("org_members")
      .filter((q) => q.and(q.eq(q.field("userId"), userId), q.eq(q.field("status"), "active")))
      .first();
  },
});
