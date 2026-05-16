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
