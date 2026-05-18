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
