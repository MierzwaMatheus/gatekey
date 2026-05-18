/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import bcrypt from "bcryptjs";
import { GatekeyClient } from "../sdk/src/client.js";

const modules = import.meta.glob("./**/*.ts");

// ── Helper: org com mfaRequired=true ─────────────────────────────────────────

async function setupMfaRequiredOrg(email: string) {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const PASSWORD = "mfa-test-pass";
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "MfaOrg", status: "active", updatedAt: Date.now() }),
  );

  // org com mfaRequired: true
  await t.run((ctx) =>
    ctx.db.insert("org_settings", {
      orgId: orgId as never,
      loginMethods: ["email_password"],
      mfaRequired: true,
      jwtExpiryAccess: 900,
      jwtExpiryRefresh: 604800,
      quotas: {},
    }),
  );

  const workspaceId = await t.run((ctx) =>
    ctx.db.insert("workspaces", { orgId: orgId as never, name: "WS", status: "active" }),
  );

  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email,
      passwordHash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: userId as never, orgId: orgId as never, role: "member", status: "active" }),
  );
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", { userId: userId as never, workspaceId: workspaceId as never, status: "active" }),
  );

  const fetchFn = (url: string, init?: RequestInit) =>
    t.fetch(url.replace("http://mfa-test", ""), init as RequestInit);
  const client = new GatekeyClient({ baseUrl: "http://mfa-test", fetchFn });

  return { client, email, password: PASSWORD };
}

// ── Ciclo 4A: login com org mfaRequired → mfa_setup_required ─────────────────

test("SDK MFA: login em org com mfaRequired retorna mfa_setup_required quando usuário não tem MFA", async () => {
  const { client, email, password } = await setupMfaRequiredOrg("mfa-setup@test.com");

  const result = await client.auth.login(email, password);

  expect(result.type).toBe("mfa_setup_required");
  if (result.type === "mfa_setup_required") {
    expect(result.mfaSetupToken).toBeTypeOf("string");
    expect(result.mfaSetupToken.length).toBeGreaterThan(0);
  }
});

// ── Ciclo 4B: setup MFA → verify → login com TOTP ────────────────────────────

test("SDK MFA: fluxo completo setup → verify → login com TOTP", async () => {
  const { TOTP, Secret } = await import("otpauth");
  const { client, email, password } = await setupMfaRequiredOrg("mfa-full@test.com");

  // 1. Login → mfa_setup_required
  const loginResult = await client.auth.login(email, password);
  expect(loginResult.type).toBe("mfa_setup_required");
  if (loginResult.type !== "mfa_setup_required") return;

  // 2. Iniciar setup de MFA (usa o mfaSetupToken armazenado internamente)
  const setupResult = await client.auth.mfa.setup();
  expect(setupResult.secret).toBeTypeOf("string");
  expect(setupResult.qrCode).toBeTypeOf("string");
  expect(setupResult.qrCode).toContain("otpauth://");

  // 3. Gerar TOTP válido a partir do secret
  const totp = new TOTP({
    issuer: "GateKey",
    label: "user",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(setupResult.secret),
  });
  const validTotpCode = totp.generate();

  // 4. Verificar setup com código TOTP
  const verifyResult = await client.auth.mfa.verifySetup(validTotpCode);
  expect(verifyResult.success).toBe(true);
  if (verifyResult.success) {
    expect(verifyResult.backupCodes).toHaveLength(10);
    verifyResult.backupCodes.forEach((code) => {
      expect(code).toBeTypeOf("string");
      expect(code.length).toBeGreaterThan(0);
    });
  }

  // 5. Login novamente → agora retorna mfa_challenge (MFA ativo)
  const loginResult2 = await client.auth.login(email, password);
  expect(loginResult2.type).toBe("mfa_challenge");
  if (loginResult2.type !== "mfa_challenge") return;

  // 6. Completar challenge com TOTP
  const challengeResult = await client.auth.mfa.challenge(loginResult2.mfaToken, totp.generate());
  expect(challengeResult.accessToken.split(".").length).toBe(3);
  expect(challengeResult.refreshToken).toBeTypeOf("string");
});

// ── Ciclo 4C: usar backup code no challenge ───────────────────────────────────

test("SDK MFA: challenge com backup code funciona e invalida o código usado", async () => {
  const { TOTP, Secret } = await import("otpauth");
  const { client, email, password } = await setupMfaRequiredOrg("mfa-backup@test.com");

  // Setup completo
  await client.auth.login(email, password);
  const setupResult = await client.auth.mfa.setup();
  const totp = new TOTP({
    issuer: "GateKey",
    label: "user",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(setupResult.secret),
  });
  const verifyResult = await client.auth.mfa.verifySetup(totp.generate());
  if (!verifyResult.success) throw new Error("MFA setup failed");
  const backupCode = verifyResult.backupCodes[0];

  // Login com backup code
  const loginResult = await client.auth.login(email, password);
  expect(loginResult.type).toBe("mfa_challenge");
  if (loginResult.type !== "mfa_challenge") return;

  const challengeResult = await client.auth.mfa.challenge(loginResult.mfaToken, backupCode);
  expect(challengeResult.accessToken.split(".").length).toBe(3);

  // Reusar o mesmo backup code deve falhar
  const loginResult2 = await client.auth.login(email, password);
  if (loginResult2.type !== "mfa_challenge") return;

  await expect(
    client.auth.mfa.challenge(loginResult2.mfaToken, backupCode),
  ).rejects.toThrow();
});

// ── Ciclo 4D: magic link verify com mfa_setup_required ───────────────────────

test("SDK MFA: magic-link verify retorna mfa_setup_required quando org tem mfaRequired", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const PASSWORD = "ml-mfa-pass";
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "MlMfaOrg", status: "active", updatedAt: Date.now() }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_settings", {
      orgId: orgId as never,
      loginMethods: ["email_password", "magic_link"],
      mfaRequired: true,
      jwtExpiryAccess: 900,
      jwtExpiryRefresh: 604800,
      quotas: {},
    }),
  );
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "ml-mfa@test.com",
      passwordHash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: userId as never, orgId: orgId as never, role: "member", status: "active" }),
  );

  // Criar magic link token diretamente (simular o que POST /v1/auth/magic-link faria)
  const tokenRaw = "test-magic-token-12345";
  const { createHash } = await import("node:crypto");
  const tokenHash = createHash("sha256").update(tokenRaw).digest("hex");
  await t.run((ctx) =>
    ctx.db.insert("magic_link_tokens", {
      tokenHash,
      userId: userId as never,
      expiresAt: Date.now() + 15 * 60 * 1000,
    }),
  );

  const fetchFn = (url: string, init?: RequestInit) =>
    t.fetch(url.replace("http://ml-test", ""), init as RequestInit);
  const client = new GatekeyClient({ baseUrl: "http://ml-test", fetchFn });

  // Verificar magic link token — deve retornar mfa_setup_required
  const verifyRes = await fetchFn(`http://ml-test/v1/auth/magic-link/verify?token=${tokenRaw}`);
  const verifyData = await verifyRes.json() as Record<string, unknown>;

  expect(verifyData.mfa_setup_required).toBe(true);
  expect(verifyData.mfa_setup_token).toBeTypeOf("string");
});
