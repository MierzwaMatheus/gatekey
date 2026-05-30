// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalMutation, internalQuery, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { verifyJwtToken } from "./jwtVerify";

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

// ── listBindingsQuery — query pública para real-time via useQuery ─────────────

export const listBindingsQuery = query({
  args: {
    token: v.string(),
    orgId: v.id("orgs"),
    workspaceId: v.id("workspaces"),
    userId: v.optional(v.id("users")),
    resourceType: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const keys = await ctx.db
      .query("key_pairs")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "active"))
      .take(10);

    let callerId: Id<"users">;
    try {
      const payload = await verifyJwtToken(
        args.token,
        keys.map((k) => ({ publicKeyJwk: k.publicKeyJwk })),
      );
      callerId = payload.sub as Id<"users">;
    } catch {
      return [];
    }

    await assertOrgAdminOrRoot(ctx as never, callerId, args.orgId);

    let bindings;
    if (args.userId) {
      bindings = await ctx.db
        .query("bindings")
        .withIndex("by_workspaceId_and_userId", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("userId", args.userId!),
        )
        .collect();
    } else {
      bindings = await ctx.db
        .query("bindings")
        .withIndex("by_workspaceId_and_userId", (q) =>
          q.eq("workspaceId", args.workspaceId),
        )
        .collect();
    }

    if (args.resourceType) {
      bindings = bindings.filter((b) => b.resourceType === args.resourceType);
    }

    return bindings;
  },
});

// ── listBindings ──────────────────────────────────────────────────────────────

export const listBindings = internalQuery({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    workspaceId: v.id("workspaces"),
    userId: v.optional(v.id("users")),
    resourceType: v.optional(v.string()),
    type: v.optional(v.union(v.literal("allow"), v.literal("deny"))),
  },
  handler: async (ctx, args) => {
    await assertOrgAdminOrRoot(ctx as never, args.callerId, args.orgId);

    let bindings;
    if (args.userId) {
      bindings = await ctx.db
        .query("bindings")
        .withIndex("by_workspaceId_and_userId", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("userId", args.userId!),
        )
        .collect();
    } else {
      bindings = await ctx.db
        .query("bindings")
        .withIndex("by_workspaceId_and_userId", (q) =>
          q.eq("workspaceId", args.workspaceId),
        )
        .collect();
    }

    if (args.resourceType) {
      bindings = bindings.filter((b) => b.resourceType === args.resourceType);
    }

    if (args.type) {
      bindings = bindings.filter((b) => (b.type ?? "allow") === args.type);
    }

    return bindings;
  },
});

// ── deleteBinding ─────────────────────────────────────────────────────────────

export const deleteBinding = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    workspaceId: v.id("workspaces"),
    bindingId: v.id("bindings"),
  },
  handler: async (ctx, args) => {
    await assertOrgAdminOrRoot(ctx as never, args.callerId, args.orgId);

    const binding = await ctx.db.get(args.bindingId);
    if (!binding) throw new Error("not_found: binding");
    if (binding.workspaceId !== args.workspaceId) {
      throw new Error("forbidden: binding_not_in_workspace");
    }

    await ctx.db.delete(args.bindingId);

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "binding.delete",
      target: { type: "bindings", id: args.bindingId as string },
      orgId: args.orgId,
      workspaceId: args.workspaceId,
      result: "allow",
    });

    return null;
  },
});

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
    type: v.optional(v.union(v.literal("allow"), v.literal("deny"))),
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
      type: args.type ?? "allow",
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
