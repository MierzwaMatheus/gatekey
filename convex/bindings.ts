import { internalMutation, internalQuery, type QueryCtx, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

async function assertOrgAdminOrRoot(
  ctx: QueryCtx | MutationCtx,
  callerId: Id<"users">,
  orgId: Id<"orgs">,
) {
  const caller = await ctx.db.get(callerId);
  if (!caller) throw new Error("forbidden: caller_not_found");
  if (caller.isRoot) return;

  const membership = await ctx.db
    .query("org_members")
    .filter((q) =>
      q.and(
        q.eq(q.field("userId"), callerId),
        q.eq(q.field("orgId"), orgId),
        q.eq(q.field("status"), "active"),
      ),
    )
    .first();

  if (!membership || membership.role !== "admin") {
    throw new Error("forbidden: org_admin_required");
  }
}

// ── createBinding ─────────────────────────────────────────────────────────────

export const createBinding = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    roleId: v.id("roles"),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    parentResourceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertOrgAdminOrRoot(ctx as never, args.callerId, args.orgId);

    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("not_found: role");
    if (!role.isBase && role.workspaceId !== args.workspaceId) {
      throw new Error("invalid_role_workspace");
    }

    const bindingId = await ctx.db.insert("bindings", {
      userId: args.userId,
      roleId: args.roleId,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      parentResourceId: args.parentResourceId,
      workspaceId: args.workspaceId,
    });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "binding.create",
      target: { type: "bindings", id: bindingId as string },
      orgId: args.orgId,
      workspaceId: args.workspaceId,
      result: "allow",
    });

    return {
      id: bindingId,
      userId: args.userId,
      roleId: args.roleId,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      workspaceId: args.workspaceId,
    };
  },
});
