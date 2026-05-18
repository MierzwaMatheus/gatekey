// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setupBatchContext(t: ReturnType<typeof convexTest>) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "user@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );

  await t.run((ctx) =>
    ctx.db.insert("org_settings", {
      orgId,
      loginMethods: ["email_password"],
      mfaRequired: false,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 2592000,
      quotas: {},
    }),
  );

  const workspaceId = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId, name: "Main", status: "active" }),
  );

  await t.run((ctx) =>
    ctx.db.insert("workspace_members", { userId, workspaceId, status: "active" }),
  );

  const capabilityId = await t.run((ctx) =>
    ctx.db.insert("capabilities", {
      name: "document:read",
      description: "Read documents",
      isBase: true,
    }),
  );

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: true }),
  );

  await t.run((ctx) =>
    ctx.db.insert("role_capabilities", { roleId, capabilityId }),
  );

  return { userId, orgId, workspaceId, roleId };
}

// ── Ciclo 1: array vazio ─────────────────────────────────────────────────────

test("checkBatch: array vazio retorna array vazio", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId } = await setupBatchContext(t);

  const result = await t.action(internal.checkBatch.performCheckBatch, {
    callerId: userId,
    orgId,
    workspaceId,
    items: [],
  });

  expect(result).toEqual([]);
});

// ── Ciclo 2: usuário suspenso → user_inactive ─────────────────────────────────

test("checkBatch: item com usuário suspenso retorna user_inactive naquele índice", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId } = await setupBatchContext(t);

  await t.run(async (ctx) => {
    await ctx.db.patch(userId, { status: "suspended" });
  });

  const result = await t.action(internal.checkBatch.performCheckBatch, {
    callerId: userId,
    orgId,
    workspaceId,
    items: [
      { userId, capability: "document:read", resourceType: "document", resourceId: "doc_abc" },
    ],
  });

  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({ allowed: false, reason: "user_inactive" });
});

// ── Ciclo 3: sem binding → no_binding_found ───────────────────────────────────

test("checkBatch: item sem binding retorna no_binding_found naquele índice", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId } = await setupBatchContext(t);

  const result = await t.action(internal.checkBatch.performCheckBatch, {
    callerId: userId,
    orgId,
    workspaceId,
    items: [
      { userId, capability: "document:read", resourceType: "document", resourceId: "doc_xyz" },
    ],
  });

  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({ allowed: false, reason: "no_binding_found" });
});
