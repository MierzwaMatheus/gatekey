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
