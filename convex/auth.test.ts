/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import argon2 from "argon2";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setupOrg(t: ReturnType<typeof convexTest>) {
  await t.action(internal.jwt.initializeKeyPair, {});
  return t.run(async (ctx) =>
    ctx.db.insert("orgs", { name: "TestOrg", status: "active", updatedAt: Date.now() }),
  );
}

async function createUser(
  t: ReturnType<typeof convexTest>,
  email: string,
  password: string,
  extra?: { loginAttempts?: number; lockedUntil?: number },
) {
  const passwordHash = await argon2.hash(password);
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      email,
      passwordHash,
      status: "active",
      loginAttempts: extra?.loginAttempts ?? 0,
      lockedUntil: extra?.lockedUntil,
      updatedAt: Date.now(),
    }),
  );
}

async function addOrgMember(
  t: ReturnType<typeof convexTest>,
  userId: string,
  orgId: string,
) {
  return t.run(async (ctx) =>
    ctx.db.insert("org_members", {
      userId: userId as never,
      orgId: orgId as never,
      role: "member",
      status: "active",
    }),
  );
}

// ── Ciclo 1: login happy path ─────────────────────────────────────────────────

test("loginWithPassword: credenciais corretas retornam accessToken e refreshToken", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);
  const userId = await createUser(t, "user@test.com", "correct-password");
  await addOrgMember(t, userId as string, orgId as string);

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "user@test.com",
    password: "correct-password",
  });

  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.accessToken.split(".").length).toBe(3);
    expect(result.refreshToken).toBeTypeOf("string");
    expect(result.refreshToken.length).toBeGreaterThan(0);
    expect(result.sessionId).toBeTypeOf("string");
  }
});

// ── Ciclo 2: hash de senha na criação de usuário ──────────────────────────────

test("createUserWithPassword: senha é hasheada com argon2id antes de armazenar", async () => {
  const t = convexTest(schema, modules);

  const userId = await t.action(internal.auth.createUserWithPassword, {
    email: "new@test.com",
    password: "plaintext-password",
  });

  const user = await t.run(async (ctx) => ctx.db.get(userId as never));
  expect(user).not.toBeNull();
  if (user) {
    expect(user.passwordHash).not.toBe("plaintext-password");
    const valid = await argon2.verify(user.passwordHash, "plaintext-password");
    expect(valid).toBe(true);
  }
});

// ── Ciclo 3: senha incorreta retorna erro e incrementa contador ───────────────

test("loginWithPassword: senha incorreta retorna erro e incrementa loginAttempts", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const userId = await createUser(t, "user2@test.com", "correct");

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "user2@test.com",
    password: "wrong-password",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("invalid_credentials");
  }

  const user = await t.run(async (ctx) => ctx.db.get(userId));
  expect(user?.loginAttempts).toBe(1);
});

// ── Ciclo 4: bloqueio temporário na 5ª falha ──────────────────────────────────

test("loginWithPassword: 5ª falha consecutiva bloqueia a conta com lockedUntil", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  await createUser(t, "user3@test.com", "correct", { loginAttempts: 4 });

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "user3@test.com",
    password: "wrong-password",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("account_locked");
    expect(result.lockedUntil).toBeTypeOf("number");
    const fifteenMin = 15 * 60 * 1000;
    expect(result.lockedUntil!).toBeGreaterThan(Date.now() + fifteenMin - 5000);
  }
});

// ── Ciclo 5: lockedUntil impede login mesmo com senha correta ─────────────────

test("loginWithPassword: conta bloqueada retorna account_locked mesmo com senha correta", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const futureTimestamp = Date.now() + 10 * 60 * 1000;
  await createUser(t, "user4@test.com", "correct", { lockedUntil: futureTimestamp });

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "user4@test.com",
    password: "correct",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("account_locked");
    expect(result.lockedUntil).toBeGreaterThan(Date.now());
  }
});

// ── Ciclo 6: reset de loginAttempts após login bem-sucedido ───────────────────

test("loginWithPassword: loginAttempts é zerado após login bem-sucedido", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);
  const userId = await createUser(t, "user5@test.com", "correct", { loginAttempts: 3 });
  await addOrgMember(t, userId as string, orgId as string);

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "user5@test.com",
    password: "correct",
  });

  expect(result.success).toBe(true);
  const user = await t.run(async (ctx) => ctx.db.get(userId));
  expect(user?.loginAttempts).toBe(0);
  expect(user?.lockedUntil).toBeUndefined();
});

// ── Ciclo 7: POST /v1/auth/refresh com rotação ────────────────────────────────

test("refreshTokens: refresh token rotacionado — token anterior retorna erro", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);
  const userId = await createUser(t, "user6@test.com", "correct");
  await addOrgMember(t, userId as string, orgId as string);

  const loginResult = await t.action(internal.auth.loginWithPassword, {
    email: "user6@test.com",
    password: "correct",
  });
  expect(loginResult.success).toBe(true);
  if (!loginResult.success) return;

  const refreshResult = await t.action(internal.auth.refreshTokens, {
    sessionId: loginResult.sessionId as never,
    refreshToken: loginResult.refreshToken,
    orgId: orgId as unknown as string,
  });
  expect(refreshResult.success).toBe(true);

  // Tentar usar o refresh token original novamente deve falhar
  const secondRefresh = await t.action(internal.auth.refreshTokens, {
    sessionId: loginResult.sessionId as never,
    refreshToken: loginResult.refreshToken,
    orgId: orgId as unknown as string,
  });
  expect(secondRefresh.success).toBe(false);
});

// ── Ciclo 8: POST /v1/auth/logout insere na blacklist ────────────────────────

test("logoutSession: sessionId é inserido na session_blacklist após logout", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);
  const userId = await createUser(t, "user7@test.com", "correct");
  await addOrgMember(t, userId as string, orgId as string);

  const loginResult = await t.action(internal.auth.loginWithPassword, {
    email: "user7@test.com",
    password: "correct",
  });
  expect(loginResult.success).toBe(true);
  if (!loginResult.success) return;

  await t.action(internal.auth.logoutSession, {
    sessionId: loginResult.sessionId as never,
    accessTokenExp: Math.floor(Date.now() / 1000) + 3600,
  });

  const blacklisted = await t.run(async (ctx) => {
    const entry = await ctx.db
      .query("session_blacklist")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", loginResult.sessionId as never))
      .first();
    return entry !== null;
  });
  expect(blacklisted).toBe(true);
});

// ── Ciclo 9: writeAuditEvent registra eventos de auth ────────────────────────

test("loginWithPassword: registra auth.login.success no audit_log", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);
  const userId = await createUser(t, "user8@test.com", "correct");
  await addOrgMember(t, userId as string, orgId as string);

  await t.action(internal.auth.loginWithPassword, {
    email: "user8@test.com",
    password: "correct",
  });

  const events = await t.run(async (ctx) =>
    ctx.db
      .query("audit_log")
      .withIndex("by_orgId_and_timestamp", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  const loginEvent = events.find((e) => e.action === "auth.login.success");
  expect(loginEvent).toBeDefined();
});

test("loginWithPassword: registra auth.login.failure no audit_log", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  await createUser(t, "user9@test.com", "correct");

  await t.action(internal.auth.loginWithPassword, {
    email: "user9@test.com",
    password: "wrong",
  });

  const events = await t.run(async (ctx) => ctx.db.query("audit_log").collect());
  const failEvent = events.find((e) => e.action === "auth.login.failure");
  expect(failEvent).toBeDefined();
});

test("loginWithPassword: registra auth.login.blocked quando conta está bloqueada", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  await createUser(t, "user10@test.com", "correct", { lockedUntil: Date.now() + 10 * 60 * 1000 });

  await t.action(internal.auth.loginWithPassword, {
    email: "user10@test.com",
    password: "correct",
  });

  const events = await t.run(async (ctx) => ctx.db.query("audit_log").collect());
  const blockedEvent = events.find((e) => e.action === "auth.login.blocked");
  expect(blockedEvent).toBeDefined();
});

test("logoutSession: registra auth.logout no audit_log", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);
  const userId = await createUser(t, "user11@test.com", "correct");
  await addOrgMember(t, userId as string, orgId as string);

  const loginResult = await t.action(internal.auth.loginWithPassword, {
    email: "user11@test.com",
    password: "correct",
  });
  if (!loginResult.success) return;

  await t.action(internal.auth.logoutSession, {
    sessionId: loginResult.sessionId as never,
    accessTokenExp: Math.floor(Date.now() / 1000) + 3600,
    userId: userId as string,
  });

  const events = await t.run(async (ctx) => ctx.db.query("audit_log").collect());
  const logoutEvent = events.find((e) => e.action === "auth.logout");
  expect(logoutEvent).toBeDefined();
});
