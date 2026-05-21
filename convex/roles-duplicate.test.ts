/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import bcrypt from "bcryptjs";

const modules = import.meta.glob("./**/*.ts");

async function setupBase(t: ReturnType<typeof convexTest>) {
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

  await t.run((ctx) => ctx.db.insert("roles", { name: "admin", isBase: true }));

  const PASSWORD = "Admin@Test123";
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "TestCorp",
    adminEmail: "admin@testcorp.io",
  });

  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@testcorp.io")).first(),
  );
  await t.run((ctx) => ctx.db.patch(adminUser!._id, { passwordHash }));
  const adminId = adminUser!._id;

  const workspaceId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Main WS",
  });

  const login = await t.action(internal.auth.loginWithPassword, {
    email: "admin@testcorp.io",
    password: PASSWORD,
  });
  if (!login.success) throw new Error("login failed in setup");

  return { rootId, orgId, adminId, workspaceId, token: login.accessToken };
}

// ── POST /v1/roles/:id/duplicate ──────────────────────────────────────────────

test("POST /v1/roles/:id/duplicate: duplica role com 3 capabilities, retorna novo role", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, workspaceId, token } = await setupBase(t);

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "designer", isBase: false, workspaceId }),
  );
  const cap1 = await t.run((ctx) =>
    ctx.db.insert("capabilities", { name: "doc:read", description: "Read", isBase: true }),
  );
  const cap2 = await t.run((ctx) =>
    ctx.db.insert("capabilities", { name: "doc:write", description: "Write", isBase: true }),
  );
  const cap3 = await t.run((ctx) =>
    ctx.db.insert("capabilities", { name: "report:export", description: "Export", isBase: true }),
  );
  await t.run((ctx) => ctx.db.insert("role_capabilities", { roleId, capabilityId: cap1 }));
  await t.run((ctx) => ctx.db.insert("role_capabilities", { roleId, capabilityId: cap2 }));
  await t.run((ctx) => ctx.db.insert("role_capabilities", { roleId, capabilityId: cap3 }));

  const res = await t.fetch(`/v1/roles/${roleId as string}/duplicate?workspaceId=${workspaceId as string}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.name).toBe("Cópia de designer");
  expect(body.isBase).toBe(false);
  expect(body.capabilities).toHaveLength(3);
});

test("POST /v1/roles/:id/duplicate: quota atingida retorna 429 QuotaExceeded", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, token } = await setupBase(t);

  const settings = await t.run((ctx) =>
    ctx.db.query("org_settings").filter((q) => q.eq(q.field("orgId"), orgId)).first(),
  );
  await t.run((ctx) =>
    ctx.db.patch(settings!._id, { quotas: { ...settings!.quotas, roles_per_workspace: 1 } }),
  );

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "at-limit", isBase: false, workspaceId }),
  );

  const res = await t.fetch(`/v1/roles/${roleId as string}/duplicate?workspaceId=${workspaceId as string}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status).toBe(429);
  const body = await res.json();
  expect(body.error).toBe("QuotaExceeded");
  expect(body.quota).toBe("roles_per_workspace");
});

test("POST /v1/roles/:id/duplicate: sem autenticação retorna 401", async () => {
  const t = convexTest(schema, modules);
  const { workspaceId } = await setupBase(t);

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "some-role", isBase: false, workspaceId }),
  );

  const res = await t.fetch(`/v1/roles/${roleId as string}/duplicate`, {
    method: "POST",
  });

  expect(res.status).toBe(401);
});
