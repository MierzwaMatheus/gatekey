/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── Ciclo 1: sign + verify round-trip ────────────────────────────────────────

test("initializeKeyPair: armazena par de chaves e retorna kid", async () => {
  const t = convexTest(schema, modules);
  const result = await t.action(internal.jwt.initializeKeyPair, {});
  expect(result.kid).toBeTypeOf("string");
  expect(result.kid.length).toBeGreaterThan(0);
  expect(result.keyPairId).toBeTypeOf("string");
});

test("signJwt + verifyJwt: token assinado é verificável com a chave pública", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "test@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const orgId = await t.run(async (ctx) =>
    ctx.db.insert("orgs", { name: "TestOrg", status: "active", updatedAt: Date.now() }),
  );

  const token = await t.action(internal.jwt.signJwt, {
    sub: userId as unknown as string,
    orgId: orgId as unknown as string,
    workspaceIds: ["ws1"],
    roles: { ws1: "editor" },
    capabilities: ["document:read"],
    sessionId: "sess_abc",
    expiresInSeconds: 3600,
  });

  expect(token).toBeTypeOf("string");
  expect(token.split(".").length).toBe(3);

  const result = await t.action(internal.jwt.verifyJwt, { token });
  expect(result.valid).toBe(true);
  if (result.valid) {
    expect(result.payload.sub).toBe(userId as unknown as string);
    expect(result.payload.orgId).toBe(orgId as unknown as string);
    expect(result.payload.sessionId).toBe("sess_abc");
    expect(result.payload.workspaceIds).toEqual(["ws1"]);
    expect(result.payload.roles).toEqual({ ws1: "editor" });
    expect(result.payload.capabilities).toEqual(["document:read"]);
  }
});

// ── Ciclo 2: JWT expirado é rejeitado ────────────────────────────────────────

test("verifyJwt: rejeita token com exp no passado", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "exp@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const orgId = await t.run(async (ctx) =>
    ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() }),
  );

  // Assinar com expiração negativa — already expired
  const token = await t.action(internal.jwt.signJwt, {
    sub: userId as unknown as string,
    orgId: orgId as unknown as string,
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "",
    expiresInSeconds: -10,
  });

  const result = await t.action(internal.jwt.verifyJwt, { token });
  expect(result.valid).toBe(false);
  if (!result.valid) {
    expect(result.error).toMatch(/exp/i);
  }
});

// ── Ciclo 3: JWKS endpoint ────────────────────────────────────────────────────

test("getJwks: retorna JWKS com chave pública RSA e kid correto", async () => {
  const t = convexTest(schema, modules);
  const { kid } = await t.action(internal.jwt.initializeKeyPair, {});

  const jwks = await t.action(internal.jwt.getJwks, {});
  expect(jwks.keys).toHaveLength(1);
  const key = jwks.keys[0] as Record<string, unknown>;
  expect(key.kty).toBe("RSA");
  expect(key.kid).toBe(kid);
  expect(key.n).toBeTypeOf("string");
  expect(key.e).toBeTypeOf("string");
});

test("JWT emitido é verificável usando a chave pública retornada pelo JWKS", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "jwks@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const orgId = await t.run(async (ctx) =>
    ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() }),
  );

  const token = await t.action(internal.jwt.signJwt, {
    sub: userId as unknown as string,
    orgId: orgId as unknown as string,
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "sess1",
    expiresInSeconds: 3600,
  });

  const jwks = await t.action(internal.jwt.getJwks, {});

  const { createLocalJWKSet, jwtVerify } = await import("jose");
  const keySet = createLocalJWKSet(jwks as { keys: object[] });
  const { payload } = await jwtVerify(token, keySet, { algorithms: ["RS256"] });
  expect(payload.sub).toBe(userId as unknown as string);
});

// ── Ciclo 4: Refresh tokens ───────────────────────────────────────────────────

test("createSessionWithRefreshToken: retorna token bruto e persiste hash no banco", async () => {
  const t = convexTest(schema, modules);

  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "refresh@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const orgId = await t.run(async (ctx) =>
    ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() }),
  );

  const { sessionId, refreshToken } = await t.action(
    internal.jwt.createSessionWithRefreshToken,
    { userId, orgId },
  );

  expect(refreshToken).toBeTypeOf("string");
  expect(refreshToken.length).toBeGreaterThan(0);
  expect(sessionId).toBeTypeOf("string");

  const session = await t.run(async (ctx) => ctx.db.get(sessionId));
  expect(session).not.toBeNull();
  expect(session!.refreshTokenHash).not.toBe(refreshToken);
});

test("rotateRefreshToken: token antigo é rejeitado após rotação", async () => {
  const t = convexTest(schema, modules);

  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "rotate@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const orgId = await t.run(async (ctx) =>
    ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() }),
  );

  const { sessionId, refreshToken } = await t.action(
    internal.jwt.createSessionWithRefreshToken,
    { userId, orgId },
  );

  const rotated = await t.action(internal.jwt.rotateRefreshToken, {
    sessionId,
    refreshToken,
    orgId,
  });
  expect(rotated.valid).toBe(true);

  // Tentar usar o token antigo novamente
  const reuse = await t.action(internal.jwt.rotateRefreshToken, {
    sessionId,
    refreshToken,
    orgId,
  });
  expect(reuse.valid).toBe(false);
});

test("rotateRefreshToken: sessão expirada retorna erro", async () => {
  const t = convexTest(schema, modules);

  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "expired@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const orgId = await t.run(async (ctx) =>
    ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() }),
  );

  // Criar sessão já expirada diretamente
  const argon2 = await import("argon2");
  const rawToken = "expiredtoken123";
  const hash = await argon2.hash(rawToken);
  const sessionId = await t.run(async (ctx) =>
    ctx.db.insert("sessions", {
      userId,
      refreshTokenHash: hash,
      expiresAt: Date.now() - 1000,
    }),
  );

  const result = await t.action(internal.jwt.rotateRefreshToken, {
    sessionId,
    refreshToken: rawToken,
    orgId,
  });
  expect(result.valid).toBe(false);
  if (!result.valid) {
    expect(result.error).toBe("session_expired");
  }
});

// ── Ciclo 5: PEP integração RS256 ────────────────────────────────────────────

test("resolveAuth: JWT válido com assinatura RS256 é aceito", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "pep@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  const orgId = await t.run(async (ctx) =>
    ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() }),
  );

  const token = await t.action(internal.jwt.signJwt, {
    sub: userId as unknown as string,
    orgId: orgId as unknown as string,
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "sess",
    expiresInSeconds: 3600,
  });

  const result = await t.action(internal.pep.resolveAuth, {
    authHeader: `Bearer ${token}`,
  });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.type).toBe("jwt");
  }
});

test("resolveAuth: JWT com assinatura inválida é rejeitado", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  // Token com payload válido mas assinatura inválida
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const payload = btoa(
    JSON.stringify({ sub: "u1", orgId: "org1", exp: Math.floor(Date.now() / 1000) + 3600 }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const fakeToken = `${header}.${payload}.invalidsignature`;

  const result = await t.action(internal.pep.resolveAuth, {
    authHeader: `Bearer ${fakeToken}`,
  });
  expect(result.success).toBe(false);
});
