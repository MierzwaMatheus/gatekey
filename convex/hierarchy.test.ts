/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createRootUser(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "root@gatekey.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );
}

async function createRegularUser(t: ReturnType<typeof convexTest>, email = "user@org.io") {
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      email,
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
}

// ── Ciclo 1: createOrg ───────────────────────────────────────────────────────

test("createOrg: Root cria org e retorna orgId", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);

  const orgId = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail: "admin@acme.io",
  });

  expect(orgId).toBeTruthy();
  const org = await t.run((ctx) => ctx.db.get(orgId));
  expect(org?.name).toBe("Acme Corp");
  expect(org?.status).toBe("active");
});

test("createOrg: cria org_settings padrão associada à org", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);

  const orgId = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail: "admin@acme.io",
  });

  const settings = await t.run((ctx) =>
    ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first(),
  );
  expect(settings).not.toBeNull();
  expect(settings?.loginMethods).toContain("email_password");
  expect(settings?.mfaRequired).toBe(false);
});

test("createOrg: cria usuário admin e o vincula à org como org_member", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);

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
  expect(adminUser).not.toBeNull();

  const member = await t.run((ctx) =>
    ctx.db
      .query("org_members")
      .filter((q) =>
        q.and(
          q.eq(q.field("orgId"), orgId),
          q.eq(q.field("userId"), adminUser!._id),
        ),
      )
      .first(),
  );
  expect(member?.role).toBe("admin");
  expect(member?.status).toBe("active");
});

test("createOrg: não-Root não pode criar org", async () => {
  const t = convexTest(schema, modules);
  const userId = await createRegularUser(t);

  await expect(
    t.mutation(internal.hierarchy.createOrg, {
      callerId: userId,
      name: "Acme Corp",
      adminEmail: "admin@acme.io",
    }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 2: suspendOrg ──────────────────────────────────────────────────────

test("suspendOrg: Root suspende org", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );

  await t.mutation(internal.hierarchy.suspendOrg, { callerId: rootId, orgId });

  const org = await t.run((ctx) => ctx.db.get(orgId));
  expect(org?.status).toBe("suspended");
});

test("suspendOrg: não-Root não pode suspender org", async () => {
  const t = convexTest(schema, modules);
  const userId = await createRegularUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );

  await expect(
    t.mutation(internal.hierarchy.suspendOrg, { callerId: userId, orgId }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 3: deleteOrg ───────────────────────────────────────────────────────

test("deleteOrg: Root faz soft delete de org", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );

  await t.mutation(internal.hierarchy.deleteOrg, { callerId: rootId, orgId });

  const org = await t.run((ctx) => ctx.db.get(orgId));
  expect(org?.status).toBe("deleted");
});

test("deleteOrg: não-Root não pode deletar org", async () => {
  const t = convexTest(schema, modules);
  const userId = await createRegularUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );

  await expect(
    t.mutation(internal.hierarchy.deleteOrg, { callerId: userId, orgId }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 4: createWorkspace ─────────────────────────────────────────────────

test("createWorkspace: Org Admin cria workspace na sua org", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme",
    adminEmail: "admin@acme.io",
  });
  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );

  const wsId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: adminUser!._id,
    orgId,
    name: "Dev",
  });

  const ws = await t.run((ctx) => ctx.db.get(wsId));
  expect(ws?.name).toBe("Dev");
  expect(ws?.status).toBe("active");
  expect(ws?.orgId).toBe(orgId);
});

test("createWorkspace: Root cria workspace em qualquer org", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );

  const wsId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Prod",
  });

  const ws = await t.run((ctx) => ctx.db.get(wsId));
  expect(ws?.name).toBe("Prod");
});

test("createWorkspace: usuário sem role admin não pode criar workspace", async () => {
  const t = convexTest(schema, modules);
  const userId = await createRegularUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );

  await expect(
    t.mutation(internal.hierarchy.createWorkspace, { callerId: userId, orgId, name: "Dev" }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 5: suspendWorkspace ────────────────────────────────────────────────

test("suspendWorkspace: Org Admin suspende workspace da sua org", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme",
    adminEmail: "admin@acme.io",
  });
  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );
  const wsId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Dev",
  });

  await t.mutation(internal.hierarchy.suspendWorkspace, {
    callerId: adminUser!._id,
    workspaceId: wsId,
  });

  const ws = await t.run((ctx) => ctx.db.get(wsId));
  expect(ws?.status).toBe("suspended");
});

test("suspendWorkspace: Root suspende qualquer workspace", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );
  const wsId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Dev",
  });

  await t.mutation(internal.hierarchy.suspendWorkspace, { callerId: rootId, workspaceId: wsId });

  const ws = await t.run((ctx) => ctx.db.get(wsId));
  expect(ws?.status).toBe("suspended");
});

test("suspendWorkspace: usuário sem role admin não pode suspender workspace", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const userId = await createRegularUser(t, "member@acme.io");
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );
  const wsId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Dev",
  });

  await expect(
    t.mutation(internal.hierarchy.suspendWorkspace, { callerId: userId, workspaceId: wsId }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 6: createUser ──────────────────────────────────────────────────────

async function setupOrgWithSettings(
  t: ReturnType<typeof convexTest>,
  usersPerOrgQuota = 50,
) {
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
      quotas: { users_per_org: usersPerOrgQuota },
    }),
  );
  return orgId;
}

test("createUser: Org Admin cria usuário e retorna userId", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme",
    adminEmail: "admin@acme.io",
  });
  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );

  const userId = await t.action(internal.auth.createUser, {
    callerId: adminUser!._id,
    orgId,
    email: "newuser@acme.io",
    password: "secret123",
    role: "member",
  });

  expect(userId).toBeTruthy();
  const user = await t.run((ctx) => ctx.db.get(userId));
  expect(user?.email).toBe("newuser@acme.io");
  expect(user?.status).toBe("active");
});

test("createUser: Root pode criar usuário em qualquer org", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await setupOrgWithSettings(t);

  const userId = await t.action(internal.auth.createUser, {
    callerId: rootId,
    orgId,
    email: "newuser@acme.io",
    password: "secret123",
    role: "member",
  });

  expect(userId).toBeTruthy();
});

test("createUser: não-admin não pode criar usuário", async () => {
  const t = convexTest(schema, modules);
  const userId = await createRegularUser(t);
  const orgId = await setupOrgWithSettings(t);

  await expect(
    t.action(internal.auth.createUser, {
      callerId: userId,
      orgId,
      email: "new@acme.io",
      password: "secret",
      role: "member",
    }),
  ).rejects.toThrow("forbidden");
});

test("createUser: org em cota máxima retorna erro quota_exceeded", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await setupOrgWithSettings(t, 1);

  const existingUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "existing@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", {
      userId: existingUserId,
      orgId,
      role: "member",
      status: "active",
    }),
  );

  await expect(
    t.action(internal.auth.createUser, {
      callerId: rootId,
      orgId,
      email: "second@acme.io",
      password: "secret",
      role: "member",
    }),
  ).rejects.toThrow("quota_exceeded");
});
