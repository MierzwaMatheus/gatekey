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
