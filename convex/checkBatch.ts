// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const checkItemValidator = v.object({
  userId: v.id("users"),
  capability: v.string(),
  resourceType: v.string(),
  resourceId: v.optional(v.string()),
});

export const performCheckBatch = internalAction({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    workspaceId: v.id("workspaces"),
    items: v.array(checkItemValidator),
    sessionId: v.optional(v.id("sessions")),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      allowed: v.boolean(),
      reason: v.string(),
    }),
  ),
  handler: async (ctx, args): Promise<Array<{ allowed: boolean; reason: string }>> => {
    if (args.items.length === 0) return [];

    const results = await Promise.all(
      args.items.map(async (item) => {
        try {
          const decision: { allowed: boolean; reason: string } = await ctx.runQuery(
            internal.pdp.pdpDecide,
            {
              userId: item.userId,
              orgId: args.orgId,
              capability: item.capability,
              resourceType: item.resourceType,
              resourceId: item.resourceId,
              workspaceId: args.workspaceId,
              sessionId: args.sessionId,
            },
          );

          await ctx.runMutation(internal.auditLog.writeAuditEvent, {
            actorType: "user",
            actorId: args.callerId,
            action: "permission.check",
            target: { type: item.resourceType, id: item.resourceId },
            orgId: args.orgId,
            workspaceId: args.workspaceId,
            ip: args.ip,
            userAgent: args.userAgent,
            result: decision.allowed ? "allow" : "deny",
            reason: decision.reason,
          });

          return decision;
        } catch {
          return { allowed: false, reason: "internal_error" };
        }
      }),
    );

    return results;
  },
});
