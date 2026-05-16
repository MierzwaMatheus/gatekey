import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const writeAuditEvent = internalMutation({
  args: {
    actorType: v.union(v.literal("user"), v.literal("api_key"), v.literal("system")),
    actorId: v.string(),
    actorRole: v.optional(v.string()),
    action: v.string(),
    target: v.object({
      type: v.string(),
      id: v.optional(v.string()),
    }),
    orgId: v.optional(v.id("orgs")),
    workspaceId: v.optional(v.id("workspaces")),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    result: v.union(v.literal("allow"), v.literal("deny")),
    reason: v.optional(v.string()),
  },
  returns: v.id("audit_log"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("audit_log", {
      ...args,
      timestamp: Date.now(),
    });
  },
});
