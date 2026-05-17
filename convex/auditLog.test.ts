/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import argon2 from "argon2";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setupBase(t: ReturnType<typeof convexTest>) {
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

  await t.run((ctx) => ctx.db.insert("roles", { name: "admin", isBase: true }));

  const PASSWORD = "admin-secret-123";
  const passwordHash = await argon2.hash(PASSWORD);

  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail: "admin@acme.io",
  });

  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );
  await t.run((ctx) => ctx.db.patch(adminUser!._id, { passwordHash }));
  const adminId = adminUser!._id;

  const workspaceId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Main Workspace",
  });

  const editorRole = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "editor", isBase: true }),
  );

  return { rootId, orgId, adminId, workspaceId, editorRole, PASSWORD };
}

// ── Ciclo 1: sequência de eventos ────────────────────────────────────────────

test("sequência login → createBinding → deleteBinding gera 3 eventos na ordem correta", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, adminId, workspaceId, editorRole, PASSWORD } = await setupBase(t);

  // login gera auth.login.success
  const loginResult = await t.action(internal.auth.loginWithPassword, {
    email: "admin@acme.io",
    password: PASSWORD,
  });
  expect(loginResult.success).toBe(true);

  // createBinding gera binding.create
  await t.mutation(internal.bindings.createBinding, {
    callerId: adminId,
    orgId,
    workspaceId,
    userId: adminId,
    roleId: editorRole,
    resourceType: "document",
    resourceId: "doc_abc",
  });

  // consultar bindings para obter o ID
  const bindings = await t.run((ctx) => ctx.db.query("bindings").collect());
  expect(bindings.length).toBeGreaterThan(0);
  const bindingId = bindings[bindings.length - 1]._id;

  // deleteBinding gera binding.delete
  await t.mutation(internal.bindings.deleteBinding, {
    callerId: adminId,
    orgId,
    workspaceId,
    bindingId,
  });

  // verificar 3 eventos na ordem correta
  const events = await t.run((ctx) =>
    ctx.db.query("audit_log").withIndex("by_orgId_and_timestamp").collect(),
  );

  const actions = events.map((e) => e.action);
  expect(actions).toContain("auth.login.success");
  expect(actions).toContain("binding.create");
  expect(actions).toContain("binding.delete");

  const loginIdx = actions.indexOf("auth.login.success");
  const createIdx = actions.indexOf("binding.create");
  const deleteIdx = actions.indexOf("binding.delete");
  expect(loginIdx).toBeLessThan(createIdx);
  expect(createIdx).toBeLessThan(deleteIdx);
});

// ── Ciclo 2: listAuditLog — testes de controle de acesso ─────────────────────

test("listAuditLog: Root acessa logs de qualquer org", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId } = await setupBase(t);

  // gerar ao menos 1 evento
  await t.mutation(internal.bindings.createBinding, {
    callerId: rootId,
    orgId,
    workspaceId: (await t.run((ctx) => ctx.db.query("workspaces").first()))!._id,
    userId: rootId,
    roleId: (await t.run((ctx) => ctx.db.query("roles").first()))!._id,
    resourceType: "document",
    resourceId: "doc_1",
  });

  const result = await t.query(internal.auditLog.listAuditLog, {
    callerId: rootId,
    orgId,
    paginationOpts: { numItems: 10, cursor: null },
  });

  expect(result.page.length).toBeGreaterThan(0);
  expect(result.isDone).toBeDefined();
});

test("listAuditLog: Org Admin acessa apenas logs da própria org", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, adminId, workspaceId, editorRole } = await setupBase(t);

  // criar segunda org
  const { orgId: org2Id } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Other Corp",
    adminEmail: "admin2@other.io",
  });

  // gerar evento na org1
  await t.mutation(internal.bindings.createBinding, {
    callerId: adminId,
    orgId,
    workspaceId,
    userId: adminId,
    roleId: editorRole,
    resourceType: "document",
    resourceId: "doc_1",
  });

  // Org Admin da org1 consegue ver logs da org1
  const result = await t.query(internal.auditLog.listAuditLog, {
    callerId: adminId,
    orgId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(result.page.length).toBeGreaterThan(0);

  // Org Admin da org1 NÃO consegue ver logs da org2
  await expect(
    t.query(internal.auditLog.listAuditLog, {
      callerId: adminId,
      orgId: org2Id,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).rejects.toThrow("forbidden");
});

test("listAuditLog: WS Admin acessa apenas logs do próprio workspace", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, adminId, workspaceId, editorRole } = await setupBase(t);

  // criar workspace2
  const ws2Id = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Workspace 2",
  });

  // criar usuário membro apenas do workspace1
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
    ctx.db.insert("org_members", {
      userId: memberId,
      orgId,
      role: "member",
      status: "active",
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", {
      userId: memberId,
      workspaceId,
      status: "active",
    }),
  );

  // gerar evento no workspace1
  await t.mutation(internal.bindings.createBinding, {
    callerId: adminId,
    orgId,
    workspaceId,
    userId: adminId,
    roleId: editorRole,
    resourceType: "document",
    resourceId: "doc_1",
  });

  // WS Admin acessa logs do workspace1
  const result = await t.query(internal.auditLog.listAuditLog, {
    callerId: memberId,
    orgId,
    workspaceId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(result.page.length).toBeGreaterThan(0);

  // WS Admin não acessa logs do workspace2 (não é membro)
  await expect(
    t.query(internal.auditLog.listAuditLog, {
      callerId: memberId,
      orgId,
      workspaceId: ws2Id,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 3: endpoint HTTP GET /v1/audit-log ─────────────────────────────────

test("GET /v1/audit-log: retorna 401 sem token", async () => {
  const t = convexTest(schema, modules);
  const res = await t.fetch("/v1/audit-log", { method: "GET" });
  expect(res.status).toBe(401);
});

test("GET /v1/audit-log: Org Admin recebe logs da própria org com status 200", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId, workspaceId, editorRole, PASSWORD } = await setupBase(t);

  await t.mutation(internal.bindings.createBinding, {
    callerId: adminId,
    orgId,
    workspaceId,
    userId: adminId,
    roleId: editorRole,
    resourceType: "document",
    resourceId: "doc_http",
  });

  const login = await t.action(internal.auth.loginWithPassword, {
    email: "admin@acme.io",
    password: PASSWORD,
  });
  if (!login.success) throw new Error("login failed");

  const res = await t.fetch(`/v1/audit-log?orgId=${orgId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${login.accessToken}` },
  });
  expect(res.status).toBe(200);
  const body = await res.json() as { logs: unknown[]; isDone: boolean };
  expect(Array.isArray(body.logs)).toBe(true);
  expect(body.logs.length).toBeGreaterThan(0);
  expect(body.isDone).toBeDefined();
});

test("GET /v1/audit-log: filtro action funciona via query param", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId, workspaceId, editorRole, PASSWORD } = await setupBase(t);

  await t.mutation(internal.bindings.createBinding, {
    callerId: adminId,
    orgId,
    workspaceId,
    userId: adminId,
    roleId: editorRole,
    resourceType: "document",
    resourceId: "doc_filter2",
  });

  const login = await t.action(internal.auth.loginWithPassword, {
    email: "admin@acme.io",
    password: PASSWORD,
  });
  if (!login.success) throw new Error("login failed");

  const res = await t.fetch(`/v1/audit-log?orgId=${orgId}&action=binding.create`, {
    method: "GET",
    headers: { Authorization: `Bearer ${login.accessToken}` },
  });
  expect(res.status).toBe(200);
  const body = await res.json() as { logs: Array<{ action: string }> };
  expect(body.logs.every((e) => e.action === "binding.create")).toBe(true);
});

test("listAuditLog: filtros action e result funcionam corretamente", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, adminId, workspaceId, editorRole } = await setupBase(t);

  await t.mutation(internal.bindings.createBinding, {
    callerId: adminId,
    orgId,
    workspaceId,
    userId: adminId,
    roleId: editorRole,
    resourceType: "document",
    resourceId: "doc_filter",
  });

  const result = await t.query(internal.auditLog.listAuditLog, {
    callerId: rootId,
    orgId,
    action: "binding.create",
    result: "allow",
    paginationOpts: { numItems: 10, cursor: null },
  });

  expect(result.page.every((e) => e.action === "binding.create")).toBe(true);
  expect(result.page.every((e) => e.result === "allow")).toBe(true);
});

// ── listAuditLogQuery (real-time, public query) ───────────────────────────────

async function setupForAuditLogQuery(t: ReturnType<typeof convexTest>) {
  await t.action(internal.jwt.initializeKeyPair, {});

  const rootId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root2@gatekey.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );
  await t.run((ctx) => ctx.db.insert("roles", { name: "admin", isBase: true }));

  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Audit Corp",
    adminEmail: "audit-admin@acme.io",
  });

  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "audit-admin@acme.io")).first(),
  );
  const adminId = adminUser!._id;

  const token = await t.action(internal.jwt.signJwt, {
    sub: adminId as string,
    orgId: orgId as string,
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "test-session",
    expiresInSeconds: 3600,
  });

  return { rootId, orgId, adminId, token };
}

test("listAuditLogQuery: retorna eventos paginados da org com JWT válido", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId, token } = await setupForAuditLogQuery(t);

  await t.mutation(internal.auditLog.writeAuditEvent, {
    actorType: "user",
    actorId: adminId as string,
    action: "user.create",
    target: { type: "users", id: "some-id" },
    orgId,
    result: "allow",
  });

  const result = await t.query(api.auditLog.listAuditLogQuery, {
    token,
    orgId,
    paginationOpts: { numItems: 10, cursor: null },
  });

  expect(result.page.length).toBeGreaterThan(0);
  expect(result.page[0]).not.toHaveProperty("passwordHash");
});

test("listAuditLogQuery: novo evento aparece sem refresh manual", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId, token } = await setupForAuditLogQuery(t);

  const before = await t.query(api.auditLog.listAuditLogQuery, {
    token,
    orgId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  const countBefore = before.page.length as number;

  await t.mutation(internal.auditLog.writeAuditEvent, {
    actorType: "user",
    actorId: adminId as string,
    action: "test.event",
    target: { type: "test", id: "t1" },
    orgId,
    result: "allow",
  });

  const after = await t.query(api.auditLog.listAuditLogQuery, {
    token,
    orgId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(after.page.length).toBe(countBefore + 1);
});

test("listAuditLogQuery: retorna página vazia com token inválido", async () => {
  const t = convexTest(schema, modules);
  const { orgId } = await setupForAuditLogQuery(t);

  const result = await t.query(api.auditLog.listAuditLogQuery, {
    token: "invalid.token.here",
    orgId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(result.page).toEqual([]);
  expect(result.isDone).toBe(true);
});
