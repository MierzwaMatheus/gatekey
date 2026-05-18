// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const findDirectBinding = internalQuery({
  args: { userId: v.id("users"), resourceType: v.string(), resourceId: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, { userId, resourceType, resourceId }) => {
    return await ctx.db
      .query("bindings")
      .withIndex("by_userId_and_resourceType_and_resourceId", (q) =>
        q.eq("userId", userId).eq("resourceType", resourceType).eq("resourceId", resourceId),
      )
      .first();
  },
});

export const pdpDecide = internalQuery({
  args: {
    userId: v.id("users"),
    orgId: v.id("orgs"),
    capability: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
    sessionId: v.optional(v.id("sessions")),
    apiKeyPublicId: v.optional(v.string()),
    requiredScope: v.optional(v.string()),
  },
  returns: v.object({ allowed: v.boolean(), reason: v.string() }),
  handler: async (ctx, args) => {
    try {
      // Passo 1: usuário ativo
      const user = await ctx.db.get(args.userId);
      if (!user || user.status !== "active") {
        return { allowed: false, reason: "user_inactive" };
      }

      // Passo 2: sessão válida (quando autenticação por JWT)
      if (args.sessionId) {
        const session = await ctx.db.get(args.sessionId);
        if (!session || session.expiresAt <= Date.now()) {
          return { allowed: false, reason: "session_invalid" };
        }
        const blacklisted = await ctx.db
          .query("session_blacklist")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId!))
          .unique();
        if (blacklisted) return { allowed: false, reason: "session_invalid" };
      }

      // Passo 3: API Key válida (quando autenticação por API Key)
      if (args.apiKeyPublicId) {
        const key = await ctx.db
          .query("api_keys")
          .withIndex("by_publicId", (q) => q.eq("publicId", args.apiKeyPublicId!))
          .unique();
        if (!key || key.status !== "active") {
          return { allowed: false, reason: "api_key_invalid" };
        }

        // Passo 4: escopo da API Key
        if (args.requiredScope && !key.scopes.includes(args.requiredScope)) {
          return { allowed: false, reason: "api_key_scope_missing" };
        }
      }

      // Passo 5: membership no workspace
      const member = await ctx.db
        .query("workspace_members")
        .withIndex("by_userId_and_workspaceId", (q) =>
          q.eq("userId", args.userId).eq("workspaceId", args.workspaceId),
        )
        .unique();
      if (!member || member.status !== "active") {
        return { allowed: false, reason: "not_workspace_member" };
      }

      // Helper para verificar capability em um binding
      const hasCapability = async (roleId: any) => {
        const roleCapabilities = await ctx.db
          .query("role_capabilities")
          .filter((q) => q.eq(q.field("roleId"), roleId))
          .collect();
        for (const rc of roleCapabilities) {
          const cap = await ctx.db.get(rc.capabilityId);
          if (cap?.name === args.capability) return true;
        }
        return false;
      };

      // Passo 6: binding direto
      if (args.resourceId) {
        const direct = await ctx.db
          .query("bindings")
          .withIndex("by_userId_and_resourceType_and_resourceId", (q) =>
            q
              .eq("userId", args.userId)
              .eq("resourceType", args.resourceType)
              .eq("resourceId", args.resourceId),
          )
          .first();
        if (direct && (await hasCapability(direct.roleId))) {
          return { allowed: true, reason: "direct_binding" };
        }

        // Passo 7: binding no container pai
        if (direct?.parentResourceId) {
          const rt = await ctx.db
            .query("resource_types")
            .filter((q) =>
              q.and(
                q.eq(q.field("orgId"), args.orgId),
                q.eq(q.field("name"), args.resourceType),
              ),
            )
            .first();
          if (rt?.inheritsFrom) {
            const parent = await ctx.db
              .query("bindings")
              .withIndex("by_userId_and_resourceType_and_resourceId", (q) =>
                q
                  .eq("userId", args.userId)
                  .eq("resourceType", rt.inheritsFrom!)
                  .eq("resourceId", direct.parentResourceId!),
              )
              .first();
            if (parent && (await hasCapability(parent.roleId))) {
              return { allowed: true, reason: "parent_binding" };
            }
          }
        }
      }

      // Passo 8: binding no workspace
      const wsBinding = await ctx.db
        .query("bindings")
        .withIndex("by_workspaceId_and_userId", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("userId", args.userId),
        )
        .filter((q) => q.eq(q.field("resourceId"), undefined))
        .first();
      if (wsBinding && (await hasCapability(wsBinding.roleId))) {
        return { allowed: true, reason: "workspace_binding" };
      }

      return { allowed: false, reason: "no_binding_found" };
    } catch {
      return { allowed: false, reason: "internal_error" };
    }
  },
});

export const findParentBinding = internalQuery({
  args: {
    userId: v.id("users"),
    resourceType: v.string(),
    resourceId: v.string(),
    orgId: v.id("orgs"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, { userId, resourceType, resourceId, orgId }) => {
    const childBinding = await ctx.db
      .query("bindings")
      .withIndex("by_userId_and_resourceType_and_resourceId", (q) =>
        q.eq("userId", userId).eq("resourceType", resourceType).eq("resourceId", resourceId),
      )
      .first();
    if (!childBinding?.parentResourceId) return null;

    const rt = await ctx.db
      .query("resource_types")
      .filter((q) =>
        q.and(q.eq(q.field("orgId"), orgId), q.eq(q.field("name"), resourceType)),
      )
      .first();
    if (!rt?.inheritsFrom) return null;

    return await ctx.db
      .query("bindings")
      .withIndex("by_userId_and_resourceType_and_resourceId", (q) =>
        q
          .eq("userId", userId)
          .eq("resourceType", rt.inheritsFrom!)
          .eq("resourceId", childBinding.parentResourceId!),
      )
      .first();
  },
});

export const resolveRole = internalQuery({
  args: { roleId: v.id("roles") },
  returns: v.array(v.string()),
  handler: async (ctx, { roleId }) => {
    const roleCapabilities = await ctx.db
      .query("role_capabilities")
      .filter((q) => q.eq(q.field("roleId"), roleId))
      .collect();
    const names = await Promise.all(
      roleCapabilities.map(async (rc) => {
        const cap = await ctx.db.get(rc.capabilityId);
        return cap?.name ?? null;
      }),
    );
    return names.filter((n): n is string => n !== null);
  },
});

export const findWorkspaceBinding = internalQuery({
  args: { userId: v.id("users"), workspaceId: v.id("workspaces") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, { userId, workspaceId }) => {
    return await ctx.db
      .query("bindings")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId),
      )
      .filter((q) => q.eq(q.field("resourceId"), undefined))
      .first();
  },
});

export const checkWorkspaceMembership = internalQuery({
  args: { userId: v.id("users"), workspaceId: v.id("workspaces") },
  returns: v.boolean(),
  handler: async (ctx, { userId, workspaceId }) => {
    const member = await ctx.db
      .query("workspace_members")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", userId).eq("workspaceId", workspaceId),
      )
      .unique();
    return member?.status === "active";
  },
});

export const checkApiKeyScope = internalQuery({
  args: { publicId: v.string(), requiredScope: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { publicId, requiredScope }) => {
    const key = await ctx.db
      .query("api_keys")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .unique();
    if (!key) return false;
    return key.scopes.includes(requiredScope);
  },
});

export const checkApiKeyValid = internalQuery({
  args: { publicId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { publicId }) => {
    const key = await ctx.db
      .query("api_keys")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .unique();
    return key?.status === "active";
  },
});

export const checkSessionValid = internalQuery({
  args: { sessionId: v.id("sessions") },
  returns: v.boolean(),
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return false;
    if (session.expiresAt <= Date.now()) return false;
    const blacklisted = await ctx.db
      .query("session_blacklist")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .unique();
    return blacklisted === null;
  },
});

export const checkUserActive = internalQuery({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return false;
    return user.status === "active";
  },
});

export const findApiKey = internalQuery({
  args: { publicId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("api_keys"),
      orgId: v.id("orgs"),
      publicId: v.string(),
      secretHash: v.string(),
      scopes: v.array(v.string()),
      status: v.union(v.literal("active"), v.literal("revoked")),
    }),
  ),
  handler: async (ctx, { publicId }) => {
    const key = await ctx.db
      .query("api_keys")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .unique();
    if (!key) return null;
    return {
      _id: key._id,
      orgId: key.orgId,
      publicId: key.publicId,
      secretHash: key.secretHash,
      scopes: key.scopes,
      status: key.status,
    };
  },
});
