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

  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
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

  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
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
  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
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
  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
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

// ── Ciclo 8: resetUserPassword ───────────────────────────────────────────────

test("resetUserPassword: Org Admin reseta senha de usuário da própria org", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme",
    adminEmail: "admin@acme.io",
  });
  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );
  const targetId = await createRegularUser(t, "target@acme.io");
  await t.run((ctx) =>
    ctx.db.insert("org_members", {
      userId: targetId,
      orgId,
      role: "member",
      status: "active",
    }),
  );
  const oldHash = (await t.run((ctx) => ctx.db.get(targetId)))?.passwordHash;

  await t.action(internal.auth.resetUserPassword, {
    callerId: adminUser!._id,
    userId: targetId,
    newPassword: "newSecret456",
  });

  const user = await t.run((ctx) => ctx.db.get(targetId));
  expect(user?.passwordHash).not.toBe(oldHash);
  expect(user?.passwordHash).not.toBe("newSecret456");
});

test("resetUserPassword: Root pode resetar senha de qualquer usuário", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const targetId = await createRegularUser(t, "target@other.io");

  await t.action(internal.auth.resetUserPassword, {
    callerId: rootId,
    userId: targetId,
    newPassword: "newPass789",
  });

  const user = await t.run((ctx) => ctx.db.get(targetId));
  expect(user?.passwordHash).not.toBe("hash");
});

test("resetUserPassword: limpa mustChangePassword após reset de senha", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const targetId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "newadmin@acme.io",
      passwordHash: "temphash",
      mustChangePassword: true,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  await t.action(internal.auth.resetUserPassword, {
    callerId: rootId,
    userId: targetId,
    newPassword: "novasenha123",
  });

  const user = await t.run((ctx) => ctx.db.get(targetId));
  expect(user?.mustChangePassword).toBe(false);
});

test("resetUserPassword: Org Admin não pode resetar senha de usuário de outra org", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme",
    adminEmail: "admin@acme.io",
  });
  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );
  const targetId = await createRegularUser(t, "target@other.io");
  void orgId;

  await expect(
    t.action(internal.auth.resetUserPassword, {
      callerId: adminUser!._id,
      userId: targetId,
      newPassword: "hack",
    }),
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
  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
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

// ── Ciclo 10: removeWorkspaceMember ──────────────────────────────────────────

test("removeWorkspaceMember: Org Admin remove membro do workspace", async () => {
  const t = convexTest(schema, modules);
  const { orgId, wsId } = await setupOrgAndWorkspace(t);
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "admin2@acme.io",
      passwordHash: "h",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: adminId, orgId, role: "admin", status: "active" }),
  );
  const memberId = await createRegularUser(t, "member2@acme.io");
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", { userId: memberId, workspaceId: wsId, status: "active" }),
  );

  await t.mutation(internal.hierarchy.removeWorkspaceMember, {
    callerId: adminId,
    workspaceId: wsId,
    userId: memberId,
  });

  const wm = await t.run((ctx) =>
    ctx.db
      .query("workspace_members")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", memberId).eq("workspaceId", wsId),
      )
      .first(),
  );
  expect(wm?.status).toBe("removed");
});

test("removeWorkspaceMember: Root pode remover membro", async () => {
  const t = convexTest(schema, modules);
  const { rootId, wsId } = await setupOrgAndWorkspace(t);
  const memberId = await createRegularUser(t, "member3@acme.io");
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", { userId: memberId, workspaceId: wsId, status: "active" }),
  );

  await t.mutation(internal.hierarchy.removeWorkspaceMember, {
    callerId: rootId,
    workspaceId: wsId,
    userId: memberId,
  });

  const wm = await t.run((ctx) =>
    ctx.db
      .query("workspace_members")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", memberId).eq("workspaceId", wsId),
      )
      .first(),
  );
  expect(wm?.status).toBe("removed");
});

test("removeWorkspaceMember: não-admin não pode remover membro", async () => {
  const t = convexTest(schema, modules);
  const { wsId } = await setupOrgAndWorkspace(t);
  const regularId = await createRegularUser(t, "regular2@acme.io");
  const memberId = await createRegularUser(t, "member4@acme.io");
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", { userId: memberId, workspaceId: wsId, status: "active" }),
  );

  await expect(
    t.mutation(internal.hierarchy.removeWorkspaceMember, {
      callerId: regularId,
      workspaceId: wsId,
      userId: memberId,
    }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 9: addWorkspaceMember ──────────────────────────────────────────────

async function setupOrgAndWorkspace(t: ReturnType<typeof convexTest>) {
  const rootId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root@gk.io",
      passwordHash: "h",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );
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
      quotas: { users_per_workspace: 30 },
    }),
  );
  const wsId = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId, name: "Dev", status: "active" }),
  );
  return { rootId, orgId, wsId };
}

test("addWorkspaceMember: Org Admin adiciona membro ao workspace", async () => {
  const t = convexTest(schema, modules);
  const { orgId, wsId } = await setupOrgAndWorkspace(t);
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "admin@acme.io",
      passwordHash: "h",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: adminId, orgId, role: "admin", status: "active" }),
  );
  const memberId = await createRegularUser(t, "member@acme.io");
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: memberId, orgId, role: "member", status: "active" }),
  );

  await t.mutation(internal.hierarchy.addWorkspaceMember, {
    callerId: adminId,
    workspaceId: wsId,
    userId: memberId,
  });

  const wm = await t.run((ctx) =>
    ctx.db
      .query("workspace_members")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", memberId).eq("workspaceId", wsId),
      )
      .first(),
  );
  expect(wm?.status).toBe("active");
});

test("addWorkspaceMember: Root pode adicionar membro", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, wsId } = await setupOrgAndWorkspace(t);
  const memberId = await createRegularUser(t, "member@acme.io");
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: memberId, orgId, role: "member", status: "active" }),
  );

  await t.mutation(internal.hierarchy.addWorkspaceMember, {
    callerId: rootId,
    workspaceId: wsId,
    userId: memberId,
  });

  const wm = await t.run((ctx) =>
    ctx.db
      .query("workspace_members")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", memberId).eq("workspaceId", wsId),
      )
      .first(),
  );
  expect(wm).not.toBeNull();
});

test("addWorkspaceMember: usuário sem role admin não pode adicionar membro", async () => {
  const t = convexTest(schema, modules);
  const { orgId, wsId } = await setupOrgAndWorkspace(t);
  const regularId = await createRegularUser(t, "regular@acme.io");
  const memberId = await createRegularUser(t, "member@acme.io");
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: memberId, orgId, role: "member", status: "active" }),
  );

  await expect(
    t.mutation(internal.hierarchy.addWorkspaceMember, {
      callerId: regularId,
      workspaceId: wsId,
      userId: memberId,
    }),
  ).rejects.toThrow("forbidden");
});

test("addWorkspaceMember: rejeita usuário que não pertence à org do workspace", async () => {
  const t = convexTest(schema, modules);
  const { rootId, wsId } = await setupOrgAndWorkspace(t);
  // Usuário externo: criado sem vínculo com a org do workspace
  const outsiderId = await createRegularUser(t, "outsider@other.io");

  await expect(
    t.mutation(internal.hierarchy.addWorkspaceMember, {
      callerId: rootId,
      workspaceId: wsId,
      userId: outsiderId,
    }),
  ).rejects.toThrow("user_not_org_member");
});

test("addWorkspaceMember: workspace em cota máxima retorna erro quota_exceeded", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, wsId } = await setupOrgAndWorkspace(t);
  // Sobrescrever cota para 1
  const settings = await t.run((ctx) =>
    ctx.db.query("org_settings").filter((q) => q.eq(q.field("orgId"), orgId)).first(),
  );
  await t.run((ctx) =>
    ctx.db.patch(settings!._id, { quotas: { users_per_workspace: 1 } }),
  );
  // Adicionar 1 membro existente para atingir cota
  const existingMemberId = await createRegularUser(t, "existing@acme.io");
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", {
      userId: existingMemberId,
      workspaceId: wsId,
      status: "active",
    }),
  );
  const newMemberId = await createRegularUser(t, "new@acme.io");
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: newMemberId, orgId, role: "member", status: "active" }),
  );

  await expect(
    t.mutation(internal.hierarchy.addWorkspaceMember, {
      callerId: rootId,
      workspaceId: wsId,
      userId: newMemberId,
    }),
  ).rejects.toThrow("quota_exceeded");
});

// ── Ciclo 7: suspendUser ─────────────────────────────────────────────────────

test("suspendUser: Org Admin suspende usuário da própria org", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme",
    adminEmail: "admin@acme.io",
  });
  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );
  const targetId = await createRegularUser(t, "target@acme.io");
  await t.run((ctx) =>
    ctx.db.insert("org_members", {
      userId: targetId,
      orgId,
      role: "member",
      status: "active",
    }),
  );

  await t.mutation(internal.hierarchy.suspendUser, {
    callerId: adminUser!._id,
    userId: targetId,
  });

  const user = await t.run((ctx) => ctx.db.get(targetId));
  expect(user?.status).toBe("suspended");
});

test("suspendUser: Root pode suspender qualquer usuário", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const targetId = await createRegularUser(t, "target@other.io");

  await t.mutation(internal.hierarchy.suspendUser, {
    callerId: rootId,
    userId: targetId,
  });

  const user = await t.run((ctx) => ctx.db.get(targetId));
  expect(user?.status).toBe("suspended");
});

test("suspendUser: Org Admin não pode suspender usuário de outra org", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme",
    adminEmail: "admin@acme.io",
  });
  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );
  const targetId = await createRegularUser(t, "target@other.io");
  // target não está na org do admin
  void orgId;

  await expect(
    t.mutation(internal.hierarchy.suspendUser, {
      callerId: adminUser!._id,
      userId: targetId,
    }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 14: herança automática — designar Org Admin → bindings em workspaces existentes ─

test("createUserForOrg com role admin: recebe binding admin em todos os workspaces existentes da org", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
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
      quotas: { users_per_org: 50 },
    }),
  );
  const adminRoleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "admin", isBase: true }),
  );
  const ws1Id = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId, name: "WS1", status: "active" }),
  );
  const ws2Id = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId, name: "WS2", status: "active" }),
  );

  const newAdminId = await t.mutation(internal.hierarchy.createUserForOrg, {
    callerId: rootId,
    orgId,
    email: "newadmin@acme.io",
    passwordHash: "hash",
    role: "admin",
  });

  const binding1 = await t.run((ctx) =>
    ctx.db
      .query("bindings")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", ws1Id).eq("userId", newAdminId),
      )
      .first(),
  );
  const binding2 = await t.run((ctx) =>
    ctx.db
      .query("bindings")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", ws2Id).eq("userId", newAdminId),
      )
      .first(),
  );

  expect(binding1?.roleId).toBe(adminRoleId);
  expect(binding2?.roleId).toBe(adminRoleId);
});

test("createUserForOrg com role member: não recebe bindings automáticos", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
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
      quotas: { users_per_org: 50 },
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("roles", { name: "admin", isBase: true }),
  );
  const wsId = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId, name: "WS1", status: "active" }),
  );

  const memberId = await t.mutation(internal.hierarchy.createUserForOrg, {
    callerId: rootId,
    orgId,
    email: "member@acme.io",
    passwordHash: "hash",
    role: "member",
  });

  const bindings = await t.run((ctx) =>
    ctx.db
      .query("bindings")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", wsId).eq("userId", memberId),
      )
      .collect(),
  );
  expect(bindings).toHaveLength(0);
});

// ── Ciclo 13: herança automática — createWorkspace → bindings para Org Admins ─

test("createWorkspace: Org Admins da org recebem binding admin automaticamente", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );
  const adminRoleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "admin", isBase: true }),
  );
  const admin1Id = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "admin1@acme.io",
      passwordHash: "h",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  const admin2Id = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "admin2@acme.io",
      passwordHash: "h",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: admin1Id, orgId, role: "admin", status: "active" }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: admin2Id, orgId, role: "admin", status: "active" }),
  );

  const wsId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Dev",
  });

  const binding1 = await t.run((ctx) =>
    ctx.db
      .query("bindings")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", wsId).eq("userId", admin1Id),
      )
      .first(),
  );
  const binding2 = await t.run((ctx) =>
    ctx.db
      .query("bindings")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", wsId).eq("userId", admin2Id),
      )
      .first(),
  );

  expect(binding1?.roleId).toBe(adminRoleId);
  expect(binding2?.roleId).toBe(adminRoleId);
});

test("createWorkspace: Root sem ser org_member não recebe binding", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );
  await t.run((ctx) =>
    ctx.db.insert("roles", { name: "admin", isBase: true }),
  );

  const wsId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Dev",
  });

  const bindings = await t.run((ctx) =>
    ctx.db
      .query("bindings")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", wsId).eq("userId", rootId),
      )
      .collect(),
  );
  expect(bindings).toHaveLength(0);
});

// ── Ciclo 12: workspaces_per_org quota ──────────────────────────────────────

test("createWorkspace: org em cota máxima de workspaces retorna quota_exceeded", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
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
      quotas: { workspaces_per_org: 1 },
    }),
  );
  // Inserir 1 workspace existente para atingir cota
  await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId, name: "Existing", status: "active" }),
  );

  await expect(
    t.mutation(internal.hierarchy.createWorkspace, {
      callerId: rootId,
      orgId,
      name: "New WS",
    }),
  ).rejects.toThrow("quota_exceeded");
});

// ── Ciclo 11: changeWorkspaceMemberRole ─────────────────────────────────────

async function setupOrgWorkspaceAndBinding(t: ReturnType<typeof convexTest>) {
  const rootId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root2@gk.io",
      passwordHash: "h",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );
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
      quotas: { users_per_workspace: 30 },
    }),
  );
  const wsId = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId, name: "Dev", status: "active" }),
  );
  const editorRoleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "editor", isBase: true }),
  );
  const viewerRoleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: true }),
  );
  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "member@acme.io",
      passwordHash: "h",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", { userId: memberId, workspaceId: wsId, status: "active" }),
  );
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId: memberId,
      roleId: editorRoleId,
      resourceType: "workspace",
      workspaceId: wsId,
    }),
  );
  return { rootId, orgId, wsId, memberId, editorRoleId, viewerRoleId };
}

test("changeWorkspaceMemberRole: Org Admin muda role de membro", async () => {
  const t = convexTest(schema, modules);
  const { orgId, wsId, memberId, viewerRoleId } = await setupOrgWorkspaceAndBinding(t);
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "admin@acme.io",
      passwordHash: "h",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: adminId, orgId, role: "admin", status: "active" }),
  );

  await t.mutation(internal.hierarchy.changeWorkspaceMemberRole, {
    callerId: adminId,
    workspaceId: wsId,
    userId: memberId,
    newRoleId: viewerRoleId,
  });

  const binding = await t.run((ctx) =>
    ctx.db
      .query("bindings")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", wsId).eq("userId", memberId),
      )
      .first(),
  );
  expect(binding?.roleId).toBe(viewerRoleId);
});

test("changeWorkspaceMemberRole: Root muda role de qualquer membro", async () => {
  const t = convexTest(schema, modules);
  const { rootId, wsId, memberId, viewerRoleId } = await setupOrgWorkspaceAndBinding(t);

  await t.mutation(internal.hierarchy.changeWorkspaceMemberRole, {
    callerId: rootId,
    workspaceId: wsId,
    userId: memberId,
    newRoleId: viewerRoleId,
  });

  const binding = await t.run((ctx) =>
    ctx.db
      .query("bindings")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", wsId).eq("userId", memberId),
      )
      .first(),
  );
  expect(binding?.roleId).toBe(viewerRoleId);
});

test("changeWorkspaceMemberRole: não-admin não pode mudar role", async () => {
  const t = convexTest(schema, modules);
  const { wsId, memberId, viewerRoleId } = await setupOrgWorkspaceAndBinding(t);
  const regularId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "regular@acme.io",
      passwordHash: "h",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  await expect(
    t.mutation(internal.hierarchy.changeWorkspaceMemberRole, {
      callerId: regularId,
      workspaceId: wsId,
      userId: memberId,
      newRoleId: viewerRoleId,
    }),
  ).rejects.toThrow("forbidden");
});

test("changeWorkspaceMemberRole: membro sem binding existente retorna not_found", async () => {
  const t = convexTest(schema, modules);
  const { rootId, wsId, viewerRoleId } = await setupOrgWorkspaceAndBinding(t);
  const noBindingUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "nobinding@acme.io",
      passwordHash: "h",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  await expect(
    t.mutation(internal.hierarchy.changeWorkspaceMemberRole, {
      callerId: rootId,
      workspaceId: wsId,
      userId: noBindingUserId,
      newRoleId: viewerRoleId,
    }),
  ).rejects.toThrow("not_found");
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

// ── Ciclo 16: reactivateOrg ──────────────────────────────────────────────────

test("reactivateOrg: Root reativa org suspensa e status volta para active", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "suspended", updatedAt: Date.now() }),
  );

  await t.mutation(internal.hierarchy.reactivateOrg, { callerId: rootId, orgId });

  const org = await t.run((ctx) => ctx.db.get(orgId));
  expect(org?.status).toBe("active");
});

test("reactivateOrg: não-Root não pode reativar org", async () => {
  const t = convexTest(schema, modules);
  const userId = await createRegularUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "suspended", updatedAt: Date.now() }),
  );

  await expect(
    t.mutation(internal.hierarchy.reactivateOrg, { callerId: userId, orgId }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 17: revokeOrgSessions ──────────────────────────────────────────────

test("revokeOrgSessions: Root revoga todas as sessões de todos os membros da org", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );
  const user1 = await t.run((ctx) =>
    ctx.db.insert("users", { email: "u1@acme.io", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );
  const user2 = await t.run((ctx) =>
    ctx.db.insert("users", { email: "u2@acme.io", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );
  await t.run((ctx) => ctx.db.insert("org_members", { userId: user1, orgId, role: "member", status: "active" }));
  await t.run((ctx) => ctx.db.insert("org_members", { userId: user2, orgId, role: "member", status: "active" }));
  const sess1 = await t.run((ctx) =>
    ctx.db.insert("sessions", { userId: user1, refreshTokenHash: "rth1", expiresAt: Date.now() + 60_000 }),
  );
  const sess2 = await t.run((ctx) =>
    ctx.db.insert("sessions", { userId: user2, refreshTokenHash: "rth2", expiresAt: Date.now() + 60_000 }),
  );

  const result = await t.mutation(internal.hierarchy.revokeOrgSessions, { callerId: rootId, orgId });

  expect(result.sessionsRevoked).toBe(2);
  const bl1 = await t.run((ctx) =>
    ctx.db.query("session_blacklist").withIndex("by_sessionId", (q) => q.eq("sessionId", sess1)).first(),
  );
  const bl2 = await t.run((ctx) =>
    ctx.db.query("session_blacklist").withIndex("by_sessionId", (q) => q.eq("sessionId", sess2)).first(),
  );
  expect(bl1).not.toBeNull();
  expect(bl2).not.toBeNull();
});

test("revokeOrgSessions: retorna zero quando org não tem membros com sessões", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );

  const result = await t.mutation(internal.hierarchy.revokeOrgSessions, { callerId: rootId, orgId });

  expect(result.sessionsRevoked).toBe(0);
});

test("revokeOrgSessions: não-Root não pode revogar sessões da org", async () => {
  const t = convexTest(schema, modules);
  const userId = await createRegularUser(t);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );

  await expect(
    t.mutation(internal.hierarchy.revokeOrgSessions, { callerId: userId, orgId }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 15: bootstrap de senha — createOrgWithBootstrap ────────────────────

test("createOrgWithBootstrap: admin novo recebe tempPassword e mustChangePassword=true", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);

  const result = await t.action(internal.auth.createOrgWithBootstrap, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail: "admin@acme.io",
  });

  expect(result.orgId).toBeTruthy();
  expect(result.adminTempPassword).toBeTypeOf("string");
  expect(result.adminTempPassword!.length).toBeGreaterThan(0);

  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );
  expect(adminUser?.mustChangePassword).toBe(true);
  expect(adminUser?.passwordHash).not.toBe("");
});

test("createOrgWithBootstrap: admin já existente não recebe tempPassword nem altera senha", async () => {
  const t = convexTest(schema, modules);
  const rootId = await createRootUser(t);
  const existingId = await createRegularUser(t, "existing@acme.io");
  const originalHash = (await t.run((ctx) => ctx.db.get(existingId)))?.passwordHash;

  const result = await t.action(internal.auth.createOrgWithBootstrap, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail: "existing@acme.io",
  });

  expect(result.orgId).toBeTruthy();
  expect(result.adminTempPassword).toBeNull();

  const user = await t.run((ctx) => ctx.db.get(existingId));
  expect(user?.passwordHash).toBe(originalHash);
  expect(user?.mustChangePassword).toBeFalsy();
});
