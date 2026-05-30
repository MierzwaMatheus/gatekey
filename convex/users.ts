// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { verifyJwtToken } from "./jwtVerify";

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

export const reactivateUser = internalMutation({
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
          ),
        )
        .first();
      if (!targetMembership) throw new Error("forbidden: target_not_in_org");
    }

    await ctx.db.patch(args.userId, { status: "active", updatedAt: Date.now() });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "user.reactivate",
      target: { type: "users", id: args.userId as string },
      orgId: args.orgId,
      result: "allow",
    });
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

// ── listUsersQuery — query pública para real-time via useQuery ────────────────

export const listUsersQuery = query({
  args: {
    token: v.string(),
    orgId: v.id("orgs"),
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

    const caller = await ctx.db.get(callerId);
    if (!caller) return [];

    if (!caller.isRoot) {
      const callerMembership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), callerId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!callerMembership || callerMembership.role !== "admin") return [];
    }

    const members = await ctx.db
      .query("org_members")
      .filter((q) =>
        q.and(
          q.eq(q.field("orgId"), args.orgId),
          q.eq(q.field("status"), "active"),
        ),
      )
      .take(200);

    const users = [];
    for (const m of members) {
      const user = await ctx.db.get(m.userId);
      if (!user) continue;
      const { passwordHash: _pw, ...safeUser } = user;
      users.push({ ...safeUser, orgRole: m.role, orgStatus: m.status });
    }
    return users;
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

// ── Fase 11.1: Gestão global de usuários (Root-only) ─────────────────────────

export const listAllUsers = internalQuery({
  args: {
    callerId: v.id("users"),
    orgId: v.optional(v.id("orgs")),
    status: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller?.isRoot) throw new Error("forbidden: root_required");

    const pageSize = args.limit ?? 50;

    if (args.orgId) {
      // Filtrar por org: buscar membros da org, então os usuários
      const members = await ctx.db
        .query("org_members")
        .filter((q) => q.eq(q.field("orgId"), args.orgId!))
        .take(pageSize + 1);

      const users = [];
      for (const m of members) {
        const user = await ctx.db.get(m.userId);
        if (!user) continue;
        if (args.status && user.status !== args.status) continue;
        if (args.from && user._creationTime < args.from) continue;
        if (args.to && user._creationTime > args.to) continue;
        const { passwordHash: _pw, ...safeUser } = user;
        users.push({ ...safeUser, orgId: args.orgId, orgRole: m.role });
      }

      const isDone = users.length <= pageSize;
      return { users: users.slice(0, pageSize), nextCursor: null, isDone };
    }

    // Sem filtro de org: iterar todos os org_members para montar lista global
    const allMembers = await ctx.db.query("org_members").take(500);
    const seenUserIds = new Set<string>();
    const users = [];

    for (const m of allMembers) {
      if (seenUserIds.has(m.userId as string)) continue;
      seenUserIds.add(m.userId as string);

      const user = await ctx.db.get(m.userId);
      if (!user) continue;
      if (args.status && user.status !== args.status) continue;
      if (args.from && user._creationTime < args.from) continue;
      if (args.to && user._creationTime > args.to) continue;
      const { passwordHash: _pw, ...safeUser } = user;
      users.push({ ...safeUser, orgId: m.orgId, orgRole: m.role });
    }

    return { users, nextCursor: null, isDone: true };
  },
});

export const revokeAllUserSessions = internalMutation({
  args: {
    actorId: v.id("users"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorId);
    if (!actor?.isRoot) throw new Error("forbidden: root_required");

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    let sessionsRevoked = 0;
    for (const session of sessions) {
      await ctx.db.insert("session_blacklist", {
        sessionId: session._id,
        expiresAt: session.expiresAt,
      });
      sessionsRevoked++;
    }

    return { sessionsRevoked };
  },
});

export const suspendUserGlobal = internalMutation({
  args: {
    actorId: v.id("users"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorId);
    if (!actor?.isRoot) throw new Error("forbidden: root_required");

    await ctx.db.patch(args.userId, { status: "suspended", updatedAt: Date.now() });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.actorId as string,
      action: "user.suspend_global",
      target: { type: "users", id: args.userId as string },
      result: "allow",
    });
  },
});

// ── Fase 12.1: removeUserFromOrg ─────────────────────────────────────────────

export const removeUserFromOrg = internalMutation({
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
    }

    // Buscar todos os workspaces da org
    const workspaces = await ctx.db
      .query("workspaces")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();

    let bindingsRevoked = 0;
    let workspacesAffected = 0;

    for (const ws of workspaces) {
      // Remover workspace_members
      const wsMember = await ctx.db
        .query("workspace_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.userId),
            q.eq(q.field("workspaceId"), ws._id),
          ),
        )
        .first();
      if (wsMember) {
        await ctx.db.delete(wsMember._id);
        workspacesAffected++;
      }

      // Revogar bindings no workspace
      const bindings = await ctx.db
        .query("bindings")
        .withIndex("by_workspaceId_and_userId", (q) =>
          q.eq("workspaceId", ws._id).eq("userId", args.userId),
        )
        .collect();
      for (const b of bindings) {
        await ctx.db.delete(b._id);
        bindingsRevoked++;

        await ctx.runMutation(internal.auditLog.writeAuditEvent, {
          actorType: "user",
          actorId: args.callerId as string,
          action: "binding.revoke",
          target: { type: "bindings", id: b._id as string },
          orgId: args.orgId,
          result: "allow",
          reason: "user_removed_from_org",
        });
      }
    }

    // Revogar sessões ativas
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    for (const session of sessions) {
      await ctx.db.insert("session_blacklist", {
        sessionId: session._id,
        expiresAt: session.expiresAt,
      });
    }

    // Marcar org_members como removed
    const membership = await ctx.db
      .query("org_members")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("orgId"), args.orgId),
        ),
      )
      .first();
    if (membership) {
      await ctx.db.patch(membership._id, { status: "removed" });
    }

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId as string,
      action: "user.removed_from_org",
      target: { type: "users", id: args.userId as string },
      orgId: args.orgId,
      result: "allow",
    });

    return { workspacesAffected, bindingsRevoked };
  },
});

// ── Fase 10.1: Transferência de usuário entre orgs ────────────────────────────

export const transferUser = internalMutation({
  args: {
    actorId: v.id("users"),
    userId: v.id("users"),
    targetOrgId: v.id("orgs"),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorId);
    if (!actor?.isRoot) throw new Error("forbidden: root_required");

    const targetOrg = await ctx.db.get(args.targetOrgId);
    if (!targetOrg || targetOrg.status === "deleted")
      throw new Error("not_found: target_org");
    if (targetOrg.status !== "active")
      throw new Error("not_found: target_org");

    const currentMembership = await ctx.db
      .query("org_members")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("status"), "active"),
        ),
      )
      .first();
    if (!currentMembership) throw new Error("not_found: user_membership");

    const fromOrgId = currentMembership.orgId;
    if (fromOrgId === args.targetOrgId)
      throw new Error("unprocessable: already_in_org");

    // Coletar todos os bindings do usuário
    const allBindings = await ctx.db
      .query("bindings")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();

    let preservedBindings = 0;
    let revokedBindings = 0;
    const revokedBindingIds: string[] = [];

    for (const binding of allBindings) {
      const workspace = await ctx.db.get(binding.workspaceId);
      if (workspace && workspace.orgId === args.targetOrgId) {
        preservedBindings++;
      } else {
        revokedBindingIds.push(binding._id as string);
        await ctx.db.delete(binding._id);
        revokedBindings++;
      }
    }

    // Atualizar org_members
    await ctx.db.delete(currentMembership._id);
    await ctx.db.insert("org_members", {
      userId: args.userId,
      orgId: args.targetOrgId,
      role: currentMembership.role,
      status: "active",
    });

    // Revogar sessões ativas
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    let sessionsRevoked = 0;
    for (const session of sessions) {
      await ctx.db.insert("session_blacklist", {
        sessionId: session._id,
        expiresAt: session.expiresAt,
      });
      sessionsRevoked++;
    }

    // Audit: binding.revoke por cada binding revogado
    for (const bindingId of revokedBindingIds) {
      await ctx.runMutation(internal.auditLog.writeAuditEvent, {
        actorType: "user",
        actorId: args.actorId as string,
        action: "binding.revoke",
        target: { type: "bindings", id: bindingId },
        result: "allow",
        reason: "user_transfer_cleanup",
        orgId: fromOrgId,
      });
    }

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.actorId as string,
      action: "user.transfer",
      target: { type: "users", id: args.userId as string },
      result: "allow",
      reason: `fromOrgId:${fromOrgId},toOrgId:${args.targetOrgId},preserved:${preservedBindings},revoked:${revokedBindings}`,
      orgId: args.targetOrgId,
    });

    return {
      userId: args.userId,
      fromOrgId,
      toOrgId: args.targetOrgId,
      preservedBindings,
      revokedBindings,
      sessionsRevoked,
    };
  },
});
