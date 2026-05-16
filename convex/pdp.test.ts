import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── checkUserActive ──────────────────────────────────────────────────────────

test("checkUserActive: retorna true para usuário ativo", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "active@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkUserActive, { userId });
  });
  expect(result).toBe(true);
});

test("checkUserActive: retorna false para usuário suspenso", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "suspended@example.com",
      passwordHash: "hash",
      status: "suspended",
      loginAttempts: 0,
      updatedAt: Date.now(),
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkUserActive, { userId });
  });
  expect(result).toBe(false);
});

// ── checkSessionValid ────────────────────────────────────────────────────────

test("checkSessionValid: retorna true para sessão válida e não blacklistada", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await t.run(async (ctx) => {
    return await ctx.db.insert("sessions", {
      userId: await ctx.db.insert("users", {
        email: "u@example.com",
        passwordHash: "h",
        status: "active",
        loginAttempts: 0,
        updatedAt: Date.now(),
      }),
      refreshTokenHash: "rth",
      expiresAt: Date.now() + 60_000,
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkSessionValid, { sessionId });
  });
  expect(result).toBe(true);
});

test("checkSessionValid: retorna false para sessão na blacklist", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await t.run(async (ctx) => {
    const sid = await ctx.db.insert("sessions", {
      userId: await ctx.db.insert("users", {
        email: "u2@example.com",
        passwordHash: "h",
        status: "active",
        loginAttempts: 0,
        updatedAt: Date.now(),
      }),
      refreshTokenHash: "rth",
      expiresAt: Date.now() + 60_000,
    });
    await ctx.db.insert("session_blacklist", { sessionId: sid, expiresAt: Date.now() + 60_000 });
    return sid;
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkSessionValid, { sessionId });
  });
  expect(result).toBe(false);
});

test("checkSessionValid: retorna false para sessão expirada", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await t.run(async (ctx) => {
    return await ctx.db.insert("sessions", {
      userId: await ctx.db.insert("users", {
        email: "u3@example.com",
        passwordHash: "h",
        status: "active",
        loginAttempts: 0,
        updatedAt: Date.now(),
      }),
      refreshTokenHash: "rth",
      expiresAt: Date.now() - 1,
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkSessionValid, { sessionId });
  });
  expect(result).toBe(false);
});

test("checkUserActive: retorna false para usuário deletado", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "deleted@example.com",
      passwordHash: "hash",
      status: "deleted",
      loginAttempts: 0,
      updatedAt: Date.now(),
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkUserActive, { userId });
  });
  expect(result).toBe(false);
});

// ── checkApiKeyValid ─────────────────────────────────────────────────────────

test("checkApiKeyValid: retorna true para api_key ativa", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    await ctx.db.insert("api_keys", {
      orgId,
      publicId: "gk_live_pk_abc123",
      secretHash: "h",
      scopes: ["check"],
      description: "test key",
      status: "active",
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkApiKeyValid, { publicId: "gk_live_pk_abc123" });
  });
  expect(result).toBe(true);
});

test("checkApiKeyValid: retorna false para api_key revogada", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    await ctx.db.insert("api_keys", {
      orgId,
      publicId: "gk_live_pk_revoked",
      secretHash: "h",
      scopes: ["check"],
      description: "revoked key",
      status: "revoked",
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkApiKeyValid, { publicId: "gk_live_pk_revoked" });
  });
  expect(result).toBe(false);
});

test("checkApiKeyValid: retorna false para publicId inexistente", async () => {
  const t = convexTest(schema, modules);
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkApiKeyValid, { publicId: "gk_live_pk_nonexistent" });
  });
  expect(result).toBe(false);
});

// ── checkApiKeyScope ─────────────────────────────────────────────────────────

test("checkApiKeyScope: retorna true quando scope está presente", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    await ctx.db.insert("api_keys", {
      orgId,
      publicId: "gk_live_pk_scoped",
      secretHash: "h",
      scopes: ["check", "users:read"],
      description: "scoped key",
      status: "active",
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkApiKeyScope, {
      publicId: "gk_live_pk_scoped",
      requiredScope: "check",
    });
  });
  expect(result).toBe(true);
});

test("checkApiKeyScope: retorna false quando scope está ausente", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    await ctx.db.insert("api_keys", {
      orgId,
      publicId: "gk_live_pk_limited",
      secretHash: "h",
      scopes: ["check"],
      description: "limited key",
      status: "active",
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkApiKeyScope, {
      publicId: "gk_live_pk_limited",
      requiredScope: "users:write",
    });
  });
  expect(result).toBe(false);
});

// ── findDirectBinding ────────────────────────────────────────────────────────

test("findDirectBinding: retorna binding quando existe correspondência direta", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId, roleId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "bound@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    const wsId = await ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" });
    const rId = await ctx.db.insert("roles", { name: "editor", isBase: true });
    await ctx.db.insert("bindings", {
      userId: uid, roleId: rId, resourceType: "document", resourceId: "doc_1", workspaceId: wsId,
    });
    return { userId: uid, workspaceId: wsId, roleId: rId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.findDirectBinding, {
      userId, resourceType: "document", resourceId: "doc_1",
    });
  });
  expect(result).not.toBeNull();
  expect(result?.roleId).toBe(roleId);
});

test("findDirectBinding: retorna null quando não existe binding direto", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "unbound@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.findDirectBinding, {
      userId, resourceType: "document", resourceId: "doc_999",
    });
  });
  expect(result).toBeNull();
});

// ── findWorkspaceBinding ─────────────────────────────────────────────────────

test("findWorkspaceBinding: retorna binding de workspace quando existe", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId, roleId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "wsmember@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    const wsId = await ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" });
    const rId = await ctx.db.insert("roles", { name: "viewer", isBase: true });
    await ctx.db.insert("bindings", {
      userId: uid, roleId: rId, resourceType: "workspace", workspaceId: wsId,
    });
    return { userId: uid, workspaceId: wsId, roleId: rId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.findWorkspaceBinding, { userId, workspaceId });
  });
  expect(result).not.toBeNull();
  expect(result?.roleId).toBe(roleId);
});

test("findWorkspaceBinding: retorna null quando não existe binding de workspace", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "nowsbinding@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    const wsId = await ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" });
    return { userId: uid, workspaceId: wsId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.findWorkspaceBinding, { userId, workspaceId });
  });
  expect(result).toBeNull();
});

// ── checkWorkspaceMembership ──────────────────────────────────────────────────

test("checkWorkspaceMembership: retorna true para membro ativo", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "member@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    const wsId = await ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" });
    await ctx.db.insert("workspace_members", { userId: uid, workspaceId: wsId, status: "active" });
    return { userId: uid, workspaceId: wsId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkWorkspaceMembership, { userId, workspaceId });
  });
  expect(result).toBe(true);
});

test("checkWorkspaceMembership: retorna false quando não há registro", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "nomember@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    const wsId = await ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" });
    return { userId: uid, workspaceId: wsId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkWorkspaceMembership, { userId, workspaceId });
  });
  expect(result).toBe(false);
});

test("checkWorkspaceMembership: retorna false para membro removido", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "removed@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    const wsId = await ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" });
    await ctx.db.insert("workspace_members", { userId: uid, workspaceId: wsId, status: "removed" });
    return { userId: uid, workspaceId: wsId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkWorkspaceMembership, { userId, workspaceId });
  });
  expect(result).toBe(false);
});
