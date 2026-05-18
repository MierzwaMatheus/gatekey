// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalMutation, internalQuery, type QueryCtx, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const DEFAULT_ROLES_PER_WORKSPACE = 20;
const DEFAULT_CAPABILITIES_PER_ORG = 50;

async function assertOrgAdminOrRoot(
  ctx: QueryCtx | MutationCtx,
  callerId: Id<"users">,
  orgId?: Id<"orgs">,
) {
  const caller = await ctx.db.get(callerId);
  if (!caller) throw new Error("forbidden: caller_not_found");
  if (caller.isRoot) return;
  if (!orgId) throw new Error("forbidden: org_id_required");

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

// ── listRoles ─────────────────────────────────────────────────────────────────

export const listRoles = internalQuery({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await assertOrgAdminOrRoot(ctx as never, args.callerId, args.orgId);

    const allRoles = await ctx.db.query("roles").collect();
    return allRoles.filter(
      (r) => r.isBase === true || r.workspaceId === args.workspaceId,
    );
  },
});

// ── createRole ────────────────────────────────────────────────────────────────

export const createRole = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    workspaceId: v.id("workspaces"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await assertOrgAdminOrRoot(ctx as never, args.callerId, args.orgId);

    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .first();
    const quota: number =
      (settings?.quotas?.["roles_per_workspace"] as number | undefined) ??
      DEFAULT_ROLES_PER_WORKSPACE;

    const existing = await ctx.db
      .query("roles")
      .filter((q) =>
        q.and(
          q.eq(q.field("workspaceId"), args.workspaceId),
          q.eq(q.field("isBase"), false),
        ),
      )
      .collect();
    if (existing.length >= quota) {
      throw new Error(
        `quota_exceeded: roles_per_workspace, limit=${quota}, current=${existing.length}`,
      );
    }

    const roleId = await ctx.db.insert("roles", {
      workspaceId: args.workspaceId,
      name: args.name,
      isBase: false,
    });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "role.create",
      target: { type: "roles", id: roleId as string },
      orgId: args.orgId,
      workspaceId: args.workspaceId,
      result: "allow",
    });

    return { id: roleId, name: args.name, isBase: false };
  },
});

// ── deleteRole ────────────────────────────────────────────────────────────────

export const deleteRole = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    roleId: v.id("roles"),
  },
  handler: async (ctx, args) => {
    await assertOrgAdminOrRoot(ctx as never, args.callerId, args.orgId);

    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("not_found: role");
    if (role.isBase) throw new Error("forbidden: cannot_delete_base_role");

    const binding = await ctx.db
      .query("bindings")
      .filter((q) => q.eq(q.field("roleId"), args.roleId))
      .first();
    if (binding) throw new Error("role_has_active_bindings");

    await ctx.db.delete(args.roleId);

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "role.delete",
      target: { type: "roles", id: args.roleId as string },
      orgId: args.orgId,
      result: "allow",
    });

    return null;
  },
});

// ── listCapabilities ──────────────────────────────────────────────────────────

export const listCapabilities = internalQuery({
  args: {
    callerId: v.id("users"),
    orgId: v.optional(v.id("orgs")),
  },
  handler: async (ctx, args) => {
    await assertOrgAdminOrRoot(ctx as never, args.callerId, args.orgId);

    const all = await ctx.db.query("capabilities").collect();
    if (!args.orgId) return all; // root sem org: todas as capabilities
    return all.filter((c) => c.isBase === true || c.orgId === args.orgId);
  },
});

// ── createCapability ──────────────────────────────────────────────────────────

export const createCapability = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.optional(v.id("orgs")),
    name: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await assertOrgAdminOrRoot(ctx as never, args.callerId, args.orgId);

    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .first();
    const quota: number =
      (settings?.quotas?.["capabilities_per_org"] as number | undefined) ??
      DEFAULT_CAPABILITIES_PER_ORG;

    const existing = await ctx.db
      .query("capabilities")
      .filter((q) =>
        q.and(q.eq(q.field("orgId"), args.orgId), q.eq(q.field("isBase"), false)),
      )
      .collect();
    if (existing.length >= quota) {
      throw new Error(
        `quota_exceeded: capabilities_per_org, limit=${quota}, current=${existing.length}`,
      );
    }

    const capId = await ctx.db.insert("capabilities", {
      orgId: args.orgId,
      name: args.name,
      description: args.description,
      isBase: false,
    });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "capability.create",
      target: { type: "capabilities", id: capId as string },
      orgId: args.orgId,
      result: "allow",
    });

    return { id: capId, name: args.name, description: args.description, isBase: false };
  },
});
