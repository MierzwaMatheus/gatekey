// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const DEFAULT_QUOTAS: Record<string, number> = {
  users_per_org: 50,
  workspaces_per_org: 10,
  users_per_workspace: 30,
  capabilities_per_org: 50,
  roles_per_workspace: 20,
  sessions_per_user: 5,
  api_keys_per_org: 10,
};

async function assertRoot(ctx: { db: { get: (id: Id<"users">) => Promise<{ isRoot?: boolean } | null> } }, callerId: Id<"users">) {
  const caller = await ctx.db.get(callerId);
  if (!caller || !caller.isRoot) {
    throw new Error("forbidden: root_required");
  }
}

export const createOrg = internalMutation({
  args: {
    callerId: v.id("users"),
    name: v.string(),
    adminEmail: v.string(),
    adminPasswordHash: v.optional(v.string()),
  },
  returns: v.object({ orgId: v.id("orgs"), isNewAdmin: v.boolean() }),
  handler: async (ctx, args) => {
    await assertRoot(ctx, args.callerId);

    const orgId = await ctx.db.insert("orgs", {
      name: args.name,
      status: "active",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("org_settings", {
      orgId,
      loginMethods: ["email_password"],
      mfaRequired: false,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 2592000,
      quotas: DEFAULT_QUOTAS,
    });

    const adminUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.adminEmail))
      .first();

    let adminUserId: Id<"users">;
    let isNewAdmin: boolean;
    if (adminUser) {
      adminUserId = adminUser._id;
      isNewAdmin = false;
    } else {
      adminUserId = await ctx.db.insert("users", {
        email: args.adminEmail,
        passwordHash: args.adminPasswordHash ?? "",
        mustChangePassword: args.adminPasswordHash ? true : undefined,
        status: "active",
        loginAttempts: 0,
        updatedAt: Date.now(),
      });
      isNewAdmin = true;
    }

    await ctx.db.insert("org_members", {
      userId: adminUserId,
      orgId,
      role: "admin",
      status: "active",
    });

    return { orgId, isNewAdmin };
  },
});

export const suspendOrg = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertRoot(ctx, args.callerId);
    await ctx.db.patch(args.orgId, { status: "suspended", updatedAt: Date.now() });
    return null;
  },
});

export const deleteOrg = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertRoot(ctx, args.callerId);
    await ctx.db.patch(args.orgId, { status: "deleted", updatedAt: Date.now() });
    return null;
  },
});

export const reactivateOrg = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertRoot(ctx, args.callerId);
    await ctx.db.patch(args.orgId, { status: "active", updatedAt: Date.now() });
    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "org.reactivate",
      target: { type: "orgs", id: args.orgId as string },
      orgId: args.orgId,
      result: "allow",
    });
    return null;
  },
});

export const revokeOrgSessions = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
  },
  returns: v.object({ sessionsRevoked: v.number() }),
  handler: async (ctx, args) => {
    await assertRoot(ctx, args.callerId);
    const members = await ctx.db
      .query("org_members")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    let sessionsRevoked = 0;
    for (const member of members) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_userId", (q) => q.eq("userId", member.userId))
        .collect();
      for (const session of sessions) {
        await ctx.db.insert("session_blacklist", {
          sessionId: session._id,
          expiresAt: session.expiresAt,
        });
        sessionsRevoked++;
      }
    }
    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "org.sessions_revoked",
      target: { type: "orgs", id: args.orgId as string },
      orgId: args.orgId,
      result: "allow",
      reason: `sessionsRevoked: ${sessionsRevoked}`,
    });
    return { sessionsRevoked };
  },
});

export const createWorkspace = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    name: v.string(),
  },
  returns: v.id("workspaces"),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");

    if (!caller.isRoot) {
      const membership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!membership || membership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }

    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .first();
    const wsQuota = settings?.quotas["workspaces_per_org"] ?? DEFAULT_QUOTAS["workspaces_per_org"];
    const wsCount = await ctx.db
      .query("workspaces")
      .filter((q) =>
        q.and(q.eq(q.field("orgId"), args.orgId), q.eq(q.field("status"), "active")),
      )
      .collect()
      .then((r) => r.length);
    if (wsCount >= wsQuota) {
      throw new Error("quota_exceeded: workspaces_per_org");
    }

    const newWsId = await ctx.db.insert("workspaces", {
      orgId: args.orgId,
      name: args.name,
      status: "active",
    });

    const adminRole = await ctx.db
      .query("roles")
      .filter((q) => q.and(q.eq(q.field("isBase"), true), q.eq(q.field("name"), "admin")))
      .first();
    if (adminRole) {
      const orgAdmins = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("role"), "admin"),
            q.eq(q.field("status"), "active"),
          ),
        )
        .collect();
      for (const member of orgAdmins) {
        await ctx.db.insert("bindings", {
          userId: member.userId,
          roleId: adminRole._id,
          resourceType: "workspace",
          workspaceId: newWsId,
        });
      }
    }

    return newWsId;
  },
});

export const listOrgs = internalQuery({
  args: { callerId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller || !caller.isRoot) {
      throw new Error("forbidden: root_required");
    }
    const orgs = await ctx.db.query("orgs").collect();
    const results = await Promise.all(
      orgs.map(async (org) => {
        const members = await ctx.db
          .query("org_members")
          .filter((q) => q.eq(q.field("orgId"), org._id))
          .collect();
        const workspaces = await ctx.db
          .query("workspaces")
          .filter((q) => q.eq(q.field("orgId"), org._id))
          .collect();
        return {
          _id: org._id,
          name: org.name,
          status: org.status,
          usersCount: members.length,
          workspacesCount: workspaces.length,
          updatedAt: org.updatedAt ?? org._creationTime,
        };
      }),
    );
    return results;
  },
});

export const isOrgAdminOrRoot = internalQuery({
  args: { callerId: v.id("users"), orgId: v.id("orgs") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) return false;
    if (caller.isRoot) return true;
    const membership = await ctx.db
      .query("org_members")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.callerId),
          q.eq(q.field("orgId"), args.orgId),
          q.eq(q.field("status"), "active"),
        ),
      )
      .first();
    return !!(membership && membership.role === "admin");
  },
});

export const createUserForOrg = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    email: v.string(),
    passwordHash: v.string(),
    role: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");

    if (!caller.isRoot) {
      const membership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!membership || membership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }

    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .first();
    const quota = settings?.quotas["users_per_org"] ?? DEFAULT_QUOTAS["users_per_org"];
    const currentCount = await ctx.db
      .query("org_members")
      .filter((q) =>
        q.and(q.eq(q.field("orgId"), args.orgId), q.eq(q.field("status"), "active")),
      )
      .collect()
      .then((r) => r.length);
    if (currentCount >= quota) {
      throw new Error("quota_exceeded: users_per_org");
    }

    const userId = await ctx.db.insert("users", {
      email: args.email,
      passwordHash: args.passwordHash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("org_members", {
      userId,
      orgId: args.orgId,
      role: args.role,
      status: "active",
    });

    if (args.role === "admin") {
      const adminRole = await ctx.db
        .query("roles")
        .filter((q) => q.and(q.eq(q.field("isBase"), true), q.eq(q.field("name"), "admin")))
        .first();
      if (adminRole) {
        const orgWorkspaces = await ctx.db
          .query("workspaces")
          .filter((q) =>
            q.and(
              q.eq(q.field("orgId"), args.orgId),
              q.eq(q.field("status"), "active"),
            ),
          )
          .collect();
        for (const ws of orgWorkspaces) {
          await ctx.db.insert("bindings", {
            userId,
            roleId: adminRole._id,
            resourceType: "workspace",
            workspaceId: ws._id,
          });
        }
      }
    }

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "user.create",
      target: { type: "users", id: userId as string },
      orgId: args.orgId,
      result: "allow",
    });

    return userId;
  },
});

export const patchUserPasswordHash = internalMutation({
  args: {
    callerId: v.id("users"),
    userId: v.id("users"),
    passwordHash: v.string(),
    clearMustChangePassword: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");

    if (!caller.isRoot) {
      const targetMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(q.eq(q.field("userId"), args.userId), q.eq(q.field("status"), "active")),
        )
        .first();
      if (!targetMembership) throw new Error("forbidden: target_not_in_org");

      const callerMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), targetMembership.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!callerMembership || callerMembership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }

    await ctx.db.patch(args.userId, {
      passwordHash: args.passwordHash,
      updatedAt: Date.now(),
      ...(args.clearMustChangePassword ? { mustChangePassword: false } : {}),
    });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "user.password_reset",
      target: { type: "users", id: args.userId as string },
      result: "allow",
    });

    return null;
  },
});

export const suspendUser = internalMutation({
  args: {
    callerId: v.id("users"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");

    if (!caller.isRoot) {
      const targetMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(q.eq(q.field("userId"), args.userId), q.eq(q.field("status"), "active")),
        )
        .first();
      if (!targetMembership) throw new Error("forbidden: target_not_in_org");

      const callerMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), targetMembership.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!callerMembership || callerMembership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }

    await ctx.db.patch(args.userId, { status: "suspended", updatedAt: Date.now() });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "user.suspend",
      target: { type: "users", id: args.userId as string },
      result: "allow",
    });

    return null;
  },
});

export const addWorkspaceMember = internalMutation({
  args: {
    callerId: v.id("users"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("not_found: workspace");

    const targetOrgMembership = await ctx.db
      .query("org_members")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("orgId"), workspace.orgId),
          q.eq(q.field("status"), "active"),
        ),
      )
      .first();
    if (!targetOrgMembership) throw new Error("user_not_org_member");

    if (!caller.isRoot) {
      const orgMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), workspace.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!orgMembership || orgMembership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }

    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), workspace.orgId))
      .first();
    const quota = settings?.quotas["users_per_workspace"] ?? DEFAULT_QUOTAS["users_per_workspace"];
    const currentCount = await ctx.db
      .query("workspace_members")
      .filter((q) =>
        q.and(
          q.eq(q.field("workspaceId"), args.workspaceId),
          q.eq(q.field("status"), "active"),
        ),
      )
      .collect()
      .then((r) => r.length);
    if (currentCount >= quota) {
      throw new Error("quota_exceeded: users_per_workspace");
    }

    await ctx.db.insert("workspace_members", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      status: "active",
    });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "workspace.member.add",
      target: { type: "workspace_members", id: args.userId as string },
      orgId: workspace.orgId,
      workspaceId: args.workspaceId,
      result: "allow",
    });

    return null;
  },
});

export const removeWorkspaceMember = internalMutation({
  args: {
    callerId: v.id("users"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("not_found: workspace");

    if (!caller.isRoot) {
      const orgMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), workspace.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!orgMembership || orgMembership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }

    const wm = await ctx.db
      .query("workspace_members")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId),
      )
      .first();
    if (!wm) throw new Error("not_found: workspace_member");

    await ctx.db.patch(wm._id, { status: "removed" });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "workspace.member.remove",
      target: { type: "workspace_members", id: args.userId as string },
      orgId: workspace.orgId,
      workspaceId: args.workspaceId,
      result: "allow",
    });

    return null;
  },
});

export const changeWorkspaceMemberRole = internalMutation({
  args: {
    callerId: v.id("users"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    newRoleId: v.id("roles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("not_found: workspace");

    if (!caller.isRoot) {
      const orgMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), workspace.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!orgMembership || orgMembership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }

    const binding = await ctx.db
      .query("bindings")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId),
      )
      .first();
    if (!binding) throw new Error("not_found: binding");

    await ctx.db.patch(binding._id, { roleId: args.newRoleId });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "workspace.member.role_change",
      target: { type: "bindings", id: args.userId as string },
      orgId: workspace.orgId,
      workspaceId: args.workspaceId,
      result: "allow",
    });

    return null;
  },
});

export const suspendWorkspace = internalMutation({
  args: {
    callerId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("not_found: workspace");

    if (!caller.isRoot) {
      const membership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), workspace.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!membership || membership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }

    await ctx.db.patch(args.workspaceId, { status: "suspended" });
    return null;
  },
});

export const getOrgSettings = internalQuery({
  args: { callerId: v.id("users"), orgId: v.id("orgs") },
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");
    if (!caller.isRoot) {
      const membership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!membership || membership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }
    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .first();
    if (!settings) throw new Error("not_found: org_settings");
    return {
      quotas: settings.quotas,
      loginMethods: settings.loginMethods,
      mfaRequired: settings.mfaRequired,
      jwtExpiryAccess: settings.jwtExpiryAccess,
      jwtExpiryRefresh: settings.jwtExpiryRefresh,
    };
  },
});

export const updateOrgQuotas = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    quotas: v.record(v.string(), v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertRoot(ctx, args.callerId);
    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .first();
    if (!settings) throw new Error("not_found: org_settings");
    const merged = { ...(settings.quotas as Record<string, number>), ...args.quotas };
    await ctx.db.patch(settings._id, { quotas: merged });
    return null;
  },
});

export const updateOrgSettings = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    loginMethods: v.optional(v.array(v.string())),
    mfaRequired: v.optional(v.boolean()),
    jwtExpiryAccess: v.optional(v.number()),
    jwtExpiryRefresh: v.optional(v.number()),
    quotas: v.optional(v.record(v.string(), v.number())),
    rateLimits: v.optional(v.object({
      checkPerMin: v.optional(v.number()),
      checkBatchPerMin: v.optional(v.number()),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");
    if (!caller.isRoot) {
      const membership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!membership || membership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }
    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .first();
    if (!settings) throw new Error("not_found: org_settings");

    const patch: Record<string, unknown> = {};
    if (args.loginMethods !== undefined) patch.loginMethods = args.loginMethods;
    if (args.mfaRequired !== undefined) patch.mfaRequired = args.mfaRequired;
    if (args.jwtExpiryAccess !== undefined) patch.jwtExpiryAccess = args.jwtExpiryAccess;
    if (args.jwtExpiryRefresh !== undefined) patch.jwtExpiryRefresh = args.jwtExpiryRefresh;
    if (args.quotas !== undefined) {
      patch.quotas = { ...(settings.quotas as Record<string, number>), ...args.quotas };
    }
    if (args.rateLimits !== undefined) patch.rateLimits = args.rateLimits;

    await ctx.db.patch(settings._id, patch as never);

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "org.settings.update",
      target: { type: "org_settings", id: args.orgId as string },
      orgId: args.orgId,
      result: "allow",
    });

    return null;
  },
});

export const listWorkspaces = internalQuery({
  args: { callerId: v.id("users"), orgId: v.id("orgs") },
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");
    if (!caller.isRoot) {
      const membership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!membership || membership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }
    const workspaces = await ctx.db
      .query("workspaces")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();
    return await Promise.all(
      workspaces.map(async (ws) => {
        const members = await ctx.db
          .query("workspace_members")
          .filter((q) =>
            q.and(
              q.eq(q.field("workspaceId"), ws._id),
              q.eq(q.field("status"), "active"),
            ),
          )
          .collect();
        return {
          _id: ws._id,
          name: ws.name,
          status: ws.status,
          membersCount: members.length,
          createdAt: ws._creationTime,
        };
      }),
    );
  },
});

export const listWorkspaceMembers = internalQuery({
  args: { callerId: v.id("users"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("not_found: workspace");

    if (!caller.isRoot) {
      const orgMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), workspace.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!orgMembership || orgMembership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }

    const members = await ctx.db
      .query("workspace_members")
      .filter((q) =>
        q.and(
          q.eq(q.field("workspaceId"), args.workspaceId),
          q.eq(q.field("status"), "active"),
        ),
      )
      .collect();

    return await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        const binding = await ctx.db
          .query("bindings")
          .withIndex("by_workspaceId_and_userId", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("userId", m.userId),
          )
          .first();
        let roleName = "member";
        if (binding) {
          const role = await ctx.db.get(binding.roleId);
          if (role) roleName = role.name;
        }
        return {
          userId: m.userId as string,
          userName: user?.email?.split("@")[0] ?? "unknown",
          userEmail: user?.email ?? "",
          roleName,
          addedAt: m._creationTime,
        };
      }),
    );
  },
});

export const listUsersForOrg = internalQuery({
  args: { callerId: v.id("users"), orgId: v.id("orgs") },
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");
    if (!caller.isRoot) {
      const membership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!membership || membership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }
    const members = await ctx.db
      .query("org_members")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();
    const users = await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        if (!user) return null;
        const { passwordHash: _pw, ...safeUser } = user;
        return { ...safeUser, orgRole: m.role, orgStatus: m.status };
      }),
    );
    return users.filter(Boolean);
  },
});
