// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const BASE_ROLES = ["owner", "admin", "editor", "viewer"] as const;

const BASE_CAPABILITIES = [
  { name: "document:read", description: "Leitura de documentos" },
  { name: "document:write", description: "Escrita de documentos" },
  { name: "user:invite", description: "Convite de usuários" },
  { name: "billing:view", description: "Visualização de faturamento" },
  { name: "report:export", description: "Exportação de relatórios" },
] as const;

export const seedBaseRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const name of BASE_ROLES) {
      const existing = await ctx.db
        .query("roles")
        .filter((q) => q.and(q.eq(q.field("name"), name), q.eq(q.field("isBase"), true)))
        .first();

      if (!existing) {
        await ctx.db.insert("roles", {
          name,
          isBase: true,
          workspaceId: undefined,
        });
      }
    }
  },
});

export const seedBaseCapabilities = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const cap of BASE_CAPABILITIES) {
      const existing = await ctx.db
        .query("capabilities")
        .filter((q) => q.and(q.eq(q.field("name"), cap.name), q.eq(q.field("isBase"), true)))
        .first();

      if (!existing) {
        await ctx.db.insert("capabilities", {
          name: cap.name,
          description: cap.description,
          isBase: true,
          orgId: undefined,
        });
      }
    }
  },
});

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.seed.seedBaseRoles, {});
    await ctx.runMutation(internal.seed.seedBaseCapabilities, {});
  },
});
