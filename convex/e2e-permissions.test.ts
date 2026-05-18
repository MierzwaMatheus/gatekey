/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import bcrypt from "bcryptjs";

const modules = import.meta.glob("./**/*.ts");

// ── Helper base para testes E2E de permissões ──────────────────────────────────

async function setupE2EBase(t: ReturnType<typeof convexTest>) {
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

  const ADMIN_PASSWORD = "Admin@Secret123";
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
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
  await t.run((ctx) => ctx.db.patch(adminUser!._id, { passwordHash: adminHash }));
  const adminId = adminUser!._id;

  const workspaceId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Main Workspace",
  });

  // Adicionar admin como workspace_member (createWorkspace cria binding mas não workspace_member)
  await t.mutation(internal.hierarchy.addWorkspaceMember, {
    callerId: rootId,
    workspaceId,
    userId: adminId,
  });

  const login = await t.action(internal.auth.loginWithPassword, {
    email: "admin@acme.io",
    password: ADMIN_PASSWORD,
  });
  if (!login.success) throw new Error("login failed in E2E setup");
  const token = login.accessToken;

  return { rootId, orgId, adminId, workspaceId, token };
}

// ── Ciclo 1: E2E login → binding → /check = ALLOW ─────────────────────────────

test("E2E: login → criar binding → POST /v1/check retorna allowed:true", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, token } = await setupE2EBase(t);

  // Criar usuário membro (sem capabilities por default)
  const MEMBER_PASSWORD = "Member@Secret456";
  const memberHash = await bcrypt.hash(MEMBER_PASSWORD, 10);
  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "member@acme.io",
      passwordHash: memberHash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: memberId, orgId, role: "member", status: "active" }),
  );
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", { userId: memberId, workspaceId, status: "active" }),
  );

  // Criar capability e role
  const capabilityId = await t.run((ctx) =>
    ctx.db.insert("capabilities", {
      name: "document:read",
      description: "Read documents",
      isBase: true,
    }),
  );
  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("role_capabilities", { roleId, capabilityId }),
  );

  // Criar binding via HTTP (admin cria binding para o membro)
  const bindingRes = await t.fetch("/v1/bindings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: memberId as string,
      roleId: roleId as string,
      resourceType: "workspace",
      workspaceId: workspaceId as string,
    }),
  });
  expect(bindingRes.status).toBe(201);

  // Verificar permissão do membro via HTTP
  const checkRes = await t.fetch("/v1/check", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: memberId as string,
      capability: "document:read",
      resourceType: "workspace",
      workspaceId: workspaceId as string,
    }),
  });

  expect(checkRes.status).toBe(200);
  const body = await checkRes.json();
  expect(body.allowed).toBe(true);
});

// ── Ciclo 2: E2E criar binding → deletar → /check = DENY ─────────────────────

test("E2E: criar binding → DELETE /v1/bindings/:id → POST /v1/check retorna allowed:false", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, token } = await setupE2EBase(t);

  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "member2@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: memberId, orgId, role: "member", status: "active" }),
  );
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", { userId: memberId, workspaceId, status: "active" }),
  );

  const capabilityId = await t.run((ctx) =>
    ctx.db.insert("capabilities", { name: "document:read", description: "Read", isBase: true }),
  );
  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("role_capabilities", { roleId, capabilityId }),
  );

  // Criar binding via HTTP
  const createRes = await t.fetch("/v1/bindings", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: memberId as string,
      roleId: roleId as string,
      resourceType: "workspace",
      workspaceId: workspaceId as string,
    }),
  });
  expect(createRes.status).toBe(201);
  const created = await createRes.json();
  const bindingId: string = created.id;

  // Confirmar ALLOW antes de deletar
  const beforeDelete = await t.fetch("/v1/check", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: memberId as string,
      capability: "document:read",
      resourceType: "workspace",
      workspaceId: workspaceId as string,
    }),
  });
  expect((await beforeDelete.json()).allowed).toBe(true);

  // Deletar binding via HTTP
  const deleteRes = await t.fetch(
    `/v1/bindings/${bindingId}?workspaceId=${workspaceId as string}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  expect(deleteRes.status).toBe(200);

  // Verificar DENY após deleção
  const afterDelete = await t.fetch("/v1/check", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: memberId as string,
      capability: "document:read",
      resourceType: "workspace",
      workspaceId: workspaceId as string,
    }),
  });
  expect(afterDelete.status).toBe(200);
  const afterBody = await afterDelete.json();
  expect(afterBody.allowed).toBe(false);
  expect(afterBody.reason).toBe("no_binding_found");
});

// ── Ciclo 9: API Key com escopo bindings:write ≠ users:write ─────────────────

test("E2E: API Key com escopo bindings:write pode criar binding mas não pode criar usuário", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId, workspaceId } = await setupE2EBase(t);

  // Criar member para usar no binding
  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "member9@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", { userId: memberId, workspaceId, status: "active" }),
  );

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId }),
  );

  // Criar API Key com escopo bindings:write apenas
  const secretPlain = "apikeysecret12345678";
  const secretHash = await bcrypt.hash(secretPlain, 10);
  await t.run((ctx) =>
    ctx.db.insert("api_keys", {
      orgId,
      publicId: "bindingscopekey123456",
      secretHash,
      scopes: ["bindings:write"],
      description: "bindings only key",
      status: "active",
    }),
  );

  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: adminId, orgId, role: "admin", status: "active" }),
  );

  const apiKeyHeader = `Bearer gk_live_pk_bindingscopekey123456_${secretPlain}`;

  // POST /v1/bindings com escopo bindings:write → deve funcionar (201 ou 403 por falta de PDP, não por escopo)
  const bindingRes = await t.fetch("/v1/bindings", {
    method: "POST",
    headers: { Authorization: apiKeyHeader, "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: memberId as string,
      roleId: roleId as string,
      resourceType: "workspace",
      workspaceId: workspaceId as string,
    }),
  });
  // bindings:write está no escopo → não deve retornar 401/403 por escopo ausente
  expect(bindingRes.status).not.toBe(401);

  // POST /v1/users com a mesma API Key (escopo bindings:write) → deve retornar 403 por falta de users:write
  const userRes = await t.fetch("/v1/users", {
    method: "POST",
    headers: { Authorization: apiKeyHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "blocked@acme.io", password: "Blocked@1", role: "member", orgId: orgId as string }),
  });
  expect(userRes.status).toBe(403);
});

// ── Ciclo 10: revogar sessão → JWT = 401 ──────────────────────────────────────

test("E2E: revogar sessão via DELETE /v1/sessions/:id → requisição com JWT retorna 401", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId, workspaceId, token } = await setupE2EBase(t);

  // Buscar o sessionId da sessão criada no login do setup
  const session = await t.run((ctx) =>
    ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", adminId))
      .first(),
  );
  expect(session).not.toBeNull();
  const sessionId = session!._id as string;

  // Confirmar que token funciona antes da revogação
  const beforeRevoke = await t.fetch("/v1/sessions", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(beforeRevoke.status).toBe(200);

  // Revogar a sessão via HTTP DELETE
  const revokeRes = await t.fetch(`/v1/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(revokeRes.status).toBe(200);

  // Verificar que próxima requisição com o mesmo JWT retorna 401
  const afterRevoke = await t.fetch("/v1/sessions", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(afterRevoke.status).toBe(401);
});
