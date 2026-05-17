import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getRootUser = internalQuery({
  args: {},
  returns: v.union(v.object({ _id: v.id("users"), email: v.string() }), v.null()),
  handler: async (ctx) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isRoot"), true))
      .first();
    if (!user) return null;
    return { _id: user._id, email: user.email };
  },
});

export const setUserIsRoot = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, { isRoot: true, updatedAt: Date.now() });
    return null;
  },
});

export const createRootUser = internalMutation({
  args: { email: v.string(), passwordHash: v.string() },
  returns: v.union(
    v.object({ success: v.literal(true), userId: v.id("users") }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, { email, passwordHash }) => {
    const existing = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isRoot"), true))
      .first();
    if (existing) {
      return { success: false as const, error: "root_user_already_exists" };
    }

    const userId = await ctx.db.insert("users", {
      email,
      passwordHash,
      status: "active",
      loginAttempts: 0,
      isRoot: true,
      updatedAt: Date.now(),
    });

    return { success: true as const, userId };
  },
});
