import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const DEFAULT_QUOTA_API_KEYS = 10;

export const _insertApiKey = internalMutation({
  args: {
    orgId: v.id("orgs"),
    publicId: v.string(),
    secretHash: v.string(),
    scopes: v.array(v.string()),
    description: v.string(),
  },
  returns: v.id("api_keys"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("api_keys", {
      orgId: args.orgId,
      publicId: args.publicId,
      secretHash: args.secretHash,
      scopes: args.scopes,
      description: args.description,
      status: "active",
    });
  },
});

export const _countActiveKeys = internalQuery({
  args: { orgId: v.optional(v.id("orgs")) },
  returns: v.object({ count: v.number(), quota: v.number() }),
  handler: async (ctx, { orgId }) => {
    const quota = DEFAULT_QUOTA_API_KEYS;
    if (!orgId) return { count: 0, quota: Number.MAX_SAFE_INTEGER };

    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();
    const effectiveQuota = (settings?.quotas["api_keys_per_org"] as number | undefined) ?? quota;

    const activeKeys = await ctx.db
      .query("api_keys")
      .withIndex("by_orgId_and_status", (q) => q.eq("orgId", orgId).eq("status", "active"))
      .take(effectiveQuota + 1);

    return { count: activeKeys.length, quota: effectiveQuota };
  },
});

export const _assertOrgAdminOrRoot = internalQuery({
  args: { callerId: v.id("users"), orgId: v.optional(v.id("orgs")) },
  returns: v.boolean(),
  handler: async (ctx, { callerId, orgId }) => {
    const caller = await ctx.db.get(callerId);
    if (!caller) throw new Error("forbidden: caller_not_found");
    if (caller.isRoot) return true;
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
    return true;
  },
});

export const updateLastUsed = internalMutation({
  args: {
    keyId: v.id("api_keys"),
    ip: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { keyId, ip }) => {
    await ctx.db.patch(keyId, { lastUsedAt: Date.now(), lastUsedIp: ip });
    return null;
  },
});

export const revokeApiKey = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.optional(v.id("orgs")),
    keyId: v.id("api_keys"),
    ip: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { callerId, orgId, keyId, ip }) => {
    const caller = await ctx.db.get(callerId);
    if (!caller) throw new Error("forbidden: caller_not_found");

    if (!caller.isRoot) {
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

    const key = await ctx.db.get(keyId);
    if (!key) throw new Error("not_found");

    const callerDoc = await ctx.db.get(callerId);
    if (key.orgId !== orgId && !callerDoc?.isRoot) throw new Error("forbidden: key_not_in_org");


    await ctx.db.patch(keyId, { status: "revoked" });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: callerId,
      action: "api_key.revoke",
      target: { type: "api_key", id: keyId },
      orgId,
      ip,
      result: "allow",
    });

    return null;
  },
});

export const listApiKeys = internalQuery({
  args: {
    callerId: v.id("users"),
    orgId: v.optional(v.id("orgs")),
  },
  returns: v.array(v.any()),
  handler: async (ctx, { callerId, orgId }) => {
    const caller = await ctx.db.get(callerId);
    if (!caller) throw new Error("forbidden: caller_not_found");

    if (!caller.isRoot) {
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

    if (!orgId) {
      // Root sem org: listar todas as api keys ativas
      const keys = await ctx.db.query("api_keys").order("desc").take(100);
      return keys.map(({ secretHash: _secretHash, ...safe }) => safe);
    }

    const keys = await ctx.db
      .query("api_keys")
      .withIndex("by_orgId_and_status", (q) => q.eq("orgId", orgId).eq("status", "active"))
      .order("desc")
      .take(50);

    return keys.map(({ secretHash: _secretHash, ...safe }) => safe);
  },
});
