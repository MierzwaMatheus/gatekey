import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Criar o primeiro usuário root via Convex Dashboard ou CLI:
// npx convex run setup:bootstrapRootUser '{"email":"admin@example.com","password":"SuaSenhaForte"}'
export const bootstrapRootUser = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true), userId: v.string() }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args): Promise<
    { success: true; userId: string } | { success: false; error: string }
  > => {
    const existing = await ctx.runQuery(internal.setupStore.getRootUser, {});
    if (existing) {
      return { success: false as const, error: "root_user_already_exists" };
    }

    const userId = (await ctx.runAction(internal.auth.createUserWithPassword, {
      email: args.email,
      password: args.password,
    })) as string;

    await ctx.runMutation(internal.setupStore.setUserIsRoot, { userId: userId as never });

    return { success: true as const, userId };
  },
});
