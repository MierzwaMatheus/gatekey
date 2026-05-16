/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Ciclo 1: listRoles ────────────────────────────────────────────────────────

test("listRoles: retorna roles base (isBase=true) independente de workspaceId", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const roles = await t.query(internal.roles.listRoles, {
    callerId: adminId,
    orgId,
    workspaceId,
  });

  expect(roles.some((r) => r.isBase === true)).toBe(true);
});

test("listRoles: retorna roles customizados do workspace solicitado", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  await t.run((ctx) =>
    ctx.db.insert("roles", { name: "reviewer", isBase: false, workspaceId }),
  );

  const roles = await t.query(internal.roles.listRoles, {
    callerId: adminId,
    orgId,
    workspaceId,
  });

  expect(roles.some((r) => r.name === "reviewer")).toBe(true);
});

test("listRoles: não retorna roles customizados de outro workspace", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId, rootId } = await setupOrgWithAdminAndWorkspace(t);

  const otherWorkspaceId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Other Workspace",
  });

  await t.run((ctx) =>
    ctx.db.insert("roles", { name: "devops", isBase: false, workspaceId: otherWorkspaceId }),
  );

  const roles = await t.query(internal.roles.listRoles, {
    callerId: adminId,
    orgId,
    workspaceId,
  });

  expect(roles.some((r) => r.name === "devops")).toBe(false);
});

test("listRoles: throws forbidden quando caller não existe na org como admin", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  // Usuário existe mas não pertence à org
  const nonMemberId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "stranger@other.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  await expect(
    t.query(internal.roles.listRoles, { callerId: nonMemberId, orgId, workspaceId }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 2: createRole ───────────────────────────────────────────────────────

test("createRole: org_admin cria role customizado no workspace", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const result = await t.mutation(internal.roles.createRole, {
    callerId: adminId,
    orgId,
    workspaceId,
    name: "reviewer",
  });

  expect(result.id).toBeTruthy();
  expect(result.name).toBe("reviewer");
  expect(result.isBase).toBe(false);
});

test("createRole: throws quota_exceeded quando workspace está no limite de roles", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  await t.run(async (ctx) => {
    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();
    if (settings) {
      await ctx.db.patch(settings._id, {
        quotas: { ...settings.quotas, roles_per_workspace: 1 },
      });
    }
    await ctx.db.insert("roles", { name: "existing", isBase: false, workspaceId });
  });

  await expect(
    t.mutation(internal.roles.createRole, { callerId: adminId, orgId, workspaceId, name: "extra" }),
  ).rejects.toThrow("quota_exceeded");
});

test("createRole: throws forbidden quando caller não é org_admin", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

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

  await expect(
    t.mutation(internal.roles.createRole, { callerId: memberId, orgId, workspaceId, name: "reviewer" }),
  ).rejects.toThrow("forbidden");
});

test("createRole: root pode criar role em qualquer workspace", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const result = await t.mutation(internal.roles.createRole, {
    callerId: rootId,
    orgId,
    workspaceId,
    name: "devops",
  });

  expect(result.name).toBe("devops");
});

// ── Ciclo 3: deleteRole ───────────────────────────────────────────────────────

test("deleteRole: org_admin deleta role customizado sem bindings ativos", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "reviewer", isBase: false, workspaceId }),
  );

  const result = await t.mutation(internal.roles.deleteRole, { callerId: adminId, orgId, roleId });
  expect(result).toBeNull();

  const deleted = await t.run((ctx) => ctx.db.get(roleId));
  expect(deleted).toBeNull();
});

test("deleteRole: throws role_has_active_bindings quando existem bindings", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "reviewer", isBase: false, workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId: adminId,
      roleId,
      resourceType: "workspace",
      workspaceId,
    }),
  );

  await expect(
    t.mutation(internal.roles.deleteRole, { callerId: adminId, orgId, roleId }),
  ).rejects.toThrow("role_has_active_bindings");
});

test("deleteRole: throws forbidden quando caller não é org_admin", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "reviewer", isBase: false, workspaceId }),
  );
  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "member@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  await expect(
    t.mutation(internal.roles.deleteRole, { callerId: memberId, orgId, roleId }),
  ).rejects.toThrow("forbidden");
});

test("deleteRole: throws forbidden ao tentar deletar role base", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdminAndWorkspace(t);

  const baseRoleId = await t.run((ctx) =>
    ctx.db.query("roles").filter((q) => q.eq(q.field("isBase"), true)).first().then((r) => r!._id),
  );

  await expect(
    t.mutation(internal.roles.deleteRole, { callerId: adminId, orgId, roleId: baseRoleId }),
  ).rejects.toThrow("forbidden");
});

test("deleteRole: throws not_found quando roleId não existe", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

  const fakeRoleId = workspaceId as unknown as import("./_generated/dataModel").Id<"roles">;

  await expect(
    t.mutation(internal.roles.deleteRole, { callerId: adminId, orgId, roleId: fakeRoleId }),
  ).rejects.toThrow();
});

test("listRoles: throws forbidden quando caller não é org_admin", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId } = await setupOrgWithAdminAndWorkspace(t);

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

  await expect(
    t.query(internal.roles.listRoles, { callerId: memberId, orgId, workspaceId }),
  ).rejects.toThrow("forbidden");
});
