import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const listSessions = internalQuery({
  args: {
    orgId: v.optional(v.id("orgs")),
    userId: v.optional(v.id("users")),
    callerId: v.optional(v.id("users")),
  },
  returns: v.array(v.any()),
  handler: async (ctx, { orgId, userId, callerId }) => {
    const now = Date.now();

    const isRoot = callerId ? (await ctx.db.get(callerId))?.isRoot === true : false;

    let userIds: string[];
    if (userId) {
      if (!isRoot && orgId) {
        const membership = await ctx.db
          .query("org_members")
          .filter((q) => q.and(q.eq(q.field("orgId"), orgId), q.eq(q.field("userId"), userId)))
          .first();
        if (!membership) return [];
      }
      userIds = [userId];
    } else if (isRoot && !orgId) {
      // Root sem org: listar todas as sessões ativas
      const allSessions = await ctx.db.query("sessions").collect();
      const now2 = Date.now();
      const result = [];
      for (const session of allSessions) {
        if (session.expiresAt <= now2) continue;
        const blacklisted = await ctx.db
          .query("session_blacklist")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
          .first();
        if (!blacklisted) result.push(session);
      }
      return result;
    } else if (orgId) {
      const members = await ctx.db
        .query("org_members")
        .filter((q) => q.eq(q.field("orgId"), orgId))
        .collect();
      userIds = members.map((m) => m.userId);
    } else {
      return [];
    }

    const result = [];
    for (const uid of userIds) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_userId", (q) => q.eq("userId", uid as never))
        .collect();

      for (const session of sessions) {
        if (session.expiresAt <= now) continue;
        const blacklisted = await ctx.db
          .query("session_blacklist")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
          .first();
        if (blacklisted) continue;
        result.push(session);
      }
    }
    return result;
  },
});

export const revokeSession = internalAction({
  args: {
    sessionId: v.id("sessions"),
    callerId: v.id("users"),
    orgId: v.optional(v.id("orgs")),
    ip: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { sessionId, callerId, orgId, ip }) => {
    const session = await ctx.runQuery(internal.jwtStore.getSession, { sessionId });
    if (!session) throw new Error("session_not_found");

    const caller = await ctx.runQuery(internal.sessions.getCallerIsRoot, { callerId });
    if (!caller) {
      if (!orgId) throw new Error("forbidden");
      const membership = await ctx.runQuery(internal.sessions.checkOrgMembership, {
        userId: session.userId,
        orgId,
      });
      if (!membership) throw new Error("forbidden");
    }

    await ctx.runMutation(internal.jwtStore.blacklistSession, {
      sessionId,
      expiresAt: session.expiresAt,
    });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: callerId,
      action: "session.revoke",
      target: { type: "session", id: sessionId },
      orgId: orgId as never,
      ip,
      result: "allow",
    });

    return null;
  },
});

export const checkOrgMembership = internalQuery({
  args: { userId: v.id("users"), orgId: v.id("orgs") },
  returns: v.boolean(),
  handler: async (ctx, { userId, orgId }) => {
    const membership = await ctx.db
      .query("org_members")
      .filter((q) => q.and(q.eq(q.field("userId"), userId), q.eq(q.field("orgId"), orgId)))
      .first();
    return membership !== null;
  },
});

export const getCallerIsRoot = internalQuery({
  args: { callerId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, { callerId }) => {
    const user = await ctx.db.get(callerId);
    return user?.isRoot === true;
  },
});
