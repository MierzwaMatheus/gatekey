/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import bcrypt from "bcryptjs";

const modules = import.meta.glob("./**/*.ts");

// ── Helper base ────────────────────────────────────────────────────────────────

async function setupQuotaBase(t: ReturnType<typeof convexTest>) {
  await t.action(internal.jwt.initializeKeyPair, {});

  const rootId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root@gatekey.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );

  await t.run((ctx) =>
    ctx.db.insert("roles", { name: "admin", isBase: true }),
  );

  const PASSWORD = "Admin@Quota123";
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "QuotaCorp",
    adminEmail: "admin@quotacorp.io",
  });

  const adminUser = await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "admin@quotacorp.io"))
      .first(),
  );
  await t.run((ctx) => ctx.db.patch(adminUser!._id, { passwordHash }));
  const adminId = adminUser!._id;

  const workspaceId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Main WS",
  });

  const login = await t.action(internal.auth.loginWithPassword, {
    email: "admin@quotacorp.io",
    password: PASSWORD,
  });
  if (!login.success) throw new Error("login failed in quota setup");

  // Atualizar quota no org_settings
  const settings = await t.run((ctx) =>
    ctx.db.query("org_settings").filter((q) => q.eq(q.field("orgId"), orgId)).first(),
  );

  return { rootId, orgId, adminId, workspaceId, token: login.accessToken, settingsId: settings!._id };
}

// ── Ciclo 3: E2E quota de users ───────────────────────────────────────────────

test("E2E: atingir cota users_per_org → POST /v1/users retorna 429 QuotaExceeded", async () => {
  const t = convexTest(schema, modules);
  const { orgId, settingsId, token } = await setupQuotaBase(t);

  // Definir cota de 1 user por org (o admin já existe → 1 no total)
  await t.run((ctx) =>
    ctx.db.patch(settingsId, { quotas: { users_per_org: 1 } }),
  );

  // Tentar criar mais um usuário
  const res = await t.fetch("/v1/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "toomany@quotacorp.io", password: "TooMany@1", role: "member", orgId: orgId as string }),
  });

  expect(res.status).toBe(429);
  const body = await res.json();
  expect(body.error).toBe("QuotaExceeded");
  expect(body.quota).toBe("users_per_org");
});

// ── Ciclo 4: E2E quota de workspaces ─────────────────────────────────────────

test("E2E: atingir cota workspaces_per_org → POST /v1/workspaces retorna 429 QuotaExceeded", async () => {
  const t = convexTest(schema, modules);
  const { settingsId, token } = await setupQuotaBase(t);

  // Cota = 1 workspace (já existe 1 criado no setup)
  await t.run((ctx) =>
    ctx.db.patch(settingsId, { quotas: { workspaces_per_org: 1 } }),
  );

  const res = await t.fetch("/v1/workspaces", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Extra WS" }),
  });

  expect(res.status).toBe(429);
  const body = await res.json();
  expect(body.error).toBe("QuotaExceeded");
  expect(body.quota).toBe("workspaces_per_org");
});

// ── Ciclo 5: E2E quota de roles ───────────────────────────────────────────────

test("E2E: atingir cota roles_per_workspace → POST /v1/roles retorna 429 QuotaExceeded", async () => {
  const t = convexTest(schema, modules);
  const { workspaceId, settingsId, token } = await setupQuotaBase(t);

  // Criar 1 role custom para preencher cota = 1
  await t.run((ctx) =>
    ctx.db.insert("roles", { name: "existing-role", isBase: false, workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.patch(settingsId, { quotas: { roles_per_workspace: 1 } }),
  );

  const res = await t.fetch("/v1/roles", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "extra-role", workspaceId: workspaceId as string }),
  });

  expect(res.status).toBe(429);
  const body = await res.json();
  expect(body.error).toBe("QuotaExceeded");
  expect(body.quota).toBe("roles_per_workspace");
});

// ── Ciclo 6: E2E quota de capabilities ────────────────────────────────────────

test("E2E: atingir cota capabilities_per_org → POST /v1/capabilities retorna 429 QuotaExceeded", async () => {
  const t = convexTest(schema, modules);
  const { orgId, settingsId, token } = await setupQuotaBase(t);

  // Criar 1 capability custom para preencher cota = 1
  await t.run((ctx) =>
    ctx.db.insert("capabilities", { orgId, name: "existing-cap", description: "exists", isBase: false }),
  );
  await t.run((ctx) =>
    ctx.db.patch(settingsId, { quotas: { capabilities_per_org: 1 } }),
  );

  const res = await t.fetch("/v1/capabilities", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "extra-cap", description: "too many" }),
  });

  expect(res.status).toBe(429);
  const body = await res.json();
  expect(body.error).toBe("QuotaExceeded");
  expect(body.quota).toBe("capabilities_per_org");
});

// ── Ciclo 7: E2E quota de sessions ────────────────────────────────────────────

test("E2E: atingir cota sessions_per_user → segundo login retorna erro quota_exceeded", async () => {
  const t = convexTest(schema, modules);
  const { settingsId } = await setupQuotaBase(t);

  // Cota = 1 sessão (já existe 1 do login no setup)
  await t.run((ctx) =>
    ctx.db.patch(settingsId, { quotas: { sessions_per_user: 1 } }),
  );

  const PASSWORD = "Admin@Quota123";
  const res = await t.fetch("/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@quotacorp.io", password: PASSWORD }),
  });

  // Login retorna 401 com erro quota_exceeded para sessions
  expect(res.status).toBe(401);
  const body = await res.json();
  expect(body.error).toBe("quota_exceeded");
});

// ── Ciclo 8: E2E quota de API Keys ────────────────────────────────────────────

test("E2E: atingir cota api_keys_per_org → POST /v1/api-keys retorna 429 QuotaExceeded", async () => {
  const t = convexTest(schema, modules);
  const { orgId, settingsId, token } = await setupQuotaBase(t);

  // Criar 1 API key diretamente para preencher cota = 1
  await t.run((ctx) =>
    ctx.db.insert("api_keys", {
      orgId,
      publicId: "existingkey12345678901234",
      secretHash: "hash",
      scopes: ["check"],
      description: "existing",
      status: "active",
    }),
  );
  await t.run((ctx) =>
    ctx.db.patch(settingsId, { quotas: { api_keys_per_org: 1 } }),
  );

  const res = await t.fetch("/v1/api-keys", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ scopes: ["check"], description: "extra key" }),
  });

  expect(res.status).toBe(429);
  const body = await res.json();
  expect(body.error).toBe("QuotaExceeded");
  expect(body.quota).toBe("api_keys_per_org");
});
