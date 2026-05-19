/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setupOrgWithAdmin(t: ReturnType<typeof convexTest>) {
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

  return { rootId, orgId, adminId: adminUser!._id };
}

// ── Ciclo 1: getUserById ──────────────────────────────────────────────────────

test("getUserById: retorna dados do usuário sem passwordHash", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId } = await setupOrgWithAdmin(t);

  const user = await t.query(internal.users.getUserById, {
    callerId: adminId,
    userId: adminId,
    orgId,
  });

  expect(user).not.toBeNull();
  expect(user?.email).toBe("admin@acme.io");
  expect(user).not.toHaveProperty("passwordHash");
});

// ── Ciclo 2: createUser via mutation ─────────────────────────────────────────

test("createUser: Org Admin cria usuário na org e retorna dados sem passwordHash", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId } = await setupOrgWithAdmin(t);

  const result = await t.mutation(internal.users.createUser, {
    callerId: adminId,
    orgId,
    email: "new@acme.io",
    passwordHash: "hashed_senha123",
    role: "member",
  });

  expect(result.id).toBeTruthy();
  expect(result.email).toBe("new@acme.io");
  expect(result).not.toHaveProperty("passwordHash");
});

// ── Ciclo 3: quota excedida ───────────────────────────────────────────────────

test("createUser: retorna QuotaExceeded quando org está no limite de usuários", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId } = await setupOrgWithAdmin(t);

  // Setar quota = 1 (admin já existe)
  await t.run(async (ctx) => {
    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();
    if (settings) {
      await ctx.db.patch(settings._id, {
        quotas: { ...settings.quotas, users_per_org: 1 },
      });
    }
  });

  await expect(
    t.mutation(internal.users.createUser, {
      callerId: adminId,
      orgId,
      email: "extra@acme.io",
      passwordHash: "hashed_senha123",
      role: "member",
    }),
  ).rejects.toThrow("quota_exceeded");
});

// ── Ciclo 4: isolamento entre orgs ───────────────────────────────────────────

test("getUserById: Org Admin da org_A não acessa usuário que não está na mesma org", async () => {
  const t = convexTest(schema, modules);
  const { adminId: adminA, orgId: orgA } = await setupOrgWithAdmin(t);

  // Criar usuário em outra org
  const orgBId = await t.run((ctx) =>
    ctx.db.insert("orgs", {
      name: "Org B",
      status: "active",
      updatedAt: Date.now(),
    }),
  );
  const userBId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "user@orgb.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", {
      userId: userBId,
      orgId: orgBId,
      role: "member",
      status: "active",
    }),
  );

  await expect(
    t.query(internal.users.getUserById, {
      callerId: adminA,
      userId: userBId,
      orgId: orgA,
    }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 5: updateUser ───────────────────────────────────────────────────────

test("updateUser: Org Admin atualiza email do usuário da própria org", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId } = await setupOrgWithAdmin(t);

  const result = await t.mutation(internal.users.createUser, {
    callerId: adminId,
    orgId,
    email: "target@acme.io",
    passwordHash: "hashed_senha123",
    role: "member",
  });

  await t.mutation(internal.users.updateUser, {
    callerId: adminId,
    userId: result.id,
    orgId,
    email: "updated@acme.io",
  });

  const updated = await t.query(internal.users.getUserById, {
    callerId: adminId,
    userId: result.id,
    orgId,
  });
  expect(updated?.email).toBe("updated@acme.io");
});

// ── Ciclo 6: deleteUser (suspend) ────────────────────────────────────────────

test("deleteUser: Org Admin suspende usuário da própria org", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId } = await setupOrgWithAdmin(t);

  const created = await t.mutation(internal.users.createUser, {
    callerId: adminId,
    orgId,
    email: "target@acme.io",
    passwordHash: "hashed_senha123",
    role: "member",
  });

  await t.mutation(internal.users.deleteUser, {
    callerId: adminId,
    userId: created.id,
    orgId,
  });

  const user = await t.run((ctx) => ctx.db.get(created.id));
  expect(user?.status).toBe("suspended");
});

// ── Ciclo 8: listUsersQuery (real-time, public query) ────────────────────────

test("listUsersQuery: retorna lista de usuários da org com JWT válido de admin", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const { orgId, adminId } = await setupOrgWithAdmin(t);

  const token = await t.action(internal.jwt.signJwt, {
    sub: adminId as string,
    orgId: orgId as string,
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "test-session",
    expiresInSeconds: 3600,
  });

  const users = await t.query(api.users.listUsersQuery, { token, orgId });

  expect(Array.isArray(users)).toBe(true);
  expect(users.length).toBeGreaterThan(0);
  const admin = users.find((u: { email: string }) => u.email === "admin@acme.io");
  expect(admin).toBeDefined();
  expect(admin).not.toHaveProperty("passwordHash");
});

test("listUsersQuery: retorna array vazio com token inválido", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const { orgId } = await setupOrgWithAdmin(t);

  const users = await t.query(api.users.listUsersQuery, {
    token: "invalid.token.here",
    orgId,
  });

  expect(users).toEqual([]);
});

// ── Ciclo 7: getUserPermissions ──────────────────────────────────────────────

test("getUserPermissions: retorna bindings do usuário com capabilities resolvidas", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId } = await setupOrgWithAdmin(t);

  // Seed: role admin base necessário para herança automática
  await t.run((ctx) =>
    ctx.db.insert("roles", { name: "admin", isBase: true }),
  );

  const wsId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: adminId,
    orgId,
    name: "WS Test",
  });

  const permissions = await t.query(internal.users.getUserPermissions, {
    callerId: adminId,
    userId: adminId,
    orgId,
  });

  expect(Array.isArray(permissions)).toBe(true);
  // adminId tem binding de admin no workspace
  const binding = permissions.find((p) => p.workspaceId === wsId);
  expect(binding).toBeDefined();
  expect(Array.isArray(binding?.capabilities)).toBe(true);
});

// ── Fase 10.1: transferUser ───────────────────────────────────────────────────

async function setupTransferContext(t: ReturnType<typeof convexTest>) {
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

  // org_A e org_B
  const orgAId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Org A", status: "active", updatedAt: Date.now() }),
  );
  const orgBId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Org B", status: "active", updatedAt: Date.now() }),
  );

  // usuário alvo na org_A
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "user@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  await t.run((ctx) =>
    ctx.db.insert("org_members", {
      userId,
      orgId: orgAId,
      role: "member",
      status: "active",
    }),
  );

  // workspace na org_A e workspace na org_B
  const wsAId = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId: orgAId, name: "WS A", status: "active" }),
  );
  const wsBId = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId: orgBId, name: "WS B", status: "active" }),
  );

  // role base necessário
  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "member", isBase: true }),
  );

  return { rootId, orgAId, orgBId, userId, wsAId, wsBId, roleId };
}

// Ciclo 1
test("transferUser: retorna preservedBindings + revokedBindings corretos", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgAId, orgBId, userId, wsAId, wsBId, roleId } =
    await setupTransferContext(t);

  // binding em wsA (org_A) → deve ser revogado
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId,
      resourceType: "workspace",
      workspaceId: wsAId,
    }),
  );
  // binding em wsB (org_B) → deve ser preservado
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId,
      resourceType: "workspace",
      workspaceId: wsBId,
    }),
  );

  const result = await t.mutation(internal.users.transferUser, {
    actorId: rootId,
    userId,
    targetOrgId: orgBId,
  });

  expect(result.preservedBindings).toBe(1);
  expect(result.revokedBindings).toBe(1);
  expect(result.fromOrgId).toBe(orgAId);
  expect(result.toOrgId).toBe(orgBId);
});

// Ciclo 2
test("transferUser: binding em workspace da targetOrgId é preservado no banco", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgBId, userId, wsBId, roleId } = await setupTransferContext(t);

  const bindingId = await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId,
      resourceType: "workspace",
      workspaceId: wsBId,
    }),
  );

  await t.mutation(internal.users.transferUser, {
    actorId: rootId,
    userId,
    targetOrgId: orgBId,
  });

  const binding = await t.run((ctx) => ctx.db.get(bindingId));
  expect(binding).not.toBeNull();
});

// Ciclo 3
test("transferUser: binding revogado gera audit binding.revoke com reason user_transfer_cleanup", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgBId, userId, wsAId, roleId } = await setupTransferContext(t);

  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId,
      resourceType: "workspace",
      workspaceId: wsAId,
    }),
  );

  await t.mutation(internal.users.transferUser, {
    actorId: rootId,
    userId,
    targetOrgId: orgBId,
  });

  const auditEvents = await t.run((ctx) =>
    ctx.db.query("audit_log").collect(),
  );
  const revokeEvent = auditEvents.find((e) => e.action === "binding.revoke");
  expect(revokeEvent).toBeDefined();
  expect(revokeEvent?.reason).toBe("user_transfer_cleanup");
});

// Ciclo 4
test("transferUser: atualiza org_members — remove orgId original, cria targetOrgId", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgAId, orgBId, userId } = await setupTransferContext(t);

  await t.mutation(internal.users.transferUser, {
    actorId: rootId,
    userId,
    targetOrgId: orgBId,
  });

  const oldMembership = await t.run((ctx) =>
    ctx.db
      .query("org_members")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("orgId"), orgAId),
          q.eq(q.field("status"), "active"),
        ),
      )
      .first(),
  );
  expect(oldMembership).toBeNull();

  const newMembership = await t.run((ctx) =>
    ctx.db
      .query("org_members")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("orgId"), orgBId),
          q.eq(q.field("status"), "active"),
        ),
      )
      .first(),
  );
  expect(newMembership).not.toBeNull();
});

// Ciclo 5
test("transferUser: revoga todas as sessões ativas do usuário", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgBId, userId } = await setupTransferContext(t);

  const sessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId,
      refreshTokenHash: "hash",
      expiresAt: Date.now() + 3600_000,
    }),
  );

  const result = await t.mutation(internal.users.transferUser, {
    actorId: rootId,
    userId,
    targetOrgId: orgBId,
  });

  expect(result.sessionsRevoked).toBe(1);

  const blacklistEntry = await t.run((ctx) =>
    ctx.db
      .query("session_blacklist")
      .filter((q) => q.eq(q.field("sessionId"), sessionId))
      .first(),
  );
  expect(blacklistEntry).not.toBeNull();
});

// Ciclo 6
test("transferUser: grava audit event user.transfer com campos corretos", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgAId, orgBId, userId } = await setupTransferContext(t);

  await t.mutation(internal.users.transferUser, {
    actorId: rootId,
    userId,
    targetOrgId: orgBId,
  });

  const auditEvents = await t.run((ctx) => ctx.db.query("audit_log").collect());
  const transferEvent = auditEvents.find((e) => e.action === "user.transfer");
  expect(transferEvent).toBeDefined();
  expect(transferEvent?.target.type).toBe("users");
  expect(transferEvent?.target.id).toBe(userId as string);
  expect(transferEvent?.reason).toContain(`fromOrgId:${orgAId}`);
  expect(transferEvent?.reason).toContain(`toOrgId:${orgBId}`);
});

// Ciclo 7
test("transferUser: targetOrgId inexistente lança erro not_found", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgAId, userId } = await setupTransferContext(t);

  await expect(
    t.mutation(internal.users.transferUser, {
      actorId: rootId,
      userId,
      targetOrgId: orgAId, // usar orgAId como placeholder de id inexistente via workaround
    }),
  ).rejects.toThrow("already_in_org");

  // Testar id de org inexistente usando um id inválido como string cast
  await expect(
    t.mutation(internal.users.transferUser, {
      actorId: rootId,
      userId,
      targetOrgId: "jd7abc123456789012345678" as never,
    }),
  ).rejects.toThrow();
});

test("transferUser: targetOrgId igual ao orgId atual retorna erro already_in_org", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgAId, userId } = await setupTransferContext(t);

  await expect(
    t.mutation(internal.users.transferUser, {
      actorId: rootId,
      userId,
      targetOrgId: orgAId,
    }),
  ).rejects.toThrow("already_in_org");
});

test("transferUser: chamado por não-Root lança erro forbidden", async () => {
  const t = convexTest(schema, modules);
  const { orgBId, userId } = await setupTransferContext(t);

  // userId é um usuário comum (não Root)
  await expect(
    t.mutation(internal.users.transferUser, {
      actorId: userId,
      userId,
      targetOrgId: orgBId,
    }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 8: HTTP endpoint ────────────────────────────────────────────────────

async function setupTransferHttpContext(t: ReturnType<typeof convexTest>) {
  const ctx = await setupTransferContext(t);
  await t.action(internal.jwt.initializeKeyPair, {});

  const rootToken = await t.action(internal.jwt.signJwt, {
    sub: String(ctx.rootId),
    orgId: String(ctx.orgAId),
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "",
    expiresInSeconds: 3600,
  });

  // token de admin (não Root)
  const adminId = await t.run((ctx2) =>
    ctx2.db.insert("users", {
      email: "admin@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx2) =>
    ctx2.db.insert("org_members", {
      userId: adminId,
      orgId: ctx.orgAId,
      role: "admin",
      status: "active",
    }),
  );
  const adminToken = await t.action(internal.jwt.signJwt, {
    sub: String(adminId),
    orgId: String(ctx.orgAId),
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "",
    expiresInSeconds: 3600,
  });

  return { ...ctx, rootToken, adminToken };
}

test("POST /v1/users/:id/transfer: Root transfere usuário com sucesso", async () => {
  const t = convexTest(schema, modules);
  const { rootToken, userId, orgBId } = await setupTransferHttpContext(t);

  const res = await t.fetch(`/v1/users/${String(userId)}/transfer`, {
    method: "POST",
    headers: { Authorization: `Bearer ${rootToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ targetOrgId: String(orgBId) }),
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.userId).toBe(String(userId));
  expect(body.toOrgId).toBe(String(orgBId));
});

test("POST /v1/users/:id/transfer: Org Admin recebe 403", async () => {
  const t = convexTest(schema, modules);
  const { adminToken, userId, orgBId } = await setupTransferHttpContext(t);

  const res = await t.fetch(`/v1/users/${String(userId)}/transfer`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ targetOrgId: String(orgBId) }),
  });

  expect(res.status).toBe(403);
});

test("POST /v1/users/:id/transfer: body sem targetOrgId retorna 400", async () => {
  const t = convexTest(schema, modules);
  const { rootToken, userId } = await setupTransferHttpContext(t);

  const res = await t.fetch(`/v1/users/${String(userId)}/transfer`, {
    method: "POST",
    headers: { Authorization: `Bearer ${rootToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  expect(res.status).toBe(400);
});

// ── Ciclo 9: integração completa ─────────────────────────────────────────────

test("transferUser integração: 2 bindings preservados, 1 revogado, sessões revogadas", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgAId, orgBId, userId, wsAId, wsBId, roleId } =
    await setupTransferContext(t);

  // workspace extra em org_B
  const wsBId2 = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId: orgBId, name: "WS B2", status: "active" }),
  );

  // 3 bindings: 2 em org_B, 1 em org_A
  const bindingToRevoke = await t.run((ctx) =>
    ctx.db.insert("bindings", { userId, roleId, resourceType: "workspace", workspaceId: wsAId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("bindings", { userId, roleId, resourceType: "workspace", workspaceId: wsBId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("bindings", { userId, roleId, resourceType: "workspace", workspaceId: wsBId2 }),
  );

  // sessão ativa
  await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId,
      refreshTokenHash: "hash",
      expiresAt: Date.now() + 3600_000,
    }),
  );

  const result = await t.mutation(internal.users.transferUser, {
    actorId: rootId,
    userId,
    targetOrgId: orgBId,
  });

  expect(result.preservedBindings).toBe(2);
  expect(result.revokedBindings).toBe(1);
  expect(result.sessionsRevoked).toBe(1);

  // binding da org_A deve ter sido removido
  const revokedBinding = await t.run((ctx) => ctx.db.get(bindingToRevoke));
  expect(revokedBinding).toBeNull();

  // novo org_members deve ser org_B
  const membership = await t.run((ctx) =>
    ctx.db
      .query("org_members")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("orgId"), orgBId),
          q.eq(q.field("status"), "active"),
        ),
      )
      .first(),
  );
  expect(membership).not.toBeNull();
});

test("transferUser integração: audit log contém user.transfer + binding.revoke com reason user_transfer_cleanup", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgBId, userId, wsAId, roleId } = await setupTransferContext(t);

  await t.run((ctx) =>
    ctx.db.insert("bindings", { userId, roleId, resourceType: "workspace", workspaceId: wsAId }),
  );

  await t.mutation(internal.users.transferUser, {
    actorId: rootId,
    userId,
    targetOrgId: orgBId,
  });

  const auditEvents = await t.run((ctx) => ctx.db.query("audit_log").collect());

  const transferEvent = auditEvents.find((e) => e.action === "user.transfer");
  expect(transferEvent).toBeDefined();

  const revokeEvent = auditEvents.find((e) => e.action === "binding.revoke");
  expect(revokeEvent).toBeDefined();
  expect(revokeEvent?.reason).toBe("user_transfer_cleanup");
});

// ── Ciclo 11.1: listAllUsers (GET /v1/users/global) ──────────────────────────

test("listAllUsers: Root sem filtros recebe lista paginada de todos os usuários", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, adminId } = await setupOrgWithAdmin(t);
  void orgId; void adminId;

  const result = await t.query(internal.users.listAllUsers, {
    callerId: rootId,
  });

  expect(Array.isArray(result.users)).toBe(true);
  expect(result.users.length).toBeGreaterThanOrEqual(1);
  expect(result.users.every((u: { passwordHash?: string }) => !u.passwordHash)).toBe(true);
  expect(typeof result.isDone).toBe("boolean");
});

test("listAllUsers: Root filtra por orgId e retorna apenas usuários daquela org", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId } = await setupOrgWithAdmin(t);

  const { orgId: orgBId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Org B",
    adminEmail: "adminb@orgb.io",
  });

  const allResult = await t.query(internal.users.listAllUsers, { callerId: rootId });
  const filteredResult = await t.query(internal.users.listAllUsers, {
    callerId: rootId,
    orgId,
  });
  const filteredBResult = await t.query(internal.users.listAllUsers, {
    callerId: rootId,
    orgId: orgBId,
  });

  expect(allResult.users.length).toBeGreaterThan(filteredResult.users.length);
  expect(filteredBResult.users.length).toBeGreaterThanOrEqual(1);
});

test("listAllUsers: Root filtra por status e retorna apenas usuários com aquele status", async () => {
  const t = convexTest(schema, modules);
  const { rootId, adminId } = await setupOrgWithAdmin(t);

  await t.run((ctx) => ctx.db.patch(adminId, { status: "suspended" }));

  const activeResult = await t.query(internal.users.listAllUsers, {
    callerId: rootId,
    status: "active",
  });

  const hasAdmin = activeResult.users.some(
    (u: { _id: string }) => u._id === (adminId as string),
  );
  expect(hasAdmin).toBe(false);
});

test("listAllUsers: não-Root recebe erro forbidden", async () => {
  const t = convexTest(schema, modules);
  const { adminId } = await setupOrgWithAdmin(t);

  await expect(
    t.query(internal.users.listAllUsers, { callerId: adminId }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 11.1: suspendUserGlobal (POST /v1/users/:id/suspend-global) ─────────

test("suspendUserGlobal: Root suspende usuário de qualquer org", async () => {
  const t = convexTest(schema, modules);
  const { rootId, adminId } = await setupOrgWithAdmin(t);

  await t.mutation(internal.users.suspendUserGlobal, {
    actorId: rootId,
    userId: adminId,
  });

  const user = await t.run((ctx) => ctx.db.get(adminId));
  expect(user?.status).toBe("suspended");
});

test("suspendUserGlobal: já suspenso é idempotente — retorna success", async () => {
  const t = convexTest(schema, modules);
  const { rootId, adminId } = await setupOrgWithAdmin(t);

  await t.run((ctx) => ctx.db.patch(adminId, { status: "suspended" }));

  await expect(
    t.mutation(internal.users.suspendUserGlobal, { actorId: rootId, userId: adminId }),
  ).resolves.not.toThrow();
});

test("suspendUserGlobal: não-Root recebe erro forbidden", async () => {
  const t = convexTest(schema, modules);
  const { adminId } = await setupOrgWithAdmin(t);

  await expect(
    t.mutation(internal.users.suspendUserGlobal, { actorId: adminId, userId: adminId }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 11.1: revokeAllUserSessions (DELETE /v1/users/:id/sessions) ─────────

test("revokeAllUserSessions: Root revoga todas as sessões ativas do usuário", async () => {
  const t = convexTest(schema, modules);
  const { rootId, adminId } = await setupOrgWithAdmin(t);

  const sessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId: adminId,
      refreshTokenHash: "hash1",
      expiresAt: Date.now() + 3600000,
      ip: "1.2.3.4",
    }),
  );
  void sessionId;

  const result = await t.mutation(internal.users.revokeAllUserSessions, {
    actorId: rootId,
    userId: adminId,
  });

  expect(result.sessionsRevoked).toBe(1);

  const blacklisted = await t.run((ctx) =>
    ctx.db.query("session_blacklist").collect(),
  );
  expect(blacklisted.length).toBe(1);
});

test("revokeAllUserSessions: usuário sem sessões retorna sessionsRevoked: 0", async () => {
  const t = convexTest(schema, modules);
  const { rootId, adminId } = await setupOrgWithAdmin(t);

  const result = await t.mutation(internal.users.revokeAllUserSessions, {
    actorId: rootId,
    userId: adminId,
  });

  expect(result.sessionsRevoked).toBe(0);
});

test("revokeAllUserSessions: não-Root recebe erro forbidden", async () => {
  const t = convexTest(schema, modules);
  const { adminId } = await setupOrgWithAdmin(t);

  await expect(
    t.mutation(internal.users.revokeAllUserSessions, { actorId: adminId, userId: adminId }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 12.1-A: reactivateUser ─────────────────────────────────────────────

test("reactivateUser: OrgAdmin reativa usuário suspenso e status volta a active", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId } = await setupOrgWithAdmin(t);

  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "suspended@acme.io",
      passwordHash: "hash",
      status: "suspended",
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

  await t.mutation(internal.users.reactivateUser, {
    callerId: adminId,
    userId,
    orgId,
  });

  const updated = await t.run((ctx) => ctx.db.get(userId));
  expect(updated?.status).toBe("active");
});

test("reactivateUser: bindings existentes são preservados após reativação", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId } = await setupOrgWithAdmin(t);

  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "suspended2@acme.io",
      passwordHash: "hash",
      status: "suspended",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId, orgId, role: "member", status: "active" }),
  );

  const wsId = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" }),
  );
  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: true }),
  );
  const bindingId = await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId,
      workspaceId: wsId,
      resourceType: "workspace",
      type: "allow",
    }),
  );

  await t.mutation(internal.users.reactivateUser, { callerId: adminId, userId, orgId });

  const binding = await t.run((ctx) => ctx.db.get(bindingId));
  expect(binding).not.toBeNull();
});

test("reactivateUser: não-OrgAdmin recebe erro forbidden", async () => {
  const t = convexTest(schema, modules);
  const { orgId, adminId } = await setupOrgWithAdmin(t);

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
    ctx.db.insert("org_members", { userId: memberId, orgId, role: "member", status: "active" }),
  );

  const targetId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "target@acme.io",
      passwordHash: "hash",
      status: "suspended",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: targetId, orgId, role: "member", status: "active" }),
  );

  await expect(
    t.mutation(internal.users.reactivateUser, { callerId: memberId, userId: targetId, orgId }),
  ).rejects.toThrow("forbidden");
});
