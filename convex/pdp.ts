import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const checkUserActive = internalQuery({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return false;
    return user.status === "active";
  },
});
