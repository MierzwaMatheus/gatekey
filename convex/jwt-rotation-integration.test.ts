// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import bcrypt from "bcryptjs";

const modules = import.meta.glob("./**/*.ts");

async function setupRootUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "root@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );
  return userId;
}

async function setupNonRootUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "user@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  return userId;
}

async function setupNonRootWithToken(t: ReturnType<typeof convexTest>) {
  await t.action(internal.jwt.initializeKeyPair, {});
  const PASSWORD = "User@Secret123";
  const hash = await bcrypt.hash(PASSWORD, 10);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Test Org", status: "active", updatedAt: Date.now() }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_settings", {
      orgId,
      loginMethods: ["email_password"],
      mfaRequired: false,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 86400,
      quotas: {},
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "nonroot@example.com",
      passwordHash: hash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  const login = await t.action(internal.auth.loginWithPassword, {
    email: "nonroot@example.com",
    password: PASSWORD,
  });
  if (!login.success) throw new Error("login failed");
  return login.accessToken;
}

// Ciclo 5 — testes de integração para POST /v1/auth/rotate-key

test("Root chama rotateKeyPair → JWKS retorna 2 chaves", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  await t.action(internal.jwt.rotateKeyPair, {});
  const { keys } = await t.action(internal.jwt.getJwks, {});
  expect(keys).toHaveLength(2);
});

test("após rotação, novos tokens são assinados com a chave nova e verifyJwt os aceita", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  await t.action(internal.jwt.rotateKeyPair, {});
  const token = await t.action(internal.jwt.signJwt, {
    sub: "user_abc",
    orgId: "org_abc",
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "sess_abc",
    expiresInSeconds: 3600,
  });
  const result = await t.action(internal.jwt.verifyJwt, { token });
  expect(result.valid).toBe(true);
});

test("JWKS retorna apenas 1 chave após keyRotationOverlapMs ter decorrido", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  await t.action(internal.jwt.rotateKeyPair, {});

  // Simular que o overlap expirou ajustando previousKeyCreatedAt para o passado
  await t.run(async (ctx) => {
    const activeKey = await ctx.db
      .query("key_pairs")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "active"))
      .order("desc")
      .first();
    if (activeKey) {
      await ctx.db.patch(activeKey._id, {
        previousKeyCreatedAt: Date.now() - 86400001, // overlap expirado
      });
    }
  });

  const { keys } = await t.action(internal.jwt.getJwks, {});
  expect(keys).toHaveLength(1);
});

test("usuário não-Root recebe 403 ao chamar POST /v1/auth/rotate-key", async () => {
  const t = convexTest(schema, modules);
  const token = await setupNonRootWithToken(t);
  const res = await t.fetch("/v1/auth/rotate-key", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(403);
  const body = await res.json() as { error: string; reason: string };
  expect(body.reason).toBe("root_required");
});

test("audit log registra evento auth.key_rotated após rotateKeyPair com actorId", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const rootUserId = await setupRootUser(t);

  await t.action(internal.jwt.rotateKeyPairWithActor, {
    actorId: rootUserId as unknown as string,
  });

  const auditEvents = await t.run(async (ctx) =>
    ctx.db.query("audit_log").collect(),
  );
  const rotationEvent = auditEvents.find((e) => e.action === "auth.key_rotated");
  expect(rotationEvent).toBeDefined();
  expect(rotationEvent?.actorId).toBe(rootUserId as unknown as string);
});
