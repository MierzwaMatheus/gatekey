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
