// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

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

// ── getAffectedInheritanceUsers ───────────────────────────────────────────────

export const getAffectedInheritanceUsers = internalQuery({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    resourceTypeName: v.string(),
  },
  handler: async (ctx, args) => {
    await assertOrgAdminOrRoot(ctx as never, args.callerId, args.orgId);

    const orgWorkspaces = await ctx.db
      .query("workspaces")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();
    const workspaceIds = new Set(orgWorkspaces.map((w) => w._id as string));

    const bindings = await ctx.db
      .query("bindings")
      .withIndex("by_resourceType_and_resourceId", (q) =>
        q.eq("resourceType", args.resourceTypeName),
      )
      .collect();

    const affectedUsers = new Set<string>();
    for (const b of bindings) {
      if (b.parentResourceId !== undefined && workspaceIds.has(b.workspaceId as string)) {
        affectedUsers.add(b.userId as string);
      }
    }

    return affectedUsers.size;
  },
});

// ── updateResourceTypeInheritance ─────────────────────────────────────────────

export const updateResourceTypeInheritance = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    resourceTypeName: v.string(),
    inheritanceMode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertOrgAdminOrRoot(ctx as never, args.callerId, args.orgId);

    const rt = await ctx.db
      .query("resource_types")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("name"), args.resourceTypeName))
      .first();
    if (!rt) throw new Error("not_found: resource_type");

    await ctx.db.patch(rt._id, { inheritanceMode: args.inheritanceMode });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "resource_type.update",
      target: { type: "resource_types", id: rt._id as string },
      orgId: args.orgId,
      result: "allow",
    });
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
