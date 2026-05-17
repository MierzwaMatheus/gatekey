/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setupUser(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "mfa@test.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
}

// ── Ciclo 1: mfaStore — pending e ativação ───────────────────────────────────

test("upsertPendingMfaConfig: armazena pendingSecret e pode ser consultado", async () => {
  const t = convexTest(schema, modules);
  const userId = await setupUser(t);

  await t.mutation(internal.mfaStore.upsertPendingMfaConfig, {
    userId: userId as never,
    pendingSecret: "JBSWY3DPEHPK3PXP",
    pendingSecretExpiresAt: Date.now() + 10 * 60 * 1000,
  });

  const config = await t.run(async (ctx) =>
    ctx.db
      .query("mfa_configs")
      .withIndex("by_userId", (q) => q.eq("userId", userId as never))
      .first(),
  );

  expect(config).not.toBeNull();
  expect(config?.pendingSecret).toBe("JBSWY3DPEHPK3PXP");
  expect(config?.activatedAt).toBeUndefined();
});

test("activateMfaConfig: ativa config e armazena backup codes", async () => {
  const t = convexTest(schema, modules);
  const userId = await setupUser(t);

  await t.mutation(internal.mfaStore.upsertPendingMfaConfig, {
    userId: userId as never,
    pendingSecret: "JBSWY3DPEHPK3PXP",
    pendingSecretExpiresAt: Date.now() + 10 * 60 * 1000,
  });

  await t.mutation(internal.mfaStore.activateMfaConfig, {
    userId: userId as never,
    secret: "JBSWY3DPEHPK3PXP",
    backupCodes: ["code1", "code2", "code3"],
  });

  const config = await t.run(async (ctx) =>
    ctx.db
      .query("mfa_configs")
      .withIndex("by_userId", (q) => q.eq("userId", userId as never))
      .first(),
  );

  expect(config?.activatedAt).toBeTypeOf("number");
  expect(config?.secret).toBe("JBSWY3DPEHPK3PXP");
  expect(config?.backupCodes).toEqual(["code1", "code2", "code3"]);
  expect(config?.pendingSecret).toBeUndefined();
});

test("getActiveMfaConfig: retorna null para usuário sem MFA ativo", async () => {
  const t = convexTest(schema, modules);
  const userId = await setupUser(t);

  const config = await t.query(internal.mfaStore.getActiveMfaConfig, {
    userId: userId as never,
  });

  expect(config).toBeNull();
});

test("getActiveMfaConfig: retorna config após ativação", async () => {
  const t = convexTest(schema, modules);
  const userId = await setupUser(t);

  await t.mutation(internal.mfaStore.upsertPendingMfaConfig, {
    userId: userId as never,
    pendingSecret: "SECRET123",
    pendingSecretExpiresAt: Date.now() + 600_000,
  });
  await t.mutation(internal.mfaStore.activateMfaConfig, {
    userId: userId as never,
    secret: "SECRET123",
    backupCodes: ["a", "b"],
  });

  const config = await t.query(internal.mfaStore.getActiveMfaConfig, {
    userId: userId as never,
  });

  expect(config).not.toBeNull();
  expect(config?.secret).toBe("SECRET123");
});

// ── Ciclo 2: setupMfa ────────────────────────────────────────────────────────

test("setupMfa: retorna secret base32 e qrCodeUrl, armazena pendingSecret", async () => {
  const t = convexTest(schema, modules);
  const userId = await setupUser(t);

  const result = await t.action(internal.mfa.setupMfa, {
    userId: userId as never,
    issuer: "GateKey",
  });

  expect(result.secret).toBeTypeOf("string");
  expect(result.secret.length).toBeGreaterThan(10);
  expect(result.qrCodeUrl).toContain("otpauth://totp/");
  expect(result.qrCodeUrl).toContain("GateKey");

  const config = await t.run(async (ctx) =>
    ctx.db
      .query("mfa_configs")
      .withIndex("by_userId", (q) => q.eq("userId", userId as never))
      .first(),
  );
  expect(config?.pendingSecret).toBe(result.secret);
  expect(config?.activatedAt).toBeUndefined();
});

// ── Ciclo 1 (continuação) ────────────────────────────────────────────────────

test("invalidateBackupCode: remove código da lista após uso", async () => {
  const t = convexTest(schema, modules);
  const userId = await setupUser(t);

  await t.mutation(internal.mfaStore.upsertPendingMfaConfig, {
    userId: userId as never,
    pendingSecret: "S",
    pendingSecretExpiresAt: Date.now() + 600_000,
  });
  await t.mutation(internal.mfaStore.activateMfaConfig, {
    userId: userId as never,
    secret: "S",
    backupCodes: ["aaa111", "bbb222"],
  });

  await t.mutation(internal.mfaStore.invalidateBackupCode, {
    userId: userId as never,
    code: "aaa111",
  });

  const config = await t.run(async (ctx) =>
    ctx.db
      .query("mfa_configs")
      .withIndex("by_userId", (q) => q.eq("userId", userId as never))
      .first(),
  );

  expect(config?.backupCodes).toEqual(["bbb222"]);
});

// ── Ciclo 3: verifyMfaSetup ───────────────────────────────────────────────────

test("verifyMfaSetup: código TOTP válido ativa MFA e retorna 10 backup codes", async () => {
  const t = convexTest(schema, modules);
  const userId = await setupUser(t);

  const { TOTP, Secret } = await import("otpauth");
  const pendingSecret = new Secret({ size: 20 }).base32;

  await t.mutation(internal.mfaStore.upsertPendingMfaConfig, {
    userId: userId as never,
    pendingSecret,
    pendingSecretExpiresAt: Date.now() + 600_000,
  });

  const totp = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(pendingSecret) });
  const code = totp.generate();

  const result = await t.action(internal.mfa.verifyMfaSetup, {
    userId: userId as never,
    totpCode: code,
  });

  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.backupCodes.length).toBe(10);
  }

  const config = await t.query(internal.mfaStore.getActiveMfaConfig, {
    userId: userId as never,
  });
  expect(config?.activatedAt).toBeTypeOf("number");
  expect(config?.secret).toBe(pendingSecret);
});

test("verifyMfaSetup: código TOTP inválido retorna erro", async () => {
  const t = convexTest(schema, modules);
  const userId = await setupUser(t);

  const { Secret } = await import("otpauth");
  const pendingSecret = new Secret({ size: 20 }).base32;

  await t.mutation(internal.mfaStore.upsertPendingMfaConfig, {
    userId: userId as never,
    pendingSecret,
    pendingSecretExpiresAt: Date.now() + 600_000,
  });

  const result = await t.action(internal.mfa.verifyMfaSetup, {
    userId: userId as never,
    totpCode: "000000",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("invalid_code");
  }
});

// ── Ciclo 4: challengeMfa (TOTP) ─────────────────────────────────────────────

async function setupActiveMfa(t: ReturnType<typeof convexTest>, userId: string) {
  const { TOTP, Secret } = await import("otpauth");
  const secret = new Secret({ size: 20 });
  const pendingSecret = secret.base32;

  await t.mutation(internal.mfaStore.upsertPendingMfaConfig, {
    userId: userId as never,
    pendingSecret,
    pendingSecretExpiresAt: Date.now() + 600_000,
  });
  await t.mutation(internal.mfaStore.activateMfaConfig, {
    userId: userId as never,
    secret: pendingSecret,
    backupCodes: ["backup001", "backup002"],
  });

  const totp = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret });
  return { secret: pendingSecret, totp };
}

test("challengeMfa: código TOTP válido retorna accessToken, refreshToken e sessionId", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const userId = await setupUser(t);
  const { totp } = await setupActiveMfa(t, userId as string);

  const mfaToken = await t.action(internal.mfa.signMfaToken, { userId: userId as never });
  const code = totp.generate();

  const result = await t.action(internal.mfa.challengeMfa, {
    mfaToken,
    totpCode: code,
  });

  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.accessToken.split(".").length).toBe(3);
    expect(result.refreshToken).toBeTypeOf("string");
    expect(result.sessionId).toBeTypeOf("string");
  }
});

test("challengeMfa: código TOTP inválido retorna erro", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const userId = await setupUser(t);
  await setupActiveMfa(t, userId as string);

  const mfaToken = await t.action(internal.mfa.signMfaToken, { userId: userId as never });

  const result = await t.action(internal.mfa.challengeMfa, {
    mfaToken,
    totpCode: "000000",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("invalid_code");
  }
});

// ── Ciclo 5: backup codes no challenge ───────────────────────────────────────

test("challengeMfa: backup code válido é aceito e invalidado após uso", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const userId = await setupUser(t);
  await setupActiveMfa(t, userId as string);

  const mfaToken = await t.action(internal.mfa.signMfaToken, { userId: userId as never });

  const result = await t.action(internal.mfa.challengeMfa, {
    mfaToken,
    totpCode: "backup001",
  });

  expect(result.success).toBe(true);

  const config = await t.run(async (ctx) =>
    ctx.db
      .query("mfa_configs")
      .withIndex("by_userId", (q) => q.eq("userId", userId as never))
      .first(),
  );
  expect(config?.backupCodes).not.toContain("backup001");
  expect(config?.backupCodes).toContain("backup002");
});

test("challengeMfa: backup code inválido retorna erro", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const userId = await setupUser(t);
  await setupActiveMfa(t, userId as string);

  const mfaToken = await t.action(internal.mfa.signMfaToken, { userId: userId as never });

  const result = await t.action(internal.mfa.challengeMfa, {
    mfaToken,
    totpCode: "wrongcode",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe("invalid_code");
  }
});

// ── Ciclo 8: audit events ─────────────────────────────────────────────────────

test("verifyMfaSetup: gera evento auth.mfa.setup no audit_log", async () => {
  const t = convexTest(schema, modules);
  const userId = await setupUser(t);

  const { TOTP, Secret } = await import("otpauth");
  const pendingSecret = new Secret({ size: 20 }).base32;

  await t.mutation(internal.mfaStore.upsertPendingMfaConfig, {
    userId: userId as never,
    pendingSecret,
    pendingSecretExpiresAt: Date.now() + 600_000,
  });

  const totp = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(pendingSecret) });
  await t.action(internal.mfa.verifyMfaSetup, {
    userId: userId as never,
    totpCode: totp.generate(),
  });

  const auditEvents = await t.run(async (ctx) => ctx.db.query("audit_log").collect());
  const setupEvent = auditEvents.find((e) => e.action === "auth.mfa.setup");
  expect(setupEvent).toBeDefined();
  expect(setupEvent?.result).toBe("allow");
});

test("challengeMfa: gera evento auth.mfa.success no audit_log para código correto", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const userId = await setupUser(t);
  const { totp } = await setupActiveMfa(t, userId as string);

  const mfaToken = await t.action(internal.mfa.signMfaToken, { userId: userId as never });
  await t.action(internal.mfa.challengeMfa, { mfaToken, totpCode: totp.generate() });

  const auditEvents = await t.run(async (ctx) => ctx.db.query("audit_log").collect());
  const successEvent = auditEvents.find((e) => e.action === "auth.mfa.success");
  expect(successEvent).toBeDefined();
});

test("challengeMfa: gera evento auth.mfa.failure no audit_log para código errado", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const userId = await setupUser(t);
  await setupActiveMfa(t, userId as string);

  const mfaToken = await t.action(internal.mfa.signMfaToken, { userId: userId as never });
  await t.action(internal.mfa.challengeMfa, { mfaToken, totpCode: "000000" });

  const auditEvents = await t.run(async (ctx) => ctx.db.query("audit_log").collect());
  const failEvent = auditEvents.find((e) => e.action === "auth.mfa.failure");
  expect(failEvent).toBeDefined();
  expect(failEvent?.result).toBe("deny");
});

test("challengeMfa: gera evento auth.mfa.backup_used no audit_log para backup code", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});
  const userId = await setupUser(t);
  await setupActiveMfa(t, userId as string);

  const mfaToken = await t.action(internal.mfa.signMfaToken, { userId: userId as never });
  await t.action(internal.mfa.challengeMfa, { mfaToken, totpCode: "backup001" });

  const auditEvents = await t.run(async (ctx) => ctx.db.query("audit_log").collect());
  const backupEvent = auditEvents.find((e) => e.action === "auth.mfa.backup_used");
  expect(backupEvent).toBeDefined();
  expect(backupEvent?.result).toBe("allow");
});
