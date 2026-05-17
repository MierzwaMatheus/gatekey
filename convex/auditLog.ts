import { internalMutation, internalQuery } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

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
