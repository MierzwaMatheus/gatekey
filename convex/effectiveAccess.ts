// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";

async function resolveRoleName(ctx: QueryCtx, roleId: Id<"roles">): Promise<string> {
  const role = await ctx.db.get(roleId);
  return role?.name ?? "unknown";
}

export const computeEffectiveAccess = internalQuery({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    orgId: v.id("orgs"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Coletar todos os bindings do usuário no workspace
    const allBindings = await ctx.db
      .query("bindings")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId),
      )
      .collect();

    // Separar allow e deny, filtrando expirados
    const allowBindings = allBindings.filter(
      (b) =>
        (b.type === undefined || b.type === "allow") &&
        (b.expiresAt === undefined || b.expiresAt > now),
    );
    const denyBindings = allBindings.filter(
      (b) =>
        b.type === "deny" &&
        (b.expiresAt === undefined || b.expiresAt > now),
    );

    // ── Passo 1: workspace-level binding ─────────────────────────────────────
    const workspaceBinding = allowBindings.find(
      (b) => b.resourceId === undefined && b.resourceType === "workspace",
    );

    let workspaceAccess: { role: string; source: "workspace-binding"; expiresAt?: number } | null = null;
    if (workspaceBinding) {
      const roleName = await resolveRoleName(ctx, workspaceBinding.roleId);
      workspaceAccess = {
        role: roleName,
        source: "workspace-binding",
        ...(workspaceBinding.expiresAt ? { expiresAt: workspaceBinding.expiresAt } : {}),
      };
    }

    // ── Passo 2: resource-level allow bindings ────────────────────────────────
    type ResourceEntry = {
      resourceType: string;
      resourceId: string;
      effectiveRole: string | null;
      source: string;
      expiresAt?: number;
      deniedBy?: string;
    };

    const resourceMap = new Map<string, ResourceEntry>();

    for (const b of allowBindings) {
      if (b.resourceId === undefined || b.resourceType === "workspace") continue;

      const key = `${b.resourceType}:${b.resourceId}`;
      if (resourceMap.has(key)) continue;

      const roleName = await resolveRoleName(ctx, b.roleId);

      // Determinar source
      let source = "direct-binding";
      if (b.parentResourceId) {
        source = `inherited-from-${b.resourceType === "document" ? "folder" : b.resourceType}:${b.parentResourceId}`;
      }

      resourceMap.set(key, {
        resourceType: b.resourceType,
        resourceId: b.resourceId,
        effectiveRole: roleName,
        source,
        ...(b.expiresAt ? { expiresAt: b.expiresAt } : {}),
      });
    }

    // ── Passo 3: herança de container (bindings com parentResourceId) ─────────
    // Já tratado acima: bindings com parentResourceId recebem source "inherited-from-..."

    // ── Passo 6: aplicar deny-first ───────────────────────────────────────────
    for (const deny of denyBindings) {
      if (deny.resourceId === undefined) continue;

      const key = `${deny.resourceType}:${deny.resourceId}`;

      resourceMap.set(key, {
        resourceType: deny.resourceType,
        resourceId: deny.resourceId,
        effectiveRole: null,
        source: "explicit-deny",
        deniedBy: deny.deniedBy ? String(deny.deniedBy) : undefined,
      });

      // Deny em container: sobrescrever filhos que têm parentResourceId igual
      for (const [k, entry] of resourceMap.entries()) {
        if (
          entry.source.startsWith(`inherited-from-${deny.resourceType}:${deny.resourceId}`) ||
          (entry.source.includes(`:${deny.resourceId}`) && entry.effectiveRole !== null)
        ) {
          resourceMap.set(k, {
            ...entry,
            effectiveRole: null,
            source: "explicit-deny",
            deniedBy: deny.deniedBy ? String(deny.deniedBy) : undefined,
          });
        }
      }
    }

    // Deny de container-level: bindings de deny onde resourceId é um containerId
    for (const deny of denyBindings) {
      if (deny.resourceId === undefined) continue;
      // Verificar se existe algum filho que tem parentResourceId === deny.resourceId
      for (const [k, entry] of resourceMap.entries()) {
        const entrySource = entry.source;
        if (entrySource.endsWith(`:${deny.resourceId}`) && entry.effectiveRole !== null) {
          resourceMap.set(k, {
            ...entry,
            effectiveRole: null,
            source: "explicit-deny",
            deniedBy: deny.deniedBy ? String(deny.deniedBy) : undefined,
          });
        }
      }
    }

    return {
      workspaceAccess,
      resourceAccess: Array.from(resourceMap.values()),
    };
  },
});
