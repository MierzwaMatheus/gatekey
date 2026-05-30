// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { getRateLimitKey } from "./rateLimit";
import bcrypt from "bcryptjs";

const modules = import.meta.glob("./**/*.ts");

test("getRateLimitKey retorna string determinística rl:<endpoint>:<identifier>", () => {
  const ip = "192.168.1.1";
  expect(getRateLimitKey("login", ip)).toBe("rl:login:192.168.1.1");
  expect(getRateLimitKey("login", ip)).toBe(getRateLimitKey("login", ip));
});

test("checkRateLimit retorna {allowed: true, remaining: N} dentro do limite", async () => {
  const t = convexTest(schema, modules);

  const result = await t.mutation(internal.rateLimit.checkRateLimit, {
    key: "rl:test:127.0.0.1",
    limit: 5,
    windowMs: 60000,
  });

  expect(result.allowed).toBe(true);
  expect(result.remaining).toBe(4); // limit - 1 após primeiro uso
});

test("checkRateLimit retorna {allowed: false, retryAfterMs: N} quando limite atingido", async () => {
  const t = convexTest(schema, modules);

  const key = "rl:test:10.0.0.1";
  const limit = 3;
  const windowMs = 60000;

  for (let i = 0; i < limit; i++) {
    await t.mutation(internal.rateLimit.checkRateLimit, { key, limit, windowMs });
  }

  const result = await t.mutation(internal.rateLimit.checkRateLimit, { key, limit, windowMs });

  expect(result.allowed).toBe(false);
  expect(result.retryAfterMs).toBeGreaterThan(0);
});

test("após windowMs expirar, contador é zerado e checkRateLimit volta a retornar allowed: true", async () => {
  const t = convexTest(schema, modules);

  const key = "rl:test:expired";
  const limit = 2;
  const windowMs = 100; // janela muito curta

  // Esgotar limite
  for (let i = 0; i < limit; i++) {
    await t.mutation(internal.rateLimit.checkRateLimit, { key, limit, windowMs });
  }

  // Verificar bloqueio
  const blocked = await t.mutation(internal.rateLimit.checkRateLimit, { key, limit, windowMs });
  expect(blocked.allowed).toBe(false);

  // Simular expiração da janela inserindo contador com windowStart no passado
  await t.run(async (ctx) => {
    const counter = await ctx.db
      .query("rate_limit_counters")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (counter) {
      await ctx.db.patch(counter._id, { windowStart: Date.now() - windowMs - 1 });
    }
  });

  // Após expirar, deve permitir novamente
  const result = await t.mutation(internal.rateLimit.checkRateLimit, { key, limit, windowMs });
  expect(result.allowed).toBe(true);
});

// ── Integração: login rate limit ──────────────────────────────────────────────

async function setupLoginEnv(t: ReturnType<typeof convexTest>) {
  await t.action(internal.jwt.initializeKeyPair, {});
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "TestOrg", status: "active", updatedAt: Date.now() }),
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
  const passwordHash = await bcrypt.hash("password123", 10);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "rl@test.io",
      passwordHash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", {
      userId: userId as never,
      orgId: orgId as never,
      role: "member",
      status: "active",
    }),
  );
  return { orgId, userId };
}

test("11 chamadas ao login com mesmo IP — a 11ª retorna rate_limit_exceeded", async () => {
  const t = convexTest(schema, modules);
  await setupLoginEnv(t);

  const ip = "203.0.113.1";
  let lastResult: { success: boolean; error?: string; retryAfterMs?: number } | null = null;

  for (let i = 0; i < 11; i++) {
    lastResult = await t.action(internal.auth.loginWithPassword, {
      email: "rl@test.io",
      password: "password123",
      ip,
    }) as { success: boolean; error?: string; retryAfterMs?: number };
  }

  expect(lastResult?.success).toBe(false);
  expect((lastResult as { error?: string })?.error).toBe("rate_limit_exceeded");
  // (test: 11ª chamada)
});

test("retryAfterMs é positivo quando rate limit excedido no login", async () => {
  const t = convexTest(schema, modules);
  await setupLoginEnv(t);

  const ip = "203.0.113.2";

  for (let i = 0; i < 10; i++) {
    await t.action(internal.auth.loginWithPassword, {
      email: "rl@test.io",
      password: "password123",
      ip,
    });
  }

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "rl@test.io",
    password: "password123",
    ip,
  }) as { success: boolean; error?: string; retryAfterMs?: number };

  expect(result.success).toBe(false);
  expect(result.error).toBe("rate_limit_exceeded");
  expect(result.retryAfterMs).toBeGreaterThan(0);
});

// ── Integração: refresh rate limit ────────────────────────────────────────────

test("21 chamadas ao refresh com mesmo IP — a 21ª retorna rate_limit_exceeded", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const ip = "203.0.113.3";

  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "refresh-rl@test.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId,
      refreshTokenHash: "hash",
      expiresAt: Date.now() + 9999999,
      ip: "1.2.3.4",
      deviceInfo: "test",
    }),
  );
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() }),
  );

  let lastResult: { success: boolean; error?: string } | null = null;

  for (let i = 0; i < 21; i++) {
    lastResult = await t.action(internal.auth.refreshTokens, {
      sessionId: sessionId as never,
      refreshToken: "token",
      orgId: orgId as string,
      ip,
    }) as { success: boolean; error?: string };
  }

  expect(lastResult?.success).toBe(false);
  expect((lastResult as { error?: string })?.error).toBe("rate_limit_exceeded");
  // (test: 21ª chamada ao refresh)
});

// ── Integração: check rate limit por orgId ────────────────────────────────────

async function setupCheckRateLimitEnv(t: ReturnType<typeof convexTest>, checkPerMin?: number) {
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "CheckOrg", status: "active", updatedAt: Date.now() }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_settings", {
      orgId,
      loginMethods: ["email_password"],
      mfaRequired: false,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 2592000,
      quotas: {},
      rateLimits: checkPerMin !== undefined ? { checkPerMin } : undefined,
    }),
  );
  return { orgId };
}

test("org com checkPerMin: 5 — 6ª chamada ao checkOrgRateLimit retorna allowed: false", async () => {
  const t = convexTest(schema, modules);
  const { orgId } = await setupCheckRateLimitEnv(t, 5);

  for (let i = 0; i < 5; i++) {
    await t.mutation(internal.rateLimit.checkOrgRateLimit, {
      orgId: orgId as never,
      endpoint: "check",
      defaultLimit: 100,
      windowMs: 60000,
    });
  }

  const result = await t.mutation(internal.rateLimit.checkOrgRateLimit, {
    orgId: orgId as never,
    endpoint: "check",
    defaultLimit: 100,
    windowMs: 60000,
  });

  expect(result.allowed).toBe(false);
});

test("org diferente não é afetada pelo rate limit de outra org", async () => {
  const t = convexTest(schema, modules);
  const { orgId: orgA } = await setupCheckRateLimitEnv(t, 2);
  const { orgId: orgB } = await setupCheckRateLimitEnv(t, 2);

  for (let i = 0; i < 2; i++) {
    await t.mutation(internal.rateLimit.checkOrgRateLimit, {
      orgId: orgA as never,
      endpoint: "check",
      defaultLimit: 100,
      windowMs: 60000,
    });
  }
  const blockedA = await t.mutation(internal.rateLimit.checkOrgRateLimit, {
    orgId: orgA as never,
    endpoint: "check",
    defaultLimit: 100,
    windowMs: 60000,
  });
  expect(blockedA.allowed).toBe(false);

  const allowedB = await t.mutation(internal.rateLimit.checkOrgRateLimit, {
    orgId: orgB as never,
    endpoint: "check",
    defaultLimit: 100,
    windowMs: 60000,
  });
  expect(allowedB.allowed).toBe(true);
});

test("audit log registra ratelimit.exceeded quando checkOrgRateLimit bloqueia", async () => {
  const t = convexTest(schema, modules);
  const { orgId } = await setupCheckRateLimitEnv(t, 1);

  await t.mutation(internal.rateLimit.checkOrgRateLimit, {
    orgId: orgId as never,
    endpoint: "check",
    defaultLimit: 100,
    windowMs: 60000,
  });
  await t.mutation(internal.rateLimit.checkOrgRateLimit, {
    orgId: orgId as never,
    endpoint: "check",
    defaultLimit: 100,
    windowMs: 60000,
  });

  const auditEvents = await t.run((ctx) => ctx.db.query("audit_log").collect());
  const rateLimitEvent = auditEvents.find((e) => e.action === "ratelimit.exceeded");
  expect(rateLimitEvent).toBeDefined();
  expect(rateLimitEvent?.target.type).toBe("check");
});

// ── Integração: check/batch rate limit por orgId ──────────────────────────────

test("org com checkBatchPerMin: 3 — 4ª chamada ao checkOrgRateLimit(checkBatch) retorna allowed: false", async () => {
  const t = convexTest(schema, modules);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "BatchOrg", status: "active", updatedAt: Date.now() }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_settings", {
      orgId,
      loginMethods: ["email_password"],
      mfaRequired: false,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 2592000,
      quotas: {},
      rateLimits: { checkBatchPerMin: 3 },
    }),
  );

  for (let i = 0; i < 3; i++) {
    await t.mutation(internal.rateLimit.checkOrgRateLimit, {
      orgId: orgId as never,
      endpoint: "checkBatch",
      defaultLimit: 20,
      windowMs: 60000,
    });
  }

  const result = await t.mutation(internal.rateLimit.checkOrgRateLimit, {
    orgId: orgId as never,
    endpoint: "checkBatch",
    defaultLimit: 20,
    windowMs: 60000,
  });

  expect(result.allowed).toBe(false);
});
