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

// ── createResourceType ────────────────────────────────────────────────────────

export const createResourceType = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    name: v.string(),
    inheritsFrom: v.optional(v.string()),
    inheritanceMode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertOrgAdminOrRoot(ctx as never, args.callerId, args.orgId);

    if (args.inheritsFrom) {
      const parent = await ctx.db
        .query("resource_types")
        .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
        .filter((q) => q.eq(q.field("name"), args.inheritsFrom!))
        .first();
      if (!parent) throw new Error("invalid_inherits_from");
    }

    const id = await ctx.db.insert("resource_types", {
      orgId: args.orgId,
      name: args.name,
      inheritsFrom: args.inheritsFrom,
      inheritanceMode: args.inheritanceMode,
    });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "resource_type.create",
      target: { type: "resource_types", id: id as string },
      orgId: args.orgId,
      result: "allow",
    });

    return id;
  },
});

// ── listResourceTypes ─────────────────────────────────────────────────────────

export const listResourceTypes = internalQuery({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
  },
  handler: async (ctx, args) => {
    await assertOrgAdminOrRoot(ctx as never, args.callerId, args.orgId);

    const types = await ctx.db
      .query("resource_types")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    return types.map((t) => ({
      id: t._id,
      name: t.name,
      inheritsFrom: t.inheritsFrom,
      inheritanceMode: t.inheritanceMode,
    }));
  },
});
