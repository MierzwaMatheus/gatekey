import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type PepMutationArgs = {
  userId: Id<"users">;
  orgId: Id<"orgs">;
  workspaceId: Id<"workspaces">;
  requiredCapability: string;
};

export function withPepMutation<TArgs extends PepMutationArgs, TResult>(
  handler: (ctx: MutationCtx, args: TArgs) => Promise<TResult>,
  requiredCapability: string,
): ReturnType<typeof internalMutation> {
  return internalMutation({
    args: {
      userId: v.id("users"),
      orgId: v.id("orgs"),
      workspaceId: v.id("workspaces"),
      requiredCapability: v.string(),
    } as never,
    handler: async (ctx: MutationCtx, args: PepMutationArgs) => {
      const decision = await ctx.runQuery(internal.pdp.pdpDecide, {
        userId: args.userId,
        orgId: args.orgId,
        workspaceId: args.workspaceId,
        capability: requiredCapability,
        resourceType: "workspace",
      });
      if (!decision.allowed) {
        throw new Error(`forbidden: ${decision.reason}`);
      }
      return handler(ctx, args as TArgs);
    },
  });
}

export const testMutation = withPepMutation(
  async (_ctx, _args) => "ok" as const,
  "read",
) as ReturnType<typeof internalMutation>;
