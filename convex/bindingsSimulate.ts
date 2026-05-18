// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";


export const resolveCallerCapabilities = internalQuery({
  args: {
    callerId: v.id("users"),
    workspaceId: v.id("workspaces"),
    orgId: v.id("orgs"),
  },
  handler: async (ctx, args): Promise<string[]> => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) return [];
    if (caller.isRoot) return ["*"];

    const bindings = await ctx.db
      .query("bindings")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerId),
      )
      .collect();

    const capabilities = new Set<string>();
    for (const b of bindings) {
      if (b.type === "deny") continue;
      const roleCaps = await ctx.db
        .query("role_capabilities")
        .filter((q) => q.eq(q.field("roleId"), b.roleId))
        .collect();
      for (const rc of roleCaps) {
        const cap = await ctx.db.get(rc.capabilityId);
        if (cap) capabilities.add(cap.name);
      }
    }

    // Org admin role: check org_members
    const orgMembership = await ctx.db
      .query("org_members")
      .filter((q) =>
        q.and(q.eq(q.field("userId"), args.callerId), q.eq(q.field("orgId"), args.orgId)),
      )
      .first();
    if (orgMembership?.role === "admin") {
      capabilities.add("__org_admin__");
    }

    return Array.from(capabilities);
  },
});

export const getRoleCapabilityNames = internalQuery({
  args: { roleId: v.id("roles") },
  handler: async (ctx, args): Promise<string[]> => {
    const roleCaps = await ctx.db
      .query("role_capabilities")
      .filter((q) => q.eq(q.field("roleId"), args.roleId))
      .collect();
    const names: string[] = [];
    for (const rc of roleCaps) {
      const cap = await ctx.db.get(rc.capabilityId);
      if (cap) names.push(cap.name);
    }
    return names;
  },
});

type EffectiveAccess = {
  workspaceAccess: { role: string; source: string; expiresAt?: number } | null;
  resourceAccess: Array<{
    resourceType: string;
    resourceId: string;
    effectiveRole: string | null;
    source: string;
    expiresAt?: number;
    deniedBy?: string;
  }>;
};

function computeDelta(before: EffectiveAccess, after: EffectiveAccess) {
  const beforeKeys = new Map(
    before.resourceAccess.map((r) => [`${r.resourceType}:${r.resourceId}`, r]),
  );
  const afterKeys = new Map(
    after.resourceAccess.map((r) => [`${r.resourceType}:${r.resourceId}`, r]),
  );

  const gained: typeof before.resourceAccess = [];
  const lost: typeof before.resourceAccess = [];

  for (const [key, afterEntry] of afterKeys) {
    const beforeEntry = beforeKeys.get(key);
    if (!beforeEntry && afterEntry.effectiveRole !== null) {
      gained.push(afterEntry);
    } else if (beforeEntry && beforeEntry.effectiveRole !== null && afterEntry.effectiveRole === null) {
      lost.push(afterEntry);
    }
  }

  for (const [key, beforeEntry] of beforeKeys) {
    if (!afterKeys.has(key) && beforeEntry.effectiveRole !== null) {
      // resource disappeared from after (shouldn't happen in simulate, but handle it)
      lost.push(beforeEntry);
    }
  }

  return { gained, lost };
}

export const simulateBinding = internalAction({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    roleId: v.id("roles"),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    parentResourceId: v.optional(v.string()),
    type: v.optional(v.union(v.literal("allow"), v.literal("deny"))),
  },
  handler: async (ctx, args) => {
    // ── Passo 1: no-privilege-escalation check ────────────────────────────────
    const caller = await ctx.runQuery(internal.bindingsSimulate.resolveCallerCapabilities, {
      callerId: args.callerId,
      workspaceId: args.workspaceId,
      orgId: args.orgId,
    });

    const callerCaps = new Set(caller);
    const isRoot = callerCaps.has("*");

    if (!isRoot) {
      const roleCaps: string[] = await ctx.runQuery(internal.bindingsSimulate.getRoleCapabilityNames, {
        roleId: args.roleId,
      });
      for (const cap of roleCaps) {
        if (!callerCaps.has(cap)) {
          throw new Error(`forbidden: no_privilege_escalation (missing capability: ${cap})`);
        }
      }
    }

    // ── Passo 2: before ───────────────────────────────────────────────────────
    const before: EffectiveAccess = await ctx.runQuery(internal.effectiveAccess.computeEffectiveAccess, {
      userId: args.userId,
      workspaceId: args.workspaceId,
      orgId: args.orgId,
    });

    // ── Passo 3: after (com binding hipotético em memória) ────────────────────
    const hypotheticalBinding = {
      _id: "hypothetical" as never,
      _creationTime: Date.now(),
      userId: args.userId,
      roleId: args.roleId,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      parentResourceId: args.parentResourceId,
      workspaceId: args.workspaceId,
      type: args.type ?? "allow",
    };

    const after: EffectiveAccess = await ctx.runQuery(internal.effectiveAccess.computeEffectiveAccess, {
      userId: args.userId,
      workspaceId: args.workspaceId,
      orgId: args.orgId,
      extraBindings: [hypotheticalBinding],
    });

    // ── Passos 4-5: delta ─────────────────────────────────────────────────────
    const delta = computeDelta(before, after);

    return {
      simulated: true as const,
      before,
      after,
      delta,
    };
  },
});
