// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import bcrypt from "bcryptjs";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setupBatchContext(t: ReturnType<typeof convexTest>) {
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
    ctx.db.insert("workspace_members", { userId, workspaceId, status: "active" }),
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

// ── Ciclo 1: array vazio ─────────────────────────────────────────────────────

test("checkBatch: array vazio retorna array vazio", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId } = await setupBatchContext(t);

  const result = await t.action(internal.checkBatch.performCheckBatch, {
    callerId: userId,
    orgId,
    workspaceId,
    items: [],
  });

  expect(result).toEqual([]);
});

// ── Ciclo 2: usuário suspenso → user_inactive ─────────────────────────────────

test("checkBatch: item com usuário suspenso retorna user_inactive naquele índice", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId } = await setupBatchContext(t);

  await t.run(async (ctx) => {
    await ctx.db.patch(userId, { status: "suspended" });
  });

  const result = await t.action(internal.checkBatch.performCheckBatch, {
    callerId: userId,
    orgId,
    workspaceId,
    items: [
      { userId, capability: "document:read", resourceType: "document", resourceId: "doc_abc" },
    ],
  });

  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({ allowed: false, reason: "user_inactive" });
});

// ── Ciclo 3: sem binding → no_binding_found ───────────────────────────────────

test("checkBatch: item sem binding retorna no_binding_found naquele índice", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId } = await setupBatchContext(t);

  const result = await t.action(internal.checkBatch.performCheckBatch, {
    callerId: userId,
    orgId,
    workspaceId,
    items: [
      { userId, capability: "document:read", resourceType: "document", resourceId: "doc_xyz" },
    ],
  });

  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({ allowed: false, reason: "no_binding_found" });
});

// ── Ciclo 4: binding válido → allowed:true ────────────────────────────────────

test("checkBatch: item com binding válido retorna allowed:true naquele índice", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId, roleId } = await setupBatchContext(t);

  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId,
      resourceType: "document",
      resourceId: "doc_abc",
      workspaceId,
    }),
  );

  const result = await t.action(internal.checkBatch.performCheckBatch, {
    callerId: userId,
    orgId,
    workspaceId,
    items: [
      { userId, capability: "document:read", resourceType: "document", resourceId: "doc_abc" },
    ],
  });

  expect(result).toHaveLength(1);
  expect(result[0].allowed).toBe(true);
});

// ── Ciclo 5: isolamento e ordem garantida ─────────────────────────────────────

test("checkBatch: falha em um item não interrompe os demais e ordem é preservada", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId, roleId } = await setupBatchContext(t);

  // item index 1 tem binding válido; item index 0 e 2 não têm
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId,
      resourceType: "document",
      resourceId: "doc_middle",
      workspaceId,
    }),
  );

  const result = await t.action(internal.checkBatch.performCheckBatch, {
    callerId: userId,
    orgId,
    workspaceId,
    items: [
      { userId, capability: "document:read", resourceType: "document", resourceId: "doc_no_binding" },
      { userId, capability: "document:read", resourceType: "document", resourceId: "doc_middle" },
      { userId, capability: "document:read", resourceType: "document", resourceId: "doc_also_no_binding" },
    ],
  });

  expect(result).toHaveLength(3);
  expect(result[0].allowed).toBe(false);
  expect(result[1].allowed).toBe(true);
  expect(result[2].allowed).toBe(false);
});

// ── Ciclo 6: audit log por item ───────────────────────────────────────────────

test("checkBatch: grava um evento de audit por item no batch", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId } = await setupBatchContext(t);

  await t.action(internal.checkBatch.performCheckBatch, {
    callerId: userId,
    orgId,
    workspaceId,
    items: [
      { userId, capability: "document:read", resourceType: "document", resourceId: "doc_1" },
      { userId, capability: "document:read", resourceType: "document", resourceId: "doc_2" },
      { userId, capability: "document:read", resourceType: "document", resourceId: "doc_3" },
    ],
  });

  const auditEntries = await t.run((ctx) =>
    ctx.db.query("audit_log").order("desc").take(10),
  );
  const checkEntries = auditEntries.filter((e) => e.action === "permission.check");
  expect(checkEntries).toHaveLength(3);
});

// ── Ciclo 7: integração HTTP — API Key sem escopo check → 403 ─────────────────

test("POST /v1/check/batch: API Key sem escopo check recebe 403", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId } = await setupBatchContext(t);

  // Criar API Key com escopo users:read (sem check) com hash bcrypt real
  // O publicId armazenado no DB é o sufixo após "gk_live_pk_"
  // O token no header é: Bearer gk_live_pk_{publicId}_{secret}
  const secret = "testsecret123456789012345678901";
  const secretHash = await bcrypt.hash(secret, 1);
  const publicIdSuffix = "testbatch00001";
  await t.run((ctx) =>
    ctx.db.insert("api_keys", {
      orgId,
      publicId: publicIdSuffix,
      secretHash,
      scopes: ["users:read"],
      description: "key without check scope",
      status: "active",
    }),
  );

  const res = await t.fetch("/v1/check/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer gk_live_pk_${publicIdSuffix}_${secret}`,
    },
    body: JSON.stringify({
      workspaceId: String(workspaceId),
      items: [
        { userId: String(userId), capability: "document:read", resourceType: "document" },
      ],
    }),
  });

  expect(res.status).toBe(403);
});

// ── Ciclo 7: validação Zod — body inválido → 422 ──────────────────────────────

test("POST /v1/check/batch: array vazio retorna 422", async () => {
  const t = convexTest(schema, modules);
  const { workspaceId } = await setupBatchContext(t);
  await t.action(internal.jwt.initializeKeyPair, {});

  const token = await t.action(internal.jwt.signJwt, {
    sub: "fakeid",
    orgId: "fakeorgid",
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "",
    expiresInSeconds: 3600,
  });

  const res = await t.fetch("/v1/check/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ workspaceId: String(workspaceId), items: [] }),
  });

  expect(res.status).toBe(422);
});

// ── Ciclo 8: integração — batch misto (ALLOW + DENY no binding + DENY suspenso) ─

test("checkBatch integração: batch com 3 itens mistos retorna resultados individuais corretos", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId, roleId } = await setupBatchContext(t);

  // usuário 2: sem binding
  const userId2 = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "user2@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) => ctx.db.insert("workspace_members", { userId: userId2, workspaceId, status: "active" }));

  // usuário 3: suspenso com binding
  const userId3 = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "user3@acme.io",
      passwordHash: "hash",
      status: "suspended",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) => ctx.db.insert("workspace_members", { userId: userId3, workspaceId, status: "active" }));
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId: userId3,
      roleId,
      resourceType: "document",
      resourceId: "doc_suspended",
      workspaceId,
    }),
  );

  // usuário 1 (userId): binding válido
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId,
      resourceType: "document",
      resourceId: "doc_allow",
      workspaceId,
    }),
  );

  const result = await t.action(internal.checkBatch.performCheckBatch, {
    callerId: userId,
    orgId,
    workspaceId,
    items: [
      { userId, capability: "document:read", resourceType: "document", resourceId: "doc_allow" },
      { userId: userId2, capability: "document:read", resourceType: "document", resourceId: "doc_no_binding" },
      { userId: userId3, capability: "document:read", resourceType: "document", resourceId: "doc_suspended" },
    ],
  });

  expect(result).toHaveLength(3);
  expect(result[0]).toEqual({ allowed: true, reason: "direct_binding" });
  expect(result[1]).toEqual({ allowed: false, reason: "no_binding_found" });
  expect(result[2]).toEqual({ allowed: false, reason: "user_inactive" });
});

test("POST /v1/check/batch: mais de 100 itens retorna 422", async () => {
  const t = convexTest(schema, modules);
  const { workspaceId, userId } = await setupBatchContext(t);
  await t.action(internal.jwt.initializeKeyPair, {});

  const token = await t.action(internal.jwt.signJwt, {
    sub: "fakeid",
    orgId: "fakeorgid",
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "",
    expiresInSeconds: 3600,
  });

  const items = Array.from({ length: 101 }, () => ({
    userId: String(userId),
    capability: "document:read",
    resourceType: "document",
  }));

  const res = await t.fetch("/v1/check/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ workspaceId: String(workspaceId), items }),
  });

  expect(res.status).toBe(422);
});

// ── Ciclo 9: herança de container → parent_binding ────────────────────────────

test("checkBatch integração: item com binding direto retorna allowed:true (base para herança)", async () => {
  const t = convexTest(schema, modules);
  const { orgId, workspaceId, userId, roleId } = await setupBatchContext(t);

  // Registrar resource_type "document" que herda de "folder"
  await t.run((ctx) =>
    ctx.db.insert("resource_types", {
      orgId,
      name: "document",
      inheritsFrom: "folder",
      inheritanceMode: "auto",
    }),
  );

  // Binding no folder pai
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId,
      resourceType: "folder",
      resourceId: "folder_1",
      workspaceId,
    }),
  );

  // Binding direto no documento com parentResourceId para acionar herança
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId,
      roleId,
      resourceType: "document",
      resourceId: "doc_child",
      parentResourceId: "folder_1",
      workspaceId,
    }),
  );

  const result = await t.action(internal.checkBatch.performCheckBatch, {
    callerId: userId,
    orgId,
    workspaceId,
    items: [
      { userId, capability: "document:read", resourceType: "document", resourceId: "doc_child" },
    ],
  });

  expect(result).toHaveLength(1);
  expect(result[0].allowed).toBe(true);
});
