import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const DEFAULT_QUOTA_USERS_PER_ORG = 50;

export const getUserById = internalQuery({
  args: {
    callerId: v.id("users"),
    userId: v.id("users"),
    orgId: v.id("orgs"),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: caller_not_found");

    if (!caller.isRoot) {
      const callerMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!callerMembership || callerMembership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }

      const targetMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.userId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!targetMembership) throw new Error("forbidden: target_not_in_org");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const { passwordHash: _pw, ...safeUser } = user;
    return safeUser;
  },
});

export const createUser = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    email: v.string(),
    passwordHash: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: caller_not_found");

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
    const quota = settings?.quotas["users_per_org"] ?? DEFAULT_QUOTA_USERS_PER_ORG;

    const currentMembers = await ctx.db
      .query("org_members")
      .filter((q) =>
        q.and(q.eq(q.field("orgId"), args.orgId), q.eq(q.field("status"), "active")),
      )
      .take(quota + 1);
    if (currentMembers.length >= quota) {
      throw new Error(
        `quota_exceeded: users_per_org, limit=${quota}, current=${currentMembers.length}`,
      );
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

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "user.create",
      target: { type: "users", id: userId as string },
      orgId: args.orgId,
      result: "allow",
    });

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("internal_error: user_not_found_after_insert");
    const { passwordHash: _pw, ...safeUser } = user;
    return { id: userId, ...safeUser };
  },
});

export const updateUser = internalMutation({
  args: {
    callerId: v.id("users"),
    userId: v.id("users"),
    orgId: v.id("orgs"),
    email: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: caller_not_found");

    if (!caller.isRoot) {
      const callerMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!callerMembership || callerMembership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }

      const targetMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.userId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!targetMembership) throw new Error("forbidden: target_not_in_org");
    }

    const patch: { email?: string; passwordHash?: string; updatedAt: number } = {
      updatedAt: Date.now(),
    };
    if (args.email) patch.email = args.email;
    if (args.passwordHash) patch.passwordHash = args.passwordHash;

    await ctx.db.patch(args.userId, patch);

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "user.update",
      target: { type: "users", id: args.userId as string },
      orgId: args.orgId,
      result: "allow",
    });

    return null;
  },
});

export const deleteUser = internalMutation({
  args: {
    callerId: v.id("users"),
    userId: v.id("users"),
    orgId: v.id("orgs"),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: caller_not_found");

    if (!caller.isRoot) {
      const callerMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!callerMembership || callerMembership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }

      const targetMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.userId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!targetMembership) throw new Error("forbidden: target_not_in_org");
    }

    await ctx.db.patch(args.userId, { status: "suspended", updatedAt: Date.now() });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "user.delete",
      target: { type: "users", id: args.userId as string },
      orgId: args.orgId,
      result: "allow",
    });

    return null;
  },
});

export const getUserPermissions = internalQuery({
  args: {
    callerId: v.id("users"),
    userId: v.id("users"),
    orgId: v.id("orgs"),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: caller_not_found");

    if (!caller.isRoot) {
      const callerMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!callerMembership || callerMembership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }

      const targetMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.userId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!targetMembership) throw new Error("forbidden: target_not_in_org");
    }

    const bindings = await ctx.db
      .query("bindings")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .take(200);

    const result = [];
    for (const binding of bindings) {
      const role = await ctx.db.get(binding.roleId);
      if (!role) continue;

      const roleCapabilities = await ctx.db
        .query("role_capabilities")
        .filter((q) => q.eq(q.field("roleId"), binding.roleId))
        .take(100);

      const capabilities: string[] = [];
      for (const rc of roleCapabilities) {
        const cap = await ctx.db.get(rc.capabilityId);
        if (cap) capabilities.push(cap.name);
      }

      result.push({
        bindingId: binding._id as string,
        roleId: binding.roleId as string,
        roleName: role.name,
        resourceType: binding.resourceType,
        resourceId: binding.resourceId,
        workspaceId: binding.workspaceId as string,
        capabilities,
      });
    }

    return result;
  },
});

// Usado pelo HTTP endpoint para encontrar usuário por orgId e verificar pertencimento
export const findUserOrgMembership = internalQuery({
  args: {
    userId: v.id("users"),
    orgId: v.id("orgs"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("org_members")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("orgId"), args.orgId),
          q.eq(q.field("status"), "active"),
        ),
      )
      .first();
  },
});
