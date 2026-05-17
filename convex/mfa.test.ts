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
