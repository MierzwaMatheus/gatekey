// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const basePayload = {
  sub: "user_abc",
  orgId: "org_abc",
  workspaceIds: ["ws1"],
  roles: { ws1: "editor" } as Record<string, string>,
  capabilities: ["document:read"],
  sessionId: "sess_abc",
  expiresInSeconds: 3600,
};

// Ciclo 1 — rotateKeyPair + getJwks retorna 2 chaves

test("após rotateKeyPair(), getJwks() retorna dois objetos keys[]", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  await t.action(internal.jwt.rotateKeyPair, {});
  const { keys } = await t.action(internal.jwt.getJwks, {});
  expect(keys).toHaveLength(2);
});

// Ciclo 2 — verifyJwt aceita token assinado com chave anterior (durante overlap)

test("verifyJwt aceita token assinado com chave anterior durante período de overlap", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const oldToken = await t.action(internal.jwt.signJwt, basePayload);
  // rotaciona — nova chave ativa, anterior entra em overlap
  await t.action(internal.jwt.rotateKeyPair, {});
  const result = await t.action(internal.jwt.verifyJwt, { token: oldToken });
  expect(result.valid).toBe(true);
});

// Ciclo 3 — verifyJwt rejeita token de chave anterior à última rotação

test("verifyJwt rejeita token assinado com chave mais antiga (anterior à última rotação)", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const oldToken = await t.action(internal.jwt.signJwt, basePayload);
  await t.action(internal.jwt.rotateKeyPair, {}); // rotação 1 — oldToken vira "previous"
  await t.action(internal.jwt.rotateKeyPair, {}); // rotação 2 — oldToken cai fora do overlap
  const result = await t.action(internal.jwt.verifyJwt, { token: oldToken });
  expect(result.valid).toBe(false);
});

// Ciclo 4 — verifyJwt aceita token assinado com nova chave após rotação

test("verifyJwt aceita token assinado com a chave nova após rotação", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  await t.action(internal.jwt.rotateKeyPair, {});
  const newToken = await t.action(internal.jwt.signJwt, basePayload);
  const result = await t.action(internal.jwt.verifyJwt, { token: newToken });
  expect(result.valid).toBe(true);
});
