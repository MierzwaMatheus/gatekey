/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupBase(t: ReturnType<typeof convexTest>) {
  await t.action(internal.jwt.initializeKeyPair, {});
  const orgId = await t.run(async (ctx) =>
    ctx.db.insert("orgs", { name: "TestOrg", status: "active", updatedAt: Date.now() }),
  );
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "ml@test.com",
      passwordHash: "irrelevant",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
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
  return { orgId: orgId as string, userId: userId as string };
}

// ── POST /v1/auth/magic-link ──────────────────────────────────────────────────

test("POST /v1/auth/magic-link: retorna 200 com ok:true para email existente com magic_link habilitado", async () => {
  const t = convexTest(schema, modules);
  await setupBase(t);

  const res = await t.fetch("/v1/auth/magic-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ml@test.com", orgId: (await t.run(async (ctx) => (await ctx.db.query("orgs").first())?._id)) }),
  });

  expect(res.status).toBe(200);
  const body = await res.json() as { ok: boolean };
  expect(body.ok).toBe(true);
});

test("POST /v1/auth/magic-link: retorna 400 quando faltam campos obrigatórios", async () => {
  const t = convexTest(schema, modules);

  const res = await t.fetch("/v1/auth/magic-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ml@test.com" }),
  });

  expect(res.status).toBe(400);
});

// ── GET /v1/auth/magic-link/verify ───────────────────────────────────────────

test("GET /v1/auth/magic-link/verify: retorna 200 com tokens para token válido", async () => {
  const t = convexTest(schema, modules);
  const { userId } = await setupBase(t);

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

  const res = await t.fetch(`/v1/auth/magic-link/verify?token=${rawToken}`, {
    method: "GET",
  });

  expect(res.status).toBe(200);
  const body = await res.json() as { accessToken: string; refreshToken: string };
  expect(body.accessToken).toBeDefined();
  expect(body.refreshToken).toBeDefined();
});

test("GET /v1/auth/magic-link/verify: retorna 401 para token inválido", async () => {
  const t = convexTest(schema, modules);
  await setupBase(t);

  const res = await t.fetch("/v1/auth/magic-link/verify?token=invalidtoken123", {
    method: "GET",
  });

  expect(res.status).toBe(401);
});

test("GET /v1/auth/magic-link/verify: retorna 400 quando token não é fornecido", async () => {
  const t = convexTest(schema, modules);

  const res = await t.fetch("/v1/auth/magic-link/verify", {
    method: "GET",
  });

  expect(res.status).toBe(400);
});
