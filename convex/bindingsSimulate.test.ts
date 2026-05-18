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

// ── Ciclos HTTP ───────────────────────────────────────────────────────────────

async function setupHttpContext(t: ReturnType<typeof convexTest>) {
  const ctx = await setupSimulateContext(t);
  await t.action(internal.jwt.initializeKeyPair, {});

  const rootToken = await t.action(internal.jwt.signJwt, {
    sub: String(ctx.rootId),
    orgId: String(ctx.orgId),
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "",
    expiresInSeconds: 3600,
  });

  return { ...ctx, rootToken };
}

test("POST /v1/bindings/simulate: simular allow binding → delta.gained contém recurso, nenhum binding na tabela", async () => {
  const t = convexTest(schema, modules);
  const { rootToken, orgId, workspaceId, userId, editorRoleId } = await setupHttpContext(t);

  const bindingsBefore = await t.run((ctx) => ctx.db.query("bindings").collect());

  const res = await t.fetch("/v1/bindings/simulate", {
    method: "POST",
    headers: { Authorization: `Bearer ${rootToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: String(userId),
      roleId: String(editorRoleId),
      workspaceId: String(workspaceId),
      resourceType: "document",
      resourceId: "doc_integration",
    }),
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.simulated).toBe(true);
  expect(body.delta.gained).toHaveLength(1);
  expect(body.delta.gained[0].resourceId).toBe("doc_integration");

  const bindingsAfter = await t.run((ctx) => ctx.db.query("bindings").collect());
  expect(bindingsAfter).toHaveLength(bindingsBefore.length);
});

test("POST /v1/bindings/simulate: simular deny binding → delta.lost contém recurso", async () => {
  const t = convexTest(schema, modules);
  const { rootToken, orgId, workspaceId, userId, editorRoleId } = await setupHttpContext(t);

  // usuário tem allow em doc_deny_test
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId: editorRoleId,
      resourceType: "document",
      resourceId: "doc_deny_test",
      workspaceId,
    }),
  );

  const res = await t.fetch("/v1/bindings/simulate", {
    method: "POST",
    headers: { Authorization: `Bearer ${rootToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: String(userId),
      roleId: String(editorRoleId),
      workspaceId: String(workspaceId),
      resourceType: "document",
      resourceId: "doc_deny_test",
      type: "deny",
    }),
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.simulated).toBe(true);
  expect(body.delta.lost).toHaveLength(1);
  expect(body.delta.lost[0].resourceId).toBe("doc_deny_test");
});

test("POST /v1/bindings/simulate: admin sem capability recebe 403 cannot_grant_capability", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId } = await setupHttpContext(t);
  await t.action(internal.jwt.initializeKeyPair, {});

  // criar admin com capability limitada
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "limited-admin@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: adminId, orgId, role: "admin", status: "active" }),
  );

  const adminToken = await t.action(internal.jwt.signJwt, {
    sub: String(adminId),
    orgId: String(orgId),
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "",
    expiresInSeconds: 3600,
  });

  // role com capability especial
  const capId = await t.run((ctx) =>
    ctx.db.insert("capabilities", { orgId, name: "super:write", isBase: false, description: "Super write" }),
  );
  const specialRoleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "super-role", isBase: false, workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("role_capabilities", { roleId: specialRoleId, capabilityId: capId }),
  );

  const res = await t.fetch("/v1/bindings/simulate", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: String(userId),
      roleId: String(specialRoleId),
      workspaceId: String(workspaceId),
      resourceType: "document",
      resourceId: "doc_priv",
    }),
  });

  expect(res.status).toBe(403);
  const body = await res.json();
  expect(body.reason).toBe("cannot_grant_capability");
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
