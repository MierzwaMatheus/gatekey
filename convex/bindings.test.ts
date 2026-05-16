/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import argon2 from "argon2";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setupOrgWithAdminAndWorkspaceAndToken(t: ReturnType<typeof convexTest>) {
  await t.action(internal.jwt.initializeKeyPair, {});

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

  const PASSWORD = "admin-secret-123";
  const passwordHash = await argon2.hash(PASSWORD);

  const orgId = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail: "admin@acme.io",
  });

  const adminUser = await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "admin@acme.io"))
      .first(),
  );
  await t.run((ctx) => ctx.db.patch(adminUser!._id, { passwordHash }));
  const adminId = adminUser!._id;

  const workspaceId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Main Workspace",
  });

  const login = await t.action(internal.auth.loginWithPassword, {
    email: "admin@acme.io",
    password: PASSWORD,
  });
  if (!login.success) throw new Error("login failed in test setup");
  const token = login.accessToken;

  return { rootId, orgId, adminId, workspaceId, token };
}

async function setupOrgWithAdminAndWorkspace(t: ReturnType<typeof convexTest>) {
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

  const orgId = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail: "admin@acme.io",
  });

  const adminUser = await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "admin@acme.io"))
      .first(),
  );
  const adminId = adminUser!._id;

  const workspaceId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Main Workspace",
  });

  return { rootId, orgId, adminId, workspaceId };
}

// ── Ciclo 1: createBinding ────────────────────────────────────────────────────

test("createBinding: cria binding e retorna id, userId, roleId, resourceType, workspaceId", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "member@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  await t.run((ctx) =>
    ctx.db.insert("workspace_members", {
      userId: memberId,
      workspaceId,
      status: "active",
    }),
  );

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId }),
  );

  const result = await t.mutation(internal.bindings.createBinding, {
    callerId: adminId,
    orgId,
    workspaceId,
    userId: memberId,
    roleId,
    resourceType: "workspace",
  });

  expect(result).toMatchObject({
    userId: memberId,
    roleId,
    resourceType: "workspace",
    workspaceId,
  });
  expect(result.id).toBeDefined();
});

// ── Ciclo 2: validação cross-workspace ───────────────────────────────────────

test("createBinding: lança invalid_role_workspace se roleId pertence a outro workspace", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const otherWorkspaceId = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId, name: "Other WS", status: "active" }),
  );

  const roleInOtherWs = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "editor", isBase: false, workspaceId: otherWorkspaceId }),
  );

  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "m@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  await expect(
    t.mutation(internal.bindings.createBinding, {
      callerId: adminId,
      orgId,
      workspaceId,
      userId: memberId,
      roleId: roleInOtherWs,
      resourceType: "workspace",
    }),
  ).rejects.toThrow("invalid_role_workspace");
});

test("createBinding: permite roleId base (isBase=true) independente do workspace", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const baseRoleId = await t.run((ctx) =>
    ctx.db.query("roles").filter((q) => q.eq(q.field("isBase"), true)).first().then((r) => r!._id),
  );

  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "m2@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const result = await t.mutation(internal.bindings.createBinding, {
    callerId: adminId,
    orgId,
    workspaceId,
    userId: memberId,
    roleId: baseRoleId,
    resourceType: "workspace",
  });

  expect(result.id).toBeDefined();
});

// ── Ciclo 3: listBindings ─────────────────────────────────────────────────────

test("listBindings: retorna todos os bindings do workspace", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "m3@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("bindings", { userId: memberId, roleId, resourceType: "workspace", workspaceId }),
  );

  const result = await t.query(internal.bindings.listBindings, {
    callerId: adminId,
    orgId,
    workspaceId,
  });

  expect(result.some((b) => b.userId === memberId)).toBe(true);
});

test("listBindings: filtra por userId quando fornecido", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const memberA = await t.run((ctx) =>
    ctx.db.insert("users", { email: "a@acme.io", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );
  const memberB = await t.run((ctx) =>
    ctx.db.insert("users", { email: "b@acme.io", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );
  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("bindings", { userId: memberA, roleId, resourceType: "workspace", workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("bindings", { userId: memberB, roleId, resourceType: "workspace", workspaceId }),
  );

  const result = await t.query(internal.bindings.listBindings, {
    callerId: adminId,
    orgId,
    workspaceId,
    userId: memberA,
  });

  expect(result.every((b) => b.userId === memberA)).toBe(true);
  expect(result.some((b) => b.userId === memberB)).toBe(false);
});

test("listBindings: filtra por resourceType quando fornecido", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "c@acme.io", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );
  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("bindings", { userId: memberId, roleId, resourceType: "document", workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("bindings", { userId: memberId, roleId, resourceType: "folder", workspaceId }),
  );

  const result = await t.query(internal.bindings.listBindings, {
    callerId: adminId,
    orgId,
    workspaceId,
    resourceType: "document",
  });

  expect(result.every((b) => b.resourceType === "document")).toBe(true);
});

test("listBindings: lança forbidden se caller não é admin da org", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const nonAdminId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "x@acme.io", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );

  await expect(
    t.query(internal.bindings.listBindings, {
      callerId: nonAdminId,
      orgId,
      workspaceId,
    }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 4: deleteBinding ────────────────────────────────────────────────────

test("deleteBinding: remove binding existente e retorna null", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "del@acme.io", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );
  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId }),
  );
  const bindingId = await t.run((ctx) =>
    ctx.db.insert("bindings", { userId: memberId, roleId, resourceType: "workspace", workspaceId }),
  );

  const result = await t.mutation(internal.bindings.deleteBinding, {
    callerId: adminId,
    orgId,
    workspaceId,
    bindingId,
  });

  expect(result).toBeNull();

  const gone = await t.run((ctx) => ctx.db.get(bindingId));
  expect(gone).toBeNull();
});

test("deleteBinding: lança not_found se binding não existe", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "temp", isBase: false, workspaceId }),
  );
  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "temp@acme.io", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );
  const bindingId = await t.run((ctx) =>
    ctx.db.insert("bindings", { userId: memberId, roleId, resourceType: "workspace", workspaceId }),
  );
  await t.run((ctx) => ctx.db.delete(bindingId));

  await expect(
    t.mutation(internal.bindings.deleteBinding, {
      callerId: adminId,
      orgId,
      workspaceId,
      bindingId,
    }),
  ).rejects.toThrow("not_found");
});

test("deleteBinding: lança forbidden se binding pertence a outro workspace", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const otherWsId = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId, name: "Other", status: "active" }),
  );
  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId: otherWsId }),
  );
  const bindingId = await t.run((ctx) =>
    ctx.db.insert("bindings", { userId: adminId, roleId, resourceType: "workspace", workspaceId: otherWsId }),
  );

  await expect(
    t.mutation(internal.bindings.deleteBinding, {
      callerId: adminId,
      orgId,
      workspaceId,
      bindingId,
    }),
  ).rejects.toThrow("forbidden");
});

test("createBinding: lança forbidden se caller não é admin da org", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const nonAdminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "nonadmin@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId }),
  );

  await expect(
    t.mutation(internal.bindings.createBinding, {
      callerId: nonAdminId,
      orgId,
      workspaceId,
      userId: nonAdminId,
      roleId,
      resourceType: "workspace",
    }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 5: Rotas HTTP ───────────────────────────────────────────────────────

test("POST /v1/bindings: retorna 401 sem token", async () => {
  const t = convexTest(schema, modules);
  const res = await t.fetch("/v1/bindings", { method: "POST" });
  expect(res.status).toBe(401);
});

test("POST /v1/bindings: retorna 400 sem campos obrigatórios", async () => {
  const t = convexTest(schema, modules);
  const { token } = await setupOrgWithAdminAndWorkspaceAndToken(t);

  const res = await t.fetch("/v1/bindings", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ userId: "some-id" }),
  });
  expect(res.status).toBe(400);
});

test("POST /v1/bindings: cria binding e retorna 201", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId, token } = await setupOrgWithAdminAndWorkspaceAndToken(t);

  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "http-member@acme.io", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );
  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId }),
  );

  const res = await t.fetch("/v1/bindings", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ userId: memberId, roleId, resourceType: "workspace", workspaceId }),
  });
  expect(res.status).toBe(201);
  const body = await res.json() as { id: string };
  expect(body.id).toBeDefined();
});

test("POST /v1/bindings: roleId de outro workspace retorna 422", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, token } = await setupOrgWithAdminAndWorkspaceAndToken(t);

  const otherWsId = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId, name: "Other WS", status: "active" }),
  );
  const roleInOtherWs = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "editor", isBase: false, workspaceId: otherWsId }),
  );
  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "http2@acme.io", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );

  const res = await t.fetch("/v1/bindings", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ userId: memberId, roleId: roleInOtherWs, resourceType: "workspace", workspaceId }),
  });
  expect(res.status).toBe(422);
  const body = await res.json() as { error: string };
  expect(body.error).toBe("InvalidRoleWorkspace");
});

test("GET /v1/bindings: retorna 401 sem token", async () => {
  const t = convexTest(schema, modules);
  const res = await t.fetch("/v1/bindings?workspaceId=x", { method: "GET" });
  expect(res.status).toBe(401);
});

test("GET /v1/bindings: retorna 400 sem workspaceId", async () => {
  const t = convexTest(schema, modules);
  const { token } = await setupOrgWithAdminAndWorkspaceAndToken(t);

  const res = await t.fetch("/v1/bindings", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(400);
});

test("GET /v1/bindings: retorna lista de bindings do workspace", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, token } = await setupOrgWithAdminAndWorkspaceAndToken(t);

  const res = await t.fetch(`/v1/bindings?workspaceId=${workspaceId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
  const body = await res.json() as { bindings: unknown[] };
  expect(Array.isArray(body.bindings)).toBe(true);
});

test("DELETE /v1/bindings/:id: retorna 401 sem token", async () => {
  const t = convexTest(schema, modules);
  const res = await t.fetch("/v1/bindings/fake-id", { method: "DELETE" });
  expect(res.status).toBe(401);
});

test("DELETE /v1/bindings/:id: retorna 404 para binding inexistente", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, token } = await setupOrgWithAdminAndWorkspaceAndToken(t);

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "temp", isBase: false, workspaceId }),
  );
  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "del2@acme.io", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );
  const bindingId = await t.run((ctx) =>
    ctx.db.insert("bindings", { userId: memberId, roleId, resourceType: "workspace", workspaceId }),
  );
  await t.run((ctx) => ctx.db.delete(bindingId));

  const res = await t.fetch(`/v1/bindings/${bindingId}?workspaceId=${workspaceId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(404);
});

test("DELETE /v1/bindings/:id: remove binding e retorna success", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, token } = await setupOrgWithAdminAndWorkspaceAndToken(t);

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer2", isBase: false, workspaceId }),
  );
  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "del3@acme.io", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );
  const bindingId = await t.run((ctx) =>
    ctx.db.insert("bindings", { userId: memberId, roleId, resourceType: "workspace", workspaceId }),
  );

  const res = await t.fetch(`/v1/bindings/${bindingId}?workspaceId=${workspaceId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
  const body = await res.json() as { success: boolean };
  expect(body.success).toBe(true);
});
