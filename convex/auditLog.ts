import { internalMutation, internalQuery, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { verifyJwtToken } from "./jwtVerify";

export const writeAuditEvent = internalMutation({
  args: {
    actorType: v.union(v.literal("user"), v.literal("api_key"), v.literal("system")),
    actorId: v.string(),
    actorRole: v.optional(v.string()),
    action: v.string(),
    target: v.object({
      type: v.string(),
      id: v.optional(v.string()),
    }),
    orgId: v.optional(v.id("orgs")),
    workspaceId: v.optional(v.id("workspaces")),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    result: v.union(v.literal("allow"), v.literal("deny")),
    reason: v.optional(v.string()),
  },
  returns: v.id("audit_log"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("audit_log", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// ── listAuditLogQuery — query pública para real-time via usePaginatedQuery ────

export const listAuditLogQuery = query({
  args: {
    token: v.string(),
    orgId: v.optional(v.id("orgs")),
    workspaceId: v.optional(v.id("workspaces")),
    action: v.optional(v.string()),
    result: v.optional(v.union(v.literal("allow"), v.literal("deny"))),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const emptyPage = { page: [], isDone: true, continueCursor: "" };

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
      return emptyPage;
    }

    const caller = await ctx.db.get(callerId);
    if (!caller) return emptyPage;

    const isRoot = caller.isRoot === true;

    if (!isRoot) {
      if (args.workspaceId) {
        const wsMembership = await ctx.db
          .query("workspace_members")
          .filter((q) =>
            q.and(
              q.eq(q.field("userId"), callerId),
              q.eq(q.field("workspaceId"), args.workspaceId!),
              q.eq(q.field("status"), "active"),
            ),
          )
          .first();
        if (!wsMembership) return emptyPage;
      } else {
        const membership = await ctx.db
          .query("org_members")
          .filter((q) =>
            q.and(
              q.eq(q.field("userId"), callerId),
              q.eq(q.field("orgId"), args.orgId),
              q.eq(q.field("status"), "active"),
            ),
          )
          .first();
        if (!membership || membership.role !== "admin") return emptyPage;
      }
    }

    let baseQuery;
    if (args.workspaceId) {
      const from = args.from ?? 0;
      const to = args.to ?? Date.now() + 1000;
      baseQuery = ctx.db
        .query("audit_log")
        .withIndex("by_workspaceId_and_timestamp", (q) =>
          q.eq("workspaceId", args.workspaceId!).gte("timestamp", from).lte("timestamp", to),
        );
    } else if (args.orgId) {
      const from = args.from ?? 0;
      const to = args.to ?? Date.now() + 1000;
      baseQuery = ctx.db
        .query("audit_log")
        .withIndex("by_orgId_and_timestamp", (q) =>
          q.eq("orgId", args.orgId!).gte("timestamp", from).lte("timestamp", to),
        );
    } else {
      baseQuery = ctx.db.query("audit_log").order("desc");
    }

    if (args.action && args.result) {
      const actionFilter = args.action;
      const resultFilter = args.result;
      baseQuery = baseQuery.filter((q) =>
        q.and(q.eq(q.field("action"), actionFilter), q.eq(q.field("result"), resultFilter)),
      );
    } else if (args.action) {
      const actionFilter = args.action;
      baseQuery = baseQuery.filter((q) => q.eq(q.field("action"), actionFilter));
    } else if (args.result) {
      const resultFilter = args.result;
      baseQuery = baseQuery.filter((q) => q.eq(q.field("result"), resultFilter));
    }

    return baseQuery.paginate(args.paginationOpts);
  },
});

export const listAuditLog = internalQuery({
  args: {
    callerId: v.id("users"),
    orgId: v.optional(v.id("orgs")),
    workspaceId: v.optional(v.id("workspaces")),
    action: v.optional(v.string()),
    result: v.optional(v.union(v.literal("allow"), v.literal("deny"))),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: caller_not_found");

    const isRoot = caller.isRoot === true;

    if (!isRoot) {
      // Verificar se é Org Admin da org solicitada
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

      if (args.workspaceId) {
        // WS Admin: precisa ser membro do workspace
        const wsMembership = await ctx.db
          .query("workspace_members")
          .filter((q) =>
            q.and(
              q.eq(q.field("userId"), args.callerId),
              q.eq(q.field("workspaceId"), args.workspaceId),
              q.eq(q.field("status"), "active"),
            ),
          )
          .first();
        if (!wsMembership) throw new Error("forbidden: not_workspace_member");
      } else {
        // Org Admin: precisa ser admin da org
        if (!membership || membership.role !== "admin") {
          throw new Error("forbidden: org_admin_required");
        }
      }
    }

    let query;
    if (args.workspaceId) {
      const from = args.from ?? 0;
      const to = args.to ?? Date.now() + 1000;
      query = ctx.db
        .query("audit_log")
        .withIndex("by_workspaceId_and_timestamp", (q) =>
          q.eq("workspaceId", args.workspaceId!).gte("timestamp", from).lte("timestamp", to),
        );
    } else if (args.orgId) {
      const from = args.from ?? 0;
      const to = args.to ?? Date.now() + 1000;
      query = ctx.db
        .query("audit_log")
        .withIndex("by_orgId_and_timestamp", (q) =>
          q.eq("orgId", args.orgId!).gte("timestamp", from).lte("timestamp", to),
        );
    } else {
      // Root sem org: listar todos os eventos
      query = ctx.db.query("audit_log").order("desc");
    }

    if (args.action && args.result) {
      const actionFilter = args.action;
      const resultFilter = args.result;
      query = query.filter((q) =>
        q.and(q.eq(q.field("action"), actionFilter), q.eq(q.field("result"), resultFilter)),
      );
    } else if (args.action) {
      const actionFilter = args.action;
      query = query.filter((q) => q.eq(q.field("action"), actionFilter));
    } else if (args.result) {
      const resultFilter = args.result;
      query = query.filter((q) => q.eq(q.field("result"), resultFilter));
    }

    return query.paginate(args.paginationOpts);
  },
});

export const getAuditEventsForExport = internalQuery({
  args: {
    orgId: v.id("orgs"),
    beforeTimestamp: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("audit_log")
      .withIndex("by_orgId_and_timestamp", (q) =>
        q.eq("orgId", args.orgId).lt("timestamp", args.beforeTimestamp),
      )
      .paginate(args.paginationOpts);
  },
});

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TWENTY_FIVE_DAYS_MS = 25 * 24 * 60 * 60 * 1000;

export const listOrgsWithStaleEvents = internalQuery({
  args: {},
  handler: async (ctx) => {
    const threshold = Date.now() - THIRTY_DAYS_MS;
    const staleEvent = await ctx.db
      .query("audit_log")
      .filter((q) => q.lt(q.field("timestamp"), threshold))
      .first();
    if (!staleEvent) return [];

    const allOrgs = await ctx.db.query("orgs").collect();
    const orgsWithStale: Id<"orgs">[] = [];

    for (const org of allOrgs) {
      const event = await ctx.db
        .query("audit_log")
        .withIndex("by_orgId_and_timestamp", (q) =>
          q.eq("orgId", org._id).lt("timestamp", threshold),
        )
        .first();
      if (event) orgsWithStale.push(org._id);
    }

    return orgsWithStale;
  },
});

export const checkColdStorageAlert = query({
  args: {},
  handler: async (ctx) => {
    const threshold = Date.now() - TWENTY_FIVE_DAYS_MS;
    const coldStorageConfigured = !!process.env.R2_ACCOUNT_ID;

    const staleEvent = await ctx.db
      .query("audit_log")
      .filter((q) => q.lt(q.field("timestamp"), threshold))
      .first();

    return {
      hasStaleEvents: !!staleEvent,
      coldStorageConfigured,
      shouldAlert: !!staleEvent && !coldStorageConfigured,
    };
  },
});

export const getAuditExportByPeriod = query({
  args: {
    orgId: v.id("orgs"),
    startTs: v.number(),
    endTs: v.number(),
  },
  handler: async (ctx, args) => {
    const exports = await ctx.db
      .query("audit_exports")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();
    return (
      exports.find(
        (e) => e.period.start >= args.startTs && e.period.end <= args.endTs,
      ) ?? null
    );
  },
});

export const getAuditExportByPeriodInternal = internalQuery({
  args: {
    orgId: v.id("orgs"),
    startTs: v.number(),
    endTs: v.number(),
  },
  handler: async (ctx, args) => {
    const exports = await ctx.db
      .query("audit_exports")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();
    return (
      exports.find(
        (e) => e.period.start >= args.startTs && e.period.end <= args.endTs,
      ) ?? null
    );
  },
});

export const recordAuditExport = internalMutation({
  args: {
    orgId: v.id("orgs"),
    period: v.object({ start: v.number(), end: v.number() }),
    storagePath: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("audit_exports", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
