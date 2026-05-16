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
