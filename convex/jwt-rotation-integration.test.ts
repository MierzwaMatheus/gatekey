// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

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
