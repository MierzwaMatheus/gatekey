// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Criar o primeiro usuário root via Convex Dashboard ou CLI:
// npx convex run setup:bootstrapRootUser '{"email":"admin@example.com","passwordHash":"<bcryptjs_hash>"}'
// O passwordHash deve ser gerado com bcryptjs antes de chamar este action.
export const bootstrapRootUser = internalAction({
  args: {
    email: v.string(),
    passwordHash: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true), userId: v.string() }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args): Promise<
    { success: true; userId: string } | { success: false; error: string }
  > => {
    const result = (await ctx.runMutation(internal.setupStore.createRootUser, {
      email: args.email,
      passwordHash: args.passwordHash,
    })) as { success: true; userId: string } | { success: false; error: string };

    if (!result.success) {
      return result;
    }

    return { success: true as const, userId: result.userId as unknown as string };
  },
});
