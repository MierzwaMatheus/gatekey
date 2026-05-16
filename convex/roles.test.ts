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

// ── Ciclo 4: listCapabilities ─────────────────────────────────────────────────

test("listCapabilities: retorna capabilities base globais (isBase=true)", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdminAndWorkspace(t);

  await t.run((ctx) =>
    ctx.db.insert("capabilities", { name: "document:read", description: "Read docs", isBase: true }),
  );

  const caps = await t.query(internal.roles.listCapabilities, { callerId: adminId, orgId });
  expect(caps.some((c) => c.name === "document:read" && c.isBase)).toBe(true);
});

test("listCapabilities: retorna capabilities customizadas da org do caller", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdminAndWorkspace(t);

  await t.run((ctx) =>
    ctx.db.insert("capabilities", {
      orgId,
      name: "pipeline:deploy",
      description: "Deploy pipelines",
      isBase: false,
    }),
  );

  const caps = await t.query(internal.roles.listCapabilities, { callerId: adminId, orgId });
  expect(caps.some((c) => c.name === "pipeline:deploy")).toBe(true);
});

test("listCapabilities: NÃO retorna capabilities de outra org", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, rootId } = await setupOrgWithAdminAndWorkspace(t);

  const orgB = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Other Corp",
    adminEmail: "admin@other.io",
  });

  await t.run((ctx) =>
    ctx.db.insert("capabilities", {
      orgId: orgB,
      name: "secret:access",
      description: "Secret",
      isBase: false,
    }),
  );

  const caps = await t.query(internal.roles.listCapabilities, { callerId: adminId, orgId });
  expect(caps.some((c) => c.name === "secret:access")).toBe(false);
});

test("listCapabilities: throws forbidden quando caller não é org_admin", async () => {
  const t = convexTest(schema, modules);
  const { orgId } = await setupOrgWithAdminAndWorkspace(t);

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
    t.query(internal.roles.listCapabilities, { callerId: memberId, orgId }),
  ).rejects.toThrow("forbidden");
});

// ── Ciclo 5: createCapability ─────────────────────────────────────────────────

test("createCapability: org_admin cria capability customizada", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdminAndWorkspace(t);

  const result = await t.mutation(internal.roles.createCapability, {
    callerId: adminId,
    orgId,
    name: "pipeline:deploy",
    description: "Deploy pipelines",
  });

  expect(result.id).toBeTruthy();
  expect(result.name).toBe("pipeline:deploy");
  expect(result.isBase).toBe(false);
});

test("createCapability: throws quota_exceeded quando org está no limite", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdminAndWorkspace(t);

  await t.run(async (ctx) => {
    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();
    if (settings) {
      await ctx.db.patch(settings._id, {
        quotas: { ...settings.quotas, capabilities_per_org: 1 },
      });
    }
    await ctx.db.insert("capabilities", {
      orgId,
      name: "existing:cap",
      description: "Existing",
      isBase: false,
    });
  });

  await expect(
    t.mutation(internal.roles.createCapability, {
      callerId: adminId,
      orgId,
      name: "extra:cap",
      description: "Extra",
    }),
  ).rejects.toThrow("quota_exceeded");
});

test("createCapability: throws forbidden quando caller não é org_admin", async () => {
  const t = convexTest(schema, modules);
  const { orgId } = await setupOrgWithAdminAndWorkspace(t);

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
    t.mutation(internal.roles.createCapability, {
      callerId: memberId,
      orgId,
      name: "doc:read",
      description: "Read docs",
    }),
  ).rejects.toThrow("forbidden");
});

test("createCapability: root pode criar capability em qualquer org", async () => {
  const t = convexTest(schema, modules);
  const { rootId, orgId } = await setupOrgWithAdminAndWorkspace(t);

  const result = await t.mutation(internal.roles.createCapability, {
    callerId: rootId,
    orgId,
    name: "report:export",
    description: "Export reports",
  });

  expect(result.name).toBe("report:export");
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
