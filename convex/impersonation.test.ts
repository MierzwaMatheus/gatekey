// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupUsers(t: ReturnType<typeof convexTest>) {
  await t.action(internal.jwt.initializeKeyPair, {});
  const rootUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );
  const targetUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "target@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  return { rootUserId, targetUserId };
}

// ── Ciclo 1: createImpersonationToken — claims e estrutura ───────────────────

test("createImpersonationToken: retorna JWT com sub=rootUserId e impersonating=targetUserId", async () => {
  const t = convexTest(schema, modules);
  const { rootUserId, targetUserId } = await setupUsers(t);

  const token = await t.action(internal.impersonation.createImpersonationToken, {
    rootUserId: rootUserId as unknown as string,
    targetUserId: targetUserId as unknown as string,
  });

  expect(token).toBeTypeOf("string");
  const payload = JSON.parse(atob(token.split(".")[1]!));
  expect(payload.sub).toBe(rootUserId as unknown as string);
  expect(payload.impersonating).toBe(targetUserId as unknown as string);
});

test("createImpersonationToken: token contém claim actor.type = root_impersonating", async () => {
  const t = convexTest(schema, modules);
  const { rootUserId, targetUserId } = await setupUsers(t);

  const token = await t.action(internal.impersonation.createImpersonationToken, {
    rootUserId: rootUserId as unknown as string,
    targetUserId: targetUserId as unknown as string,
  });

  const payload = JSON.parse(atob(token.split(".")[1]!));
  expect(payload.actor?.type).toBe("root_impersonating");
});

test("createImpersonationToken: exp é aproximadamente now + 3600 segundos", async () => {
  const t = convexTest(schema, modules);
  const { rootUserId, targetUserId } = await setupUsers(t);

  const before = Math.floor(Date.now() / 1000);
  const token = await t.action(internal.impersonation.createImpersonationToken, {
    rootUserId: rootUserId as unknown as string,
    targetUserId: targetUserId as unknown as string,
  });
  const after = Math.floor(Date.now() / 1000);

  const payload = JSON.parse(atob(token.split(".")[1]!));
  expect(payload.exp).toBeGreaterThanOrEqual(before + 3600);
  expect(payload.exp).toBeLessThanOrEqual(after + 3600);
});

// ── Ciclo 2: verifyImpersonationToken — validação e expiração ─────────────────

test("verifyImpersonationToken: retorna contexto correto para token válido", async () => {
  const t = convexTest(schema, modules);
  const { rootUserId, targetUserId } = await setupUsers(t);

  const token = await t.action(internal.impersonation.createImpersonationToken, {
    rootUserId: rootUserId as unknown as string,
    targetUserId: targetUserId as unknown as string,
  });

  const result = await t.action(internal.impersonation.verifyImpersonationToken, { token });
  expect(result.valid).toBe(true);
  if (result.valid) {
    expect(result.rootUserId).toBe(rootUserId as unknown as string);
    expect(result.targetUserId).toBe(targetUserId as unknown as string);
  }
});

// ── Ciclo 3: schema impersonation_sessions ───────────────────────────────────

test("impersonation_sessions: permite inserção e busca por rootUserId", async () => {
  const t = convexTest(schema, modules);
  const { rootUserId, targetUserId } = await setupUsers(t);

  const sessionId = await t.run((ctx) =>
    ctx.db.insert("impersonation_sessions", {
      rootUserId: rootUserId as unknown as string,
      targetUserId: targetUserId as unknown as string,
      tokenHash: "hash123",
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    }),
  );

  const found = await t.run((ctx) =>
    ctx.db
      .query("impersonation_sessions")
      .withIndex("by_rootUserId", (q) => q.eq("rootUserId", rootUserId as unknown as string))
      .first(),
  );

  expect(found).not.toBeNull();
  expect(found!._id).toBe(sessionId);
  expect(found!.targetUserId).toBe(targetUserId as unknown as string);
});

test("impersonation_sessions: permite busca por targetUserId", async () => {
  const t = convexTest(schema, modules);
  const { rootUserId, targetUserId } = await setupUsers(t);

  await t.run((ctx) =>
    ctx.db.insert("impersonation_sessions", {
      rootUserId: rootUserId as unknown as string,
      targetUserId: targetUserId as unknown as string,
      tokenHash: "hash456",
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    }),
  );

  const found = await t.run((ctx) =>
    ctx.db
      .query("impersonation_sessions")
      .withIndex("by_targetUserId", (q) => q.eq("targetUserId", targetUserId as unknown as string))
      .first(),
  );

  expect(found).not.toBeNull();
  expect(found!.rootUserId).toBe(rootUserId as unknown as string);
});

// ── Ciclo 4: createImpersonationToken persiste hash na tabela ─────────────────

test("createImpersonationToken: armazena registro em impersonation_sessions com tokenHash e expiresAt", async () => {
  const t = convexTest(schema, modules);
  const { rootUserId, targetUserId } = await setupUsers(t);

  const before = Date.now();
  await t.action(internal.impersonation.createImpersonationToken, {
    rootUserId: rootUserId as unknown as string,
    targetUserId: targetUserId as unknown as string,
  });
  const after = Date.now();

  const session = await t.run((ctx) =>
    ctx.db
      .query("impersonation_sessions")
      .withIndex("by_rootUserId", (q) => q.eq("rootUserId", rootUserId as unknown as string))
      .first(),
  );

  expect(session).not.toBeNull();
  expect(session!.targetUserId).toBe(targetUserId as unknown as string);
  expect(session!.tokenHash).toBeTypeOf("string");
  expect(session!.tokenHash.length).toBeGreaterThan(0);
  expect(session!.expiresAt).toBeGreaterThanOrEqual(before + 3600000 - 1000);
  expect(session!.expiresAt).toBeLessThanOrEqual(after + 3600000 + 1000);
  expect(session!.endedAt).toBeUndefined();
});

// ── Ciclo 5: endImpersonationSession ────────────────────────────────────────

test("endImpersonationSession: marca endedAt no registro da sessão", async () => {
  const t = convexTest(schema, modules);
  const { rootUserId, targetUserId } = await setupUsers(t);

  await t.action(internal.impersonation.createImpersonationToken, {
    rootUserId: rootUserId as unknown as string,
    targetUserId: targetUserId as unknown as string,
  });

  const session = await t.run((ctx) =>
    ctx.db
      .query("impersonation_sessions")
      .withIndex("by_rootUserId", (q) => q.eq("rootUserId", rootUserId as unknown as string))
      .first(),
  );
  expect(session!.endedAt).toBeUndefined();

  await t.mutation(internal.impersonationStore.endImpersonationSession, {
    impersonationSessionId: session!._id,
  });

  const updated = await t.run((ctx) => ctx.db.get(session!._id));
  expect(updated!.endedAt).toBeTypeOf("number");
  expect(updated!.endedAt).toBeGreaterThan(0);
});

test("endImpersonationSession: sessão encerrada faz verifyImpersonationToken retornar inválido", async () => {
  const t = convexTest(schema, modules);
  const { rootUserId, targetUserId } = await setupUsers(t);

  const token = await t.action(internal.impersonation.createImpersonationToken, {
    rootUserId: rootUserId as unknown as string,
    targetUserId: targetUserId as unknown as string,
  });

  const session = await t.run((ctx) =>
    ctx.db
      .query("impersonation_sessions")
      .withIndex("by_rootUserId", (q) => q.eq("rootUserId", rootUserId as unknown as string))
      .first(),
  );

  await t.mutation(internal.impersonationStore.endImpersonationSession, {
    impersonationSessionId: session!._id,
  });

  const result = await t.action(internal.impersonation.verifyImpersonationToken, { token });
  expect(result.valid).toBe(false);
  if (!result.valid) {
    expect(result.error).toMatch(/ended|revoked|invalid/i);
  }
});

// ── Ciclos 7 e 8: endpoints HTTP /v1/impersonation/start e /v1/impersonation/end ──

async function getJwtForRoot(
  t: ReturnType<typeof convexTest>,
  rootUserId: string,
  orgId: string,
) {
  return await t.action(internal.jwt.signJwt, {
    sub: rootUserId,
    orgId,
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "",
    expiresInSeconds: 3600,
  });
}

test("POST /v1/impersonation/start: Root recebe impersonationToken e expiresAt", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const rootUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root-start@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "StartOrg", status: "active", updatedAt: Date.now() }),
  );

  const targetUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "target-start@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const rootToken = await getJwtForRoot(t, rootUserId as unknown as string, orgId as unknown as string);

  const res = await t.fetch("/v1/impersonation/start", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${rootToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetUserId: targetUserId as unknown as string }),
  });

  expect(res.status).toBe(200);
  const body = await res.json() as Record<string, unknown>;
  expect(body.impersonationToken).toBeTypeOf("string");
  expect(body.expiresAt).toBeTypeOf("number");
});

test("POST /v1/impersonation/start: usuário não-Root recebe 403", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "nonroot-start@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "OtherOrg", status: "active", updatedAt: Date.now() }),
  );

  const targetUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "target-nonroot@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const token = await t.action(internal.jwt.signJwt, {
    sub: userId as unknown as string,
    orgId: orgId as unknown as string,
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "",
    expiresInSeconds: 3600,
  });

  const res = await t.fetch("/v1/impersonation/start", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetUserId: targetUserId as unknown as string }),
  });

  expect(res.status).toBe(403);
});

test("POST /v1/impersonation/end: Root encerra sessão e token fica inválido", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const rootUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root-end@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "EndOrg", status: "active", updatedAt: Date.now() }),
  );

  const targetUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "target-end@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const rootToken = await getJwtForRoot(t, rootUserId as unknown as string, orgId as unknown as string);

  const startRes = await t.fetch("/v1/impersonation/start", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${rootToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetUserId: targetUserId as unknown as string }),
  });
  const startBody = await startRes.json() as { impersonationToken: string };

  const session = await t.run((ctx) =>
    ctx.db
      .query("impersonation_sessions")
      .withIndex("by_rootUserId", (q) => q.eq("rootUserId", rootUserId as unknown as string))
      .first(),
  );

  const endRes = await t.fetch("/v1/impersonation/end", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${rootToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ impersonationSessionId: session!._id }),
  });

  expect(endRes.status).toBe(200);

  const verifyResult = await t.action(internal.impersonation.verifyImpersonationToken, {
    token: startBody.impersonationToken,
  });
  expect(verifyResult.valid).toBe(false);
});

// ── Ciclo 6: PEP aceita impersonation token e usa targetUserId como callerId ──

test("PEP: impersonation token válido não retorna 401 — usa targetUserId como callerId", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const rootUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root2@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "AcmeOrg", status: "active", updatedAt: Date.now() }),
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

  const targetUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "target2@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  await t.run((ctx) =>
    ctx.db.insert("org_members", {
      userId: targetUserId,
      orgId,
      role: "admin",
      status: "active",
    }),
  );

  const token = await t.action(internal.impersonation.createImpersonationToken, {
    rootUserId: rootUserId as unknown as string,
    targetUserId: targetUserId as unknown as string,
    targetOrgId: orgId as unknown as string,
  });

  const res = await t.fetch(`/v1/users/${targetUserId as unknown as string}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  expect(res.status).not.toBe(401);
});

test("PEP: token de impersonation com sessão encerrada retorna 401", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const rootUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root3@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "BetaOrg", status: "active", updatedAt: Date.now() }),
  );

  const targetUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "target3@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const token = await t.action(internal.impersonation.createImpersonationToken, {
    rootUserId: rootUserId as unknown as string,
    targetUserId: targetUserId as unknown as string,
    targetOrgId: orgId as unknown as string,
  });

  const session = await t.run((ctx) =>
    ctx.db
      .query("impersonation_sessions")
      .withIndex("by_rootUserId", (q) => q.eq("rootUserId", rootUserId as unknown as string))
      .first(),
  );
  await t.mutation(internal.impersonationStore.endImpersonationSession, {
    impersonationSessionId: session!._id,
  });

  const res = await t.fetch(`/v1/users/${targetUserId as unknown as string}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  expect(res.status).toBe(401);
});

// ── Ciclo 2 (continuação): verifyImpersonationToken ──────────────────────────

test("verifyImpersonationToken: token expirado (exp no passado) é rejeitado", async () => {
  const t = convexTest(schema, modules);
  const { rootUserId, targetUserId } = await setupUsers(t);

  const expiredToken = await t.action(internal.impersonation.createImpersonationToken, {
    rootUserId: rootUserId as unknown as string,
    targetUserId: targetUserId as unknown as string,
    expiresInSeconds: -10,
  });

  const result = await t.action(internal.impersonation.verifyImpersonationToken, {
    token: expiredToken,
  });
  expect(result.valid).toBe(false);
});
