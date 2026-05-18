// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setupSimulateContext(t: ReturnType<typeof convexTest>) {
  const rootId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root@gatekey.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );

  await t.run((ctx) =>
    ctx.db.insert("roles", { name: "admin", isBase: true }),
  );
  const editorRoleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "editor", isBase: true }),
  );

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme Corp", status: "active", updatedAt: Date.now() }),
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
    ctx.db.insert("workspaces", { orgId, name: "Main Workspace", status: "active" }),
  );

  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "member@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId, orgId, role: "member", status: "active" }),
  );
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", { userId, workspaceId, status: "active" }),
  );

  return { rootId, orgId, workspaceId, userId, editorRoleId };
}

// ── Ciclo 1: estrutura {before, after, delta} ─────────────────────────────────

test("simulateBinding: retorna {simulated, before, after, delta} para usuário sem bindings", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, workspaceId, userId, editorRoleId } = await setupSimulateContext(t);

  const result = await t.action(internal.bindingsSimulate.simulateBinding, {
    callerId: rootId,
    orgId,
    workspaceId,
    userId,
    roleId: editorRoleId,
    resourceType: "document",
    resourceId: "doc_new",
  });

  expect(result.simulated).toBe(true);
  expect(result.before).toMatchObject({ workspaceAccess: null, resourceAccess: [] });
  expect(result.after).toBeDefined();
  expect(result.delta).toMatchObject({ gained: expect.any(Array), lost: expect.any(Array) });
});

// ── Ciclo 2: allow binding → delta.gained ─────────────────────────────────────

test("simulateBinding: allow binding para usuário sem acesso mostra recurso em delta.gained", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, workspaceId, userId, editorRoleId } = await setupSimulateContext(t);

  const result = await t.action(internal.bindingsSimulate.simulateBinding, {
    callerId: rootId,
    orgId,
    workspaceId,
    userId,
    roleId: editorRoleId,
    resourceType: "document",
    resourceId: "doc_gained",
  });

  expect(result.delta.gained).toHaveLength(1);
  expect(result.delta.gained[0]).toMatchObject({
    resourceType: "document",
    resourceId: "doc_gained",
  });
  expect(result.delta.lost).toHaveLength(0);
});

// ── Ciclo 3: deny binding → delta.lost ───────────────────────────────────────

test("simulateBinding: deny binding para usuário com allow mostra recurso em delta.lost", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, workspaceId, userId, editorRoleId } = await setupSimulateContext(t);

  // usuário já tem allow em doc_existing
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId: editorRoleId,
      resourceType: "document",
      resourceId: "doc_existing",
      workspaceId,
    }),
  );

  const result = await t.action(internal.bindingsSimulate.simulateBinding, {
    callerId: rootId,
    orgId,
    workspaceId,
    userId,
    roleId: editorRoleId,
    resourceType: "document",
    resourceId: "doc_existing",
    type: "deny",
  });

  expect(result.delta.lost).toHaveLength(1);
  expect(result.delta.lost[0]).toMatchObject({
    resourceType: "document",
    resourceId: "doc_existing",
  });
  expect(result.delta.gained).toHaveLength(0);
});

// ── Ciclo 4: no-privilege-escalation ─────────────────────────────────────────

test("simulateBinding: role com capability que admin não possui lança no_privilege_escalation", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId, editorRoleId } = await setupSimulateContext(t);

  // criar admin com capability limitada
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "admin@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: adminId, orgId, role: "admin", status: "active" }),
  );

  // criar role com capability especial que admin não tem
  const specialCapId = await t.run((ctx) =>
    ctx.db.insert("capabilities", { orgId, name: "billing:admin", isBase: false, description: "Billing admin" }),
  );
  const specialRoleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "billing-admin", isBase: false, workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("role_capabilities", { roleId: specialRoleId, capabilityId: specialCapId }),
  );

  // admin não tem capabilities, tenta simular binding com role que exige billing:admin
  await expect(
    t.action(internal.bindingsSimulate.simulateBinding, {
      callerId: adminId,
      orgId,
      workspaceId,
      userId,
      roleId: specialRoleId,
      resourceType: "document",
      resourceId: "doc_test",
    }),
  ).rejects.toThrow("no_privilege_escalation");
});

// ── Ciclo 5: nenhum binding persistido ────────────────────────────────────────

test("simulateBinding: nenhum binding é persistido após a chamada", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, workspaceId, userId, editorRoleId } = await setupSimulateContext(t);

  const bindingsBefore = await t.run((ctx) =>
    ctx.db.query("bindings").collect(),
  );

  await t.action(internal.bindingsSimulate.simulateBinding, {
    callerId: rootId,
    orgId,
    workspaceId,
    userId,
    roleId: editorRoleId,
    resourceType: "document",
    resourceId: "doc_simulated",
  });

  const bindingsAfter = await t.run((ctx) =>
    ctx.db.query("bindings").collect(),
  );

  expect(bindingsAfter).toHaveLength(bindingsBefore.length);
});
