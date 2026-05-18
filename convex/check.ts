// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const performCheck = internalAction({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    userId: v.id("users"),
    capability: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
    sessionId: v.optional(v.id("sessions")),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({ allowed: v.boolean(), reason: v.string() }),
  handler: async (ctx, args): Promise<{ allowed: boolean; reason: string }> => {
    const decision: { allowed: boolean; reason: string } = await ctx.runQuery(internal.pdp.pdpDecide, {
      userId: args.userId,
      orgId: args.orgId,
      capability: args.capability,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      workspaceId: args.workspaceId,
      sessionId: args.sessionId,
    });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId,
      action: "permission.check",
      target: { type: args.resourceType, id: args.resourceId },
      orgId: args.orgId,
      workspaceId: args.workspaceId,
      ip: args.ip,
      userAgent: args.userAgent,
      result: decision.allowed ? "allow" : "deny",
      reason: decision.reason,
    });

    return decision;
  },
});
