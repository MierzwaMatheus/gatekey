/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import argon2 from "argon2";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setupOrgWithToken(t: ReturnType<typeof convexTest>) {
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

  const PASSWORD = "admin-secret-123";
  const passwordHash = await argon2.hash(PASSWORD);

  const orgId = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail: "admin@acme.io",
  });

  const adminUser = await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "admin@acme.io"))
      .first(),
  );
  await t.run((ctx) => ctx.db.patch(adminUser!._id, { passwordHash }));

  const login = await t.action(internal.auth.loginWithPassword, {
    email: "admin@acme.io",
    password: PASSWORD,
  });
  if (!login.success) throw new Error("login failed in test setup");

  return { rootId, orgId, adminId: adminUser!._id, token: login.accessToken, sessionId: login.sessionId };
}

// ── Ciclo 1: sem Authorization → 401 ─────────────────────────────────────────

test("PEP integração: chamada sem header Authorization retorna 401", async () => {
  const t = convexTest(schema, modules);
  const res = await t.fetch("/v1/sessions", { method: "GET" });
  expect(res.status).toBe(401);
});

// ── Ciclo 3: sessionId na blacklist → 401 ────────────────────────────────────

test("PEP integração: chamada com sessionId na blacklist retorna 401", async () => {
  const t = convexTest(schema, modules);
  const { token, sessionId } = await setupOrgWithToken(t);

  await t.mutation(internal.jwtStore.blacklistSession, {
    sessionId: sessionId as never,
    expiresAt: Date.now() + 3600000,
  });

  const res = await t.fetch("/v1/sessions", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(401);
});

// ── Ciclo 2: JWT expirado → 401 ───────────────────────────────────────────────

test("PEP integração: chamada com JWT expirado retorna 401", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "expired@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId,
      refreshTokenHash: "hash",
      expiresAt: Date.now() + 86400000,
    }),
  );

  const expiredToken = await t.action(internal.jwt.signJwt, {
    sub: userId as string,
    orgId: orgId as string,
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: sessionId as string,
    expiresInSeconds: -3600,
  });

  const res = await t.fetch("/v1/sessions", {
    method: "GET",
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  expect(res.status).toBe(401);
});
