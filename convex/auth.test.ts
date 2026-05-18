/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import bcrypt from "bcryptjs";

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
  const passwordHash = await bcrypt.hash(password, 10);
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

test("createUserWithPassword: senha é hasheada com bcryptjs antes de armazenar", async () => {
  const t = convexTest(schema, modules);

  const userId = await t.action(internal.auth.createUserWithPassword, {
    email: "new@test.com",
    password: "plaintext-password",
  });

  const user = await t.run(async (ctx) => ctx.db.get(userId as never));
  expect(user).not.toBeNull();
  if (user) {
    expect(user.passwordHash).not.toBe("plaintext-password");
    const valid = await bcrypt.compare("plaintext-password", user.passwordHash);
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

// ── Ciclo 10: rate limiting por IP ───────────────────────────────────────────

test("loginWithPassword: muitas requisições do mesmo IP retornam rate_limit_exceeded", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  // Simular janela de rate limit já cheia para o IP
  await t.run(async (ctx) => {
    await ctx.db.insert("ip_rate_limits", {
      ip: "1.2.3.4",
      endpoint: "/v1/auth/login",
      count: 10,
      windowStart: Date.now() - 30 * 1000, // 30s atrás (dentro da janela de 1min)
    });
  });

  await createUser(t, "ratelimit@test.com", "correct");

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "ratelimit@test.com",
    password: "correct",
    ip: "1.2.3.4",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("rate_limit_exceeded");
  }
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

// ── Ciclo sessions_per_user quota ─────────────────────────────────────────────

test("loginWithPassword: sessions_per_user atingido retorna quota_exceeded", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);
  const userId = await createUser(t, "quota@test.com", "correct");
  await addOrgMember(t, userId as string, orgId as string);
  // Configurar quota = 1
  await t.run(async (ctx) => {
    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();
    if (settings) {
      await ctx.db.patch(settings._id, { quotas: { sessions_per_user: 1 } });
    } else {
      await ctx.db.insert("org_settings", {
        orgId: orgId as never,
        loginMethods: ["email_password"],
        mfaRequired: false,
        jwtExpiryAccess: 3600,
        jwtExpiryRefresh: 2592000,
        quotas: { sessions_per_user: 1 },
      });
    }
  });
  // Criar 1 sessão ativa para atingir cota
  await t.run(async (ctx) => {
    await ctx.db.insert("sessions", {
      userId: userId as never,
      refreshTokenHash: "hash",
      expiresAt: Date.now() + 99999999,
    });
  });

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "quota@test.com",
    password: "correct",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("quota_exceeded");
  }
});

// ── Ciclo 4.4: loginMethods ↔ email_password ─────────────────────────────────

test("loginWithPassword: retorna method_disabled quando email_password não está em loginMethods", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);
  const userId = await createUser(t, "blocked@test.com", "correct");
  await addOrgMember(t, userId as string, orgId as string);

  await t.run(async (ctx) => {
    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();
    if (settings) {
      await ctx.db.patch(settings._id, { loginMethods: ["magic_link"] });
    } else {
      await ctx.db.insert("org_settings", {
        orgId: orgId as never,
        loginMethods: ["magic_link"],
        mfaRequired: false,
        jwtExpiryAccess: 3600,
        jwtExpiryRefresh: 2592000,
        quotas: {},
      });
    }
  });

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "blocked@test.com",
    password: "correct",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("method_disabled");
  }
});

// ── Ciclo: mustChangePassword no login ───────────────────────────────────────

// ── Ciclo Magic Link: requestMagicLink ───────────────────────────────────────

test("requestMagicLink: retorna ok:true quando magic_link está habilitado na org", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);

  const userId = await createUser(t, "magic@test.com", "irrelevant");

  await t.run(async (ctx) => {
    await ctx.db.insert("org_settings", {
      orgId: orgId as never,
      loginMethods: ["magic_link"],
      mfaRequired: false,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 7 * 24 * 3600,
      quotas: {},
    });
    await ctx.db.insert("org_members", {
      userId: userId as never,
      orgId: orgId as never,
      role: "member",
      status: "active",
    });
  });

  const result = await t.action(internal.auth.requestMagicLink, {
    email: "magic@test.com",
    orgId: orgId as string,
  });

  expect(result).toMatchObject({ ok: true });
});

test("requestMagicLink: retorna ok:true mesmo quando email não existe (não revela existência)", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);

  await t.run(async (ctx) => {
    await ctx.db.insert("org_settings", {
      orgId: orgId as never,
      loginMethods: ["magic_link"],
      mfaRequired: false,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 7 * 24 * 3600,
      quotas: {},
    });
  });

  const result = await t.action(internal.auth.requestMagicLink, {
    email: "naoexiste@test.com",
    orgId: orgId as string,
  });

  expect(result).toMatchObject({ ok: true });
});

test("requestMagicLink: lança erro method_disabled quando magic_link não está nos loginMethods", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);
  await createUser(t, "blocked@test.com", "irrelevant");

  await t.run(async (ctx) => {
    await ctx.db.insert("org_settings", {
      orgId: orgId as never,
      loginMethods: ["email_password"],
      mfaRequired: false,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 7 * 24 * 3600,
      quotas: {},
    });
  });

  await expect(
    t.action(internal.auth.requestMagicLink, {
      email: "blocked@test.com",
      orgId: orgId as string,
    }),
  ).rejects.toThrow("method_disabled");
});

// ── Ciclo Magic Link: verifyMagicLink ────────────────────────────────────────

test("verifyMagicLink: token válido retorna accessToken e refreshToken", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);
  const userId = await createUser(t, "verify@test.com", "irrelevant");

  await t.run(async (ctx) => {
    await ctx.db.insert("org_settings", {
      orgId: orgId as never,
      loginMethods: ["magic_link"],
      mfaRequired: false,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 7 * 24 * 3600,
      quotas: {},
    });
    await ctx.db.insert("org_members", {
      userId: userId as never,
      orgId: orgId as never,
      role: "member",
      status: "active",
    });
  });

  const crypto = await import("crypto");
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  await t.run(async (ctx) => {
    await ctx.db.insert("magic_link_tokens", {
      tokenHash,
      userId: userId as never,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
  });

  const result = await t.action(internal.auth.verifyMagicLink, { token: rawToken });

  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.accessToken.split(".").length).toBe(3);
    expect(result.refreshToken).toBeTypeOf("string");
  }
});

test("verifyMagicLink: token expirado retorna success:false com error:invalid_or_expired", async () => {
  const t = convexTest(schema, modules);
  await setupOrg(t);
  const userId = await createUser(t, "expired@test.com", "irrelevant");

  const crypto = await import("crypto");
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  await t.run(async (ctx) => {
    await ctx.db.insert("magic_link_tokens", {
      tokenHash,
      userId: userId as never,
      expiresAt: Date.now() - 1000,
    });
  });

  const result = await t.action(internal.auth.verifyMagicLink, { token: rawToken });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("invalid_or_expired");
  }
});

test("verifyMagicLink: token já usado retorna success:false com error:invalid_or_expired", async () => {
  const t = convexTest(schema, modules);
  await setupOrg(t);
  const userId = await createUser(t, "used@test.com", "irrelevant");

  const crypto = await import("crypto");
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  await t.run(async (ctx) => {
    await ctx.db.insert("magic_link_tokens", {
      tokenHash,
      userId: userId as never,
      expiresAt: Date.now() + 15 * 60 * 1000,
      usedAt: Date.now() - 5000,
    });
  });

  const result = await t.action(internal.auth.verifyMagicLink, { token: rawToken });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("invalid_or_expired");
  }
});

// ── Ciclo Magic Link: audit event expired + templates ────────────────────────

test("verifyMagicLink: token expirado registra auth.magiclink.expired no audit_log", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);
  const userId = await createUser(t, "expiredaudit@test.com", "irrelevant");

  await t.run(async (ctx) => {
    await ctx.db.insert("org_members", {
      userId: userId as never,
      orgId: orgId as never,
      role: "member",
      status: "active",
    });
  });

  const crypto = await import("crypto");
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  await t.run(async (ctx) => {
    await ctx.db.insert("magic_link_tokens", {
      tokenHash,
      userId: userId as never,
      expiresAt: Date.now() - 1000,
    });
  });

  await t.action(internal.auth.verifyMagicLink, { token: rawToken });

  const events = await t.run(async (ctx) =>
    ctx.db
      .query("audit_log")
      .filter((q) => q.eq(q.field("action"), "auth.magiclink.expired"))
      .collect(),
  );
  expect(events.length).toBe(1);
});

// ── Ciclo 4.4: verifyMagicLink rejeita se magic_link foi desabilitado após envio ──

test("verifyMagicLink: retorna method_disabled quando magic_link é desabilitado após envio do token", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);
  const userId = await createUser(t, "disable-after@test.com", "irrelevant");

  await t.run(async (ctx) => {
    await ctx.db.insert("org_settings", {
      orgId: orgId as never,
      loginMethods: ["magic_link", "email_password"],
      mfaRequired: false,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 2592000,
      quotas: {},
    });
    await ctx.db.insert("org_members", {
      userId: userId as never,
      orgId: orgId as never,
      role: "member",
      status: "active",
    });
  });

  const crypto = await import("crypto");
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  await t.run(async (ctx) => {
    await ctx.db.insert("magic_link_tokens", {
      tokenHash,
      userId: userId as never,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
  });

  // Org admin desabilita magic_link após o envio
  await t.run(async (ctx) => {
    const settings = await ctx.db
      .query("org_settings")
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();
    if (settings) {
      await ctx.db.patch(settings._id, { loginMethods: ["email_password"] });
    }
  });

  const result = await t.action(internal.auth.verifyMagicLink, { token: rawToken });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("method_disabled");
  }
});

test("magicLinkHtml: template PT-BR contém link correto", async () => {
  const { magicLinkHtml } = await import("./emailTemplates");
  const html = magicLinkHtml("https://app.gatekey.dev/verify?token=abc", "pt-BR");
  expect(html).toContain("https://app.gatekey.dev/verify?token=abc");
  expect(html).toContain("Entrar");
});

test("magicLinkHtml: template EN contém link correto", async () => {
  const { magicLinkHtml } = await import("./emailTemplates");
  const html = magicLinkHtml("https://app.gatekey.dev/verify?token=abc", "en");
  expect(html).toContain("https://app.gatekey.dev/verify?token=abc");
  expect(html).toContain("Sign in");
});

test("loginWithPassword: usuário com mustChangePassword=true retorna flag no resultado", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.hash("temp-pass", 10);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "newadmin@acme.io",
      passwordHash: hash,
      mustChangePassword: true,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await addOrgMember(t, userId as string, orgId as string);

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "newadmin@acme.io",
    password: "temp-pass",
  });

  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.mustChangePassword).toBe(true);
  }
});

// ── Ciclo 6: mfaRequired bloqueia login sem MFA ativo ────────────────────────

test("loginWithPassword: org com mfaRequired=true e usuário sem MFA retorna mfa_setup_required", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("password123", 10);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "mfa-user@test.com",
      passwordHash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await addOrgMember(t, userId as string, orgId as string);

  await t.run(async (ctx) =>
    ctx.db.insert("org_settings", {
      orgId: orgId as never,
      loginMethods: ["email_password"],
      mfaRequired: true,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 2592000,
      quotas: {},
    }),
  );

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "mfa-user@test.com",
    password: "password123",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("mfa_setup_required");
  }
});

// ── Ciclo MFA 4.6: mfa_setup_required retorna mfaSetupToken ──────────────────

test("loginWithPassword: mfa_setup_required retorna mfaSetupToken para permitir configuração", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const orgId = await t.run(async (ctx) =>
    ctx.db.insert("orgs", { name: "SetupOrg", status: "active", updatedAt: Date.now() }),
  );
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("setup-password", 10);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "needsmfa@test.com",
      passwordHash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );
  await addOrgMember(t, userId as string, orgId as string);

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "needsmfa@test.com",
    password: "setup-password",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("mfa_setup_required");
    expect((result as { mfaSetupToken?: string }).mfaSetupToken).toBeTypeOf("string");
    expect((result as { mfaSetupToken?: string }).mfaSetupToken?.length).toBeGreaterThan(0);
  }
  expect((result as { accessToken?: string }).accessToken).toBeUndefined();
});

// ── Ciclo MFA 4.6: login com MFA ativo ────────────────────────────────────────

test("loginWithPassword: MFA ativo retorna mfa_required com mfaToken, sem accessToken", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const orgId = await t.run(async (ctx) =>
    ctx.db.insert("orgs", { name: "MfaOrg", status: "active", updatedAt: Date.now() }),
  );
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("mfa-password", 10);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "mfaactive@test.com",
      passwordHash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await addOrgMember(t, userId as string, orgId as string);

  await t.mutation(internal.mfaStore.activateMfaConfig, {
    userId: userId as never,
    secret: "JBSWY3DPEHPK3PXP",
    backupCodes: ["backup1", "backup2"],
  });

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "mfaactive@test.com",
    password: "mfa-password",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("mfa_required");
    expect((result as { mfaToken?: string }).mfaToken).toBeTypeOf("string");
    expect((result as { mfaToken?: string }).mfaToken?.length).toBeGreaterThan(0);
  }
  expect((result as { accessToken?: string }).accessToken).toBeUndefined();
});

// ── Ciclo 7: Root account lock sem MFA ───────────────────────────────────────

test("loginWithPassword: usuário isRoot sem MFA configurado retorna mfa_setup_required", async () => {
  const t = convexTest(schema, modules);
  const orgId = await setupOrg(t);

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("root-password", 10);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "root@test.com",
      passwordHash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );
  await addOrgMember(t, userId as string, orgId as string);

  const result = await t.action(internal.auth.loginWithPassword, {
    email: "root@test.com",
    password: "root-password",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("mfa_setup_required");
  }
});

// ── Ciclo MFA 4.6: verifyMagicLink com MFA ativo ─────────────────────────────

test("verifyMagicLink: MFA ativo retorna mfa_required com mfaToken, sem accessToken", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const orgId = await t.run(async (ctx) =>
    ctx.db.insert("orgs", { name: "MfaMagicOrg", status: "active", updatedAt: Date.now() }),
  );
  const userId = await createUser(t, "mfamagic@test.com", "irrelevant");
  await addOrgMember(t, userId as string, orgId as string);

  // Ativar MFA para o usuário
  await t.mutation(internal.mfaStore.activateMfaConfig, {
    userId: userId as never,
    secret: "JBSWY3DPEHPK3PXP",
    backupCodes: ["backup1"],
  });

  const crypto = await import("crypto");
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  await t.run(async (ctx) => {
    await ctx.db.insert("magic_link_tokens", {
      tokenHash,
      userId: userId as never,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
  });

  const result = await t.action(internal.auth.verifyMagicLink, { token: rawToken });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("mfa_required");
    expect((result as { mfaToken?: string }).mfaToken).toBeTypeOf("string");
    expect((result as { mfaToken?: string }).mfaToken?.length).toBeGreaterThan(0);
  }
  expect((result as { accessToken?: string }).accessToken).toBeUndefined();
});
