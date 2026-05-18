// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── Setup helpers ─────────────────────────────────────────────────────────────

async function setupBase(t: ReturnType<typeof convexTest>) {
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

  // roles base necessários
  await t.run((ctx) =>
    ctx.db.insert("roles", { name: "admin", isBase: true }),
  );
  const editorRoleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "editor", isBase: true }),
  );

  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail: "admin@acme.io",
  });

  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );
  const adminId = adminUser!._id;

  const workspaceId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Main Workspace",
  });

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
    ctx.db.insert("org_members", {
      userId,
      orgId,
      role: "member",
      status: "active",
    }),
  );

  await t.run((ctx) =>
    ctx.db.insert("workspace_members", {
      userId,
      workspaceId,
      status: "active",
    }),
  );

  return { rootId, orgId, adminId, workspaceId, userId, editorRoleId };
}

// ── Ciclo 1: sem binding → resultado vazio ────────────────────────────────────

test("computeEffectiveAccess: usuário sem bindings retorna workspaceAccess null e resourceAccess vazio", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId, orgId } = await setupBase(t);

  const result = await t.query(internal.effectiveAccess.computeEffectiveAccess, {
    userId,
    workspaceId,
    orgId,
  });

  expect(result).toEqual({ workspaceAccess: null, resourceAccess: [] });
});

// ── Ciclo 2: workspace-level binding ─────────────────────────────────────────

test("computeEffectiveAccess: binding workspace-level retorna workspaceAccess com role e source", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId, orgId, editorRoleId } = await setupBase(t);

  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId: editorRoleId,
      resourceType: "workspace",
      workspaceId,
    }),
  );

  const result = await t.query(internal.effectiveAccess.computeEffectiveAccess, {
    userId,
    workspaceId,
    orgId,
  });

  expect(result.workspaceAccess).toMatchObject({
    role: "editor",
    source: "workspace-binding",
  });
  expect(result.resourceAccess).toEqual([]);
});

// ── Ciclo 3: direct binding ───────────────────────────────────────────────────

test("computeEffectiveAccess: binding direto em resource retorna entrada em resourceAccess com source direct-binding", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId, orgId, editorRoleId } = await setupBase(t);

  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId: editorRoleId,
      resourceType: "document",
      resourceId: "doc_abc",
      workspaceId,
    }),
  );

  const result = await t.query(internal.effectiveAccess.computeEffectiveAccess, {
    userId,
    workspaceId,
    orgId,
  });

  expect(result.workspaceAccess).toBeNull();
  expect(result.resourceAccess).toHaveLength(1);
  expect(result.resourceAccess[0]).toMatchObject({
    resourceType: "document",
    resourceId: "doc_abc",
    effectiveRole: "editor",
    source: "direct-binding",
  });
});

// ── Ciclo 4: expiresAt no passado ────────────────────────────────────────────

test("computeEffectiveAccess: binding com expiresAt no passado é excluído dos resultados", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId, orgId, editorRoleId } = await setupBase(t);

  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId: editorRoleId,
      resourceType: "document",
      resourceId: "doc_expired",
      workspaceId,
      expiresAt: Date.now() - 1000,
    }),
  );

  const result = await t.query(internal.effectiveAccess.computeEffectiveAccess, {
    userId,
    workspaceId,
    orgId,
  });

  expect(result.resourceAccess).toEqual([]);
});

// ── Ciclo 5: deny binding ─────────────────────────────────────────────────────

test("computeEffectiveAccess: deny binding em resource retorna effectiveRole null com source explicit-deny", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId, orgId, adminId, editorRoleId } = await setupBase(t);

  // allow no workspace
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId: editorRoleId,
      resourceType: "workspace",
      workspaceId,
    }),
  );

  // deny explícito em doc_xyz
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId: editorRoleId,
      resourceType: "document",
      resourceId: "doc_xyz",
      workspaceId,
      type: "deny",
      deniedBy: adminId,
    }),
  );

  const result = await t.query(internal.effectiveAccess.computeEffectiveAccess, {
    userId,
    workspaceId,
    orgId,
  });

  expect(result.workspaceAccess).toMatchObject({ role: "editor" });
  const denied = result.resourceAccess.find((r) => r.resourceId === "doc_xyz");
  expect(denied).toMatchObject({
    effectiveRole: null,
    source: "explicit-deny",
    deniedBy: adminId,
  });
});

// ── Ciclo 6: herança de container ─────────────────────────────────────────────

test("computeEffectiveAccess: binding em container com inheritanceMode auto gera entradas de filhos com source inherited", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId, orgId, editorRoleId } = await setupBase(t);

  // registrar resource types com herança
  await t.run((ctx) =>
    ctx.db.insert("resource_types", {
      orgId,
      name: "document",
      inheritsFrom: "folder",
      inheritanceMode: "auto",
    }),
  );

  // binding de usuário em folder "folder_1"
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId: editorRoleId,
      resourceType: "folder",
      resourceId: "folder_1",
      workspaceId,
    }),
  );

  // recurso filho que aponta para o container
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId: editorRoleId,
      resourceType: "document",
      resourceId: "doc_child",
      parentResourceId: "folder_1",
      workspaceId,
    }),
  );

  const result = await t.query(internal.effectiveAccess.computeEffectiveAccess, {
    userId,
    workspaceId,
    orgId,
  });

  const inherited = result.resourceAccess.find((r) => r.resourceId === "doc_child");
  expect(inherited).toMatchObject({
    resourceType: "document",
    resourceId: "doc_child",
    effectiveRole: "editor",
    source: "inherited-from-folder:folder_1",
  });
});

// ── Ciclo 7: deny container-level aparece em filhos ───────────────────────────

test("computeEffectiveAccess: deny em container-level aparece em resourceAccess de cada item filho", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId, orgId, adminId, editorRoleId } = await setupBase(t);

  await t.run((ctx) =>
    ctx.db.insert("resource_types", {
      orgId,
      name: "document",
      inheritsFrom: "folder",
      inheritanceMode: "auto",
    }),
  );

  // deny no container folder_1
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId: editorRoleId,
      resourceType: "folder",
      resourceId: "folder_deny",
      workspaceId,
      type: "deny",
      deniedBy: adminId,
    }),
  );

  // filho desse container
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId: editorRoleId,
      resourceType: "document",
      resourceId: "doc_in_denied_folder",
      parentResourceId: "folder_deny",
      workspaceId,
    }),
  );

  const result = await t.query(internal.effectiveAccess.computeEffectiveAccess, {
    userId,
    workspaceId,
    orgId,
  });

  const entry = result.resourceAccess.find((r) => r.resourceId === "doc_in_denied_folder");
  expect(entry).toMatchObject({
    effectiveRole: null,
    source: "explicit-deny",
  });
});

// ── Ciclo 9 HTTP: sem workspaceId → 400 ──────────────────────────────────────

test("GET /v1/users/:id/effective-access: sem workspaceId retorna 400", async () => {
  const t = convexTest(schema, modules);
  const { rootId, userId } = await setupBase(t);
  await t.action(internal.jwt.initializeKeyPair, {});

  const token = await t.action(internal.jwt.signJwt, {
    sub: String(rootId),
    orgId: "fakeorg",
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "",
    expiresInSeconds: 3600,
  });

  const res = await t.fetch(`/v1/users/${String(userId)}/effective-access`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status).toBe(400);
});

// ── Ciclo 9 HTTP: Member → 403 ────────────────────────────────────────────────

test("GET /v1/users/:id/effective-access: Member chamando recebe 403", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId } = await setupBase(t);
  await t.action(internal.jwt.initializeKeyPair, {});

  // member user como caller
  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "member2@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) => ctx.db.insert("org_members", { userId: memberId, orgId, role: "member", status: "active" }));
  await t.run((ctx) => ctx.db.insert("workspace_members", { userId: memberId, workspaceId, status: "active" }));

  const token = await t.action(internal.jwt.signJwt, {
    sub: String(memberId),
    orgId: String(orgId),
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "",
    expiresInSeconds: 3600,
  });

  const res = await t.fetch(
    `/v1/users/${String(userId)}/effective-access?workspaceId=${String(workspaceId)}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
  );

  expect(res.status).toBe(403);
});

// ── Ciclo 9 HTTP: Root → 200 ──────────────────────────────────────────────────

test("GET /v1/users/:id/effective-access: Root recebe 200 com estrutura correta", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, workspaceId, userId, editorRoleId } = await setupBase(t);
  await t.action(internal.jwt.initializeKeyPair, {});

  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId: editorRoleId,
      resourceType: "workspace",
      workspaceId,
    }),
  );

  const token = await t.action(internal.jwt.signJwt, {
    sub: String(rootId),
    orgId: String(orgId),
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "",
    expiresInSeconds: 3600,
  });

  const res = await t.fetch(
    `/v1/users/${String(userId)}/effective-access?workspaceId=${String(workspaceId)}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.workspaceAccess).toMatchObject({ role: "editor", source: "workspace-binding" });
  expect(body.resourceAccess).toEqual([]);
});

// ── Ciclo 10 HTTP: workspace editor + deny em doc_xyz ─────────────────────────

test("GET /v1/users/:id/effective-access integração: workspace editor + deny explícito em doc_xyz", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, workspaceId, userId, adminId, editorRoleId } = await setupBase(t);
  await t.action(internal.jwt.initializeKeyPair, {});

  await t.run((ctx) =>
    ctx.db.insert("bindings", { userId, roleId: editorRoleId, resourceType: "workspace", workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId, roleId: editorRoleId, resourceType: "document", resourceId: "doc_xyz",
      workspaceId, type: "deny", deniedBy: adminId,
    }),
  );

  const token = await t.action(internal.jwt.signJwt, {
    sub: String(rootId), orgId: String(orgId), workspaceIds: [], roles: {}, capabilities: [], sessionId: "", expiresInSeconds: 3600,
  });

  const res = await t.fetch(
    `/v1/users/${String(userId)}/effective-access?workspaceId=${String(workspaceId)}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.workspaceAccess?.role).toBe("editor");
  const denied = body.resourceAccess.find((r: { resourceId: string }) => r.resourceId === "doc_xyz");
  expect(denied).toMatchObject({ effectiveRole: null, source: "explicit-deny" });
});

// ── Ciclo 10 HTTP: binding expirado não aparece ───────────────────────────────

test("GET /v1/users/:id/effective-access integração: binding expirado não aparece", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, workspaceId, userId, editorRoleId } = await setupBase(t);
  await t.action(internal.jwt.initializeKeyPair, {});

  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId, roleId: editorRoleId, resourceType: "document", resourceId: "doc_exp",
      workspaceId, expiresAt: Date.now() - 1000,
    }),
  );

  const token = await t.action(internal.jwt.signJwt, {
    sub: String(rootId), orgId: String(orgId), workspaceIds: [], roles: {}, capabilities: [], sessionId: "", expiresInSeconds: 3600,
  });

  const res = await t.fetch(
    `/v1/users/${String(userId)}/effective-access?workspaceId=${String(workspaceId)}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.workspaceAccess).toBeNull();
  expect(body.resourceAccess).toEqual([]);
});

// ── Ciclo 10 HTTP: apenas doc_abc ────────────────────────────────────────────

test("GET /v1/users/:id/effective-access integração: sem workspace binding mas com allow em doc_abc", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, workspaceId, userId, editorRoleId } = await setupBase(t);
  await t.action(internal.jwt.initializeKeyPair, {});

  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId, roleId: editorRoleId, resourceType: "document", resourceId: "doc_abc", workspaceId,
    }),
  );

  const token = await t.action(internal.jwt.signJwt, {
    sub: String(rootId), orgId: String(orgId), workspaceIds: [], roles: {}, capabilities: [], sessionId: "", expiresInSeconds: 3600,
  });

  const res = await t.fetch(
    `/v1/users/${String(userId)}/effective-access?workspaceId=${String(workspaceId)}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.workspaceAccess).toBeNull();
  expect(body.resourceAccess).toHaveLength(1);
  expect(body.resourceAccess[0].resourceId).toBe("doc_abc");
});

// ── Ciclo 10 HTTP: Org Admin de org_A não acessa usuário de org_B ────────────

test("GET /v1/users/:id/effective-access integração: Org Admin de org_A não consegue chamar para usuário de org_B", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, workspaceId } = await setupBase(t);
  await t.action(internal.jwt.initializeKeyPair, {});

  // criar org_B
  const orgBId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Org B", status: "active", updatedAt: Date.now() }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_settings", {
      orgId: orgBId, loginMethods: ["email_password"], mfaRequired: false,
      jwtExpiryAccess: 3600, jwtExpiryRefresh: 2592000, quotas: {},
    }),
  );

  // usuário de org_B
  const userBId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "userb@orgb.io", passwordHash: "hash", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );
  await t.run((ctx) => ctx.db.insert("org_members", { userId: userBId, orgId: orgBId, role: "member", status: "active" }));

  // admin de org_A tenta acessar usuário de org_B
  const adminAId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "adminA@acme.io", passwordHash: "hash", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );
  await t.run((ctx) => ctx.db.insert("org_members", { userId: adminAId, orgId, role: "admin", status: "active" }));

  const token = await t.action(internal.jwt.signJwt, {
    sub: String(adminAId), orgId: String(orgId), workspaceIds: [], roles: {}, capabilities: [], sessionId: "", expiresInSeconds: 3600,
  });

  const res = await t.fetch(
    `/v1/users/${String(userBId)}/effective-access?workspaceId=${String(workspaceId)}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
  );

  expect(res.status).toBe(403);
});

// ── Ciclo 10 HTTP: folder + inheritanceMode ───────────────────────────────────

test("GET /v1/users/:id/effective-access integração: folder + inheritanceMode retorna filhos com source inherited", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, workspaceId, userId, editorRoleId } = await setupBase(t);
  await t.action(internal.jwt.initializeKeyPair, {});

  await t.run((ctx) =>
    ctx.db.insert("resource_types", { orgId, name: "document", inheritsFrom: "folder", inheritanceMode: "auto" }),
  );

  await t.run((ctx) =>
    ctx.db.insert("bindings", { userId, roleId: editorRoleId, resourceType: "folder", resourceId: "folder_1", workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId, roleId: editorRoleId, resourceType: "document", resourceId: "doc_child",
      parentResourceId: "folder_1", workspaceId,
    }),
  );

  const token = await t.action(internal.jwt.signJwt, {
    sub: String(rootId), orgId: String(orgId), workspaceIds: [], roles: {}, capabilities: [], sessionId: "", expiresInSeconds: 3600,
  });

  const res = await t.fetch(
    `/v1/users/${String(userId)}/effective-access?workspaceId=${String(workspaceId)}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  const inherited = body.resourceAccess.find((r: { resourceId: string }) => r.resourceId === "doc_child");
  expect(inherited).toMatchObject({ source: "inherited-from-folder:folder_1" });
});

// ── Ciclo 8: apenas resource binding ─────────────────────────────────────────

test("computeEffectiveAccess: usuário com binding exclusivamente em resource-level tem workspaceAccess null", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId, orgId, editorRoleId } = await setupBase(t);

  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId: editorRoleId,
      resourceType: "document",
      resourceId: "doc_abc",
      workspaceId,
    }),
  );

  const result = await t.query(internal.effectiveAccess.computeEffectiveAccess, {
    userId,
    workspaceId,
    orgId,
  });

  expect(result.workspaceAccess).toBeNull();
  expect(result.resourceAccess).toHaveLength(1);
  expect(result.resourceAccess[0].resourceId).toBe("doc_abc");
});
