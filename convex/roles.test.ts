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
