/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
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
