/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setupCheckContext(t: ReturnType<typeof convexTest>) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "user@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
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
      quotas: {},
    }),
  );

  const workspaceId = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId, name: "Main", status: "active" }),
  );

  await t.run((ctx) =>
    ctx.db.insert("workspace_members", {
      userId,
      workspaceId,
      status: "active",
    }),
  );

  const capabilityId = await t.run((ctx) =>
    ctx.db.insert("capabilities", {
      name: "document:read",
      description: "Read documents",
      isBase: true,
    }),
  );

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: true }),
  );

  await t.run((ctx) =>
    ctx.db.insert("role_capabilities", { roleId, capabilityId }),
  );

  return { userId, orgId, workspaceId, roleId };
}

// ── Ciclo 1: performCheck retorna allowed:true com binding correto ─────────────

test("performCheck: retorna allowed:true com binding direto e grava audit log", async () => {
  const t = convexTest(schema, modules);
  const { userId, orgId, workspaceId, roleId } = await setupCheckContext(t);

  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId,
      resourceType: "document",
      resourceId: "doc_abc",
      workspaceId,
    }),
  );

  const result = await t.action(internal.check.performCheck, {
    callerId: userId,
    orgId,
    userId,
    capability: "document:read",
    resourceType: "document",
    resourceId: "doc_abc",
    workspaceId,
  });

  expect(result).toEqual({ allowed: true, reason: "direct_binding" });

  const auditEntry = await t.run((ctx) =>
    ctx.db.query("audit_log").order("desc").first(),
  );
  expect(auditEntry).not.toBeNull();
  expect(auditEntry!.action).toBe("permission.check");
  expect(auditEntry!.result).toBe("allow");
});

// ── Ciclo 2: sem binding retorna no_binding_found ─────────────────────────────

test("performCheck: retorna allowed:false reason no_binding_found sem binding", async () => {
  const t = convexTest(schema, modules);
  const { userId, orgId, workspaceId } = await setupCheckContext(t);

  const result = await t.action(internal.check.performCheck, {
    callerId: userId,
    orgId,
    userId,
    capability: "document:read",
    resourceType: "document",
    resourceId: "doc_xyz",
    workspaceId,
  });

  expect(result).toEqual({ allowed: false, reason: "no_binding_found" });

  const auditEntry = await t.run((ctx) =>
    ctx.db.query("audit_log").order("desc").first(),
  );
  expect(auditEntry!.result).toBe("deny");
  expect(auditEntry!.reason).toBe("no_binding_found");
});

// ── Ciclo 3: usuário suspenso retorna user_inactive ───────────────────────────

test("performCheck: retorna allowed:false reason user_inactive com usuário suspenso", async () => {
  const t = convexTest(schema, modules);
  const { userId, orgId, workspaceId, roleId } = await setupCheckContext(t);

  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId,
      resourceType: "document",
      resourceId: "doc_abc",
      workspaceId,
    }),
  );

  await t.run(async (ctx) => {
    await ctx.db.patch(userId, { status: "suspended" });
  });

  const result = await t.action(internal.check.performCheck, {
    callerId: userId,
    orgId,
    userId,
    capability: "document:read",
    resourceType: "document",
    resourceId: "doc_abc",
    workspaceId,
  });

  expect(result).toEqual({ allowed: false, reason: "user_inactive" });

  const auditEntry = await t.run((ctx) =>
    ctx.db.query("audit_log").order("desc").first(),
  );
  expect(auditEntry!.result).toBe("deny");
  expect(auditEntry!.reason).toBe("user_inactive");
});
