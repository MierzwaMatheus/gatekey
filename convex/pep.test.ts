/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { extractJwtContext } from "./pepUtils";

const modules = import.meta.glob("./**/*.ts");

// ── extractJwtContext: validação de formato ──────────────────────────────────

test("extractJwtContext: lança erro quando header é string vazia", () => {
  expect(() => extractJwtContext("")).toThrow();
});

test("extractJwtContext: lança erro quando header não tem prefixo Bearer", () => {
  expect(() => extractJwtContext("eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig")).toThrow();
});

test("extractJwtContext: lança erro quando token tem menos de 3 segmentos", () => {
  expect(() => extractJwtContext("Bearer eyJhbGci.eyJzdWIi")).toThrow();
});

test("extractJwtContext: lança erro quando payload base64 não é JSON válido", () => {
  expect(() => extractJwtContext("Bearer eyJhbGci.bm90anNvbg.sig")).toThrow();
});

// ── extractJwtContext: extração de payload ───────────────────────────────────

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `Bearer eyJhbGciOiJSUzI1NiJ9.${encoded}.sig`;
}

test("extractJwtContext: retorna userId do campo sub", () => {
  const header = makeJwt({ sub: "user123", orgId: "org1" });
  const ctx = extractJwtContext(header);
  expect(ctx.userId).toBe("user123");
});

test("extractJwtContext: retorna orgId, sessionId, workspaceIds, roles do payload", () => {
  const header = makeJwt({
    sub: "user1",
    orgId: "org1",
    sessionId: "sess1",
    workspaceIds: ["ws1", "ws2"],
    roles: { ws1: "admin" },
  });
  const ctx = extractJwtContext(header);
  expect(ctx.orgId).toBe("org1");
  expect(ctx.sessionId).toBe("sess1");
  expect(ctx.workspaceIds).toEqual(["ws1", "ws2"]);
  expect(ctx.roles).toEqual({ ws1: "admin" });
});

test("extractJwtContext: lança erro quando campo sub está ausente", () => {
  expect(() => extractJwtContext(makeJwt({ orgId: "org1" }))).toThrow();
});

test("extractJwtContext: lança erro quando campo orgId está ausente", () => {
  expect(() => extractJwtContext(makeJwt({ sub: "user1" }))).toThrow();
});

// ── extractApiKeyContext: validação de formato ───────────────────────────────

import { extractApiKeyContextFormat, withPep } from "./pep";
import type { ActionCtx } from "./_generated/server";

function makeMockCtx(runQueryImpl?: (fn: unknown, args: unknown) => Promise<unknown>): ActionCtx {
  return {
    runQuery: runQueryImpl ?? (async () => null),
    runMutation: async () => null,
    runAction: async () => null,
    scheduler: { runAfter: async () => {}, runAt: async () => {} },
    auth: { getUserIdentity: async () => null },
    storage: {} as never,
    vectorSearch: async () => [],
  } as unknown as ActionCtx;
}

test("extractApiKeyContext: lança erro quando header não tem prefixo Bearer", () => {
  expect(() => extractApiKeyContextFormat("gk_live_pk_abc123_secret")).toThrow("missing_bearer");
});

test("extractApiKeyContext: lança erro quando token não começa com gk_live_pk_", () => {
  expect(() => extractApiKeyContextFormat("Bearer someOtherToken")).toThrow("invalid_api_key_format");
});

test("extractApiKeyContext: lança erro quando token não tem separador de publicId", () => {
  expect(() => extractApiKeyContextFormat("Bearer gk_live_pk_nosseparator")).toThrow("invalid_api_key_format");
});

// ── extractApiKeyContext: lookup e verificação de hash ───────────────────────

import argon2 from "argon2";
import { internal } from "./_generated/api";

test("extractApiKeyContext: lança api_key_invalid quando publicId não encontrado no DB", async () => {
  const t = convexTest(schema, modules);
  const result = await t.action(internal.pep.verifyApiKey, {
    authHeader: "Bearer gk_live_pk_notfound_anysecret",
  });
  expect(result).toMatchObject({ success: false, error: "api_key_invalid" });
});

test("extractApiKeyContext: lança api_key_invalid quando key está revogada", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
  });
  const orgId = await t.run(async (ctx) => {
    return (await ctx.db.query("orgs").first())!._id;
  });
  const secretHash = await argon2.hash("mysecret");
  await t.run(async (ctx) => {
    await ctx.db.insert("api_keys", {
      orgId,
      publicId: "revokedkey",
      secretHash,
      scopes: ["read"],
      description: "test key",
      status: "revoked",
    });
  });
  const result = await t.action(internal.pep.verifyApiKey, {
    authHeader: "Bearer gk_live_pk_revokedkey_mysecret",
  });
  expect(result).toMatchObject({ success: false, error: "api_key_invalid" });
});

test("extractApiKeyContext: retorna contexto para key válida com secret correto", async () => {
  const t = convexTest(schema, modules);
  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
  });
  const secretHash = await argon2.hash("validsecret");
  await t.run(async (ctx) => {
    await ctx.db.insert("api_keys", {
      orgId,
      publicId: "validkey",
      secretHash,
      scopes: ["read", "write"],
      description: "test key",
      status: "active",
    });
  });
  const result = await t.action(internal.pep.verifyApiKey, {
    authHeader: "Bearer gk_live_pk_validkey_validsecret",
  });
  expect(result).toMatchObject({ success: true, publicId: "validkey", scopes: ["read", "write"] });
});

// ── resolveAuthContext ───────────────────────────────────────────────────────

test("resolveAuthContext: retorna type jwt para tokens Bearer eyJ...", async () => {
  const t = convexTest(schema, modules);
  const header = makeJwt({ sub: "user1", orgId: "org1" });
  const result = await t.action(internal.pep.resolveAuth, { authHeader: header });
  expect(result).toMatchObject({ success: true, type: "jwt" });
});

test("resolveAuthContext: retorna type api_key para tokens Bearer gk_live_pk_...", async () => {
  const t = convexTest(schema, modules);
  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
  });
  const secretHash = await argon2.hash("mysecret");
  await t.run(async (ctx) => {
    await ctx.db.insert("api_keys", {
      orgId,
      publicId: "mykey2",
      secretHash,
      scopes: ["read"],
      description: "test",
      status: "active",
    });
  });
  const result = await t.action(internal.pep.resolveAuth, {
    authHeader: "Bearer gk_live_pk_mykey2_mysecret",
  });
  expect(result).toMatchObject({ success: true, type: "api_key" });
});

test("resolveAuthContext: retorna erro quando header Authorization está ausente", async () => {
  const t = convexTest(schema, modules);
  const result = await t.action(internal.pep.resolveAuth, { authHeader: "" });
  expect(result).toMatchObject({ success: false, error: "missing_bearer" });
});

test("extractApiKeyContext: lança api_key_invalid quando hash do secret não confere", async () => {
  const t = convexTest(schema, modules);
  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
  });
  const secretHash = await argon2.hash("correctsecret");
  await t.run(async (ctx) => {
    await ctx.db.insert("api_keys", {
      orgId,
      publicId: "mykey",
      secretHash,
      scopes: ["read"],
      description: "test key",
      status: "active",
    });
  });
  const result = await t.action(internal.pep.verifyApiKey, {
    authHeader: "Bearer gk_live_pk_mykey_wrongsecret",
  });
  expect(result).toMatchObject({ success: false, error: "api_key_invalid" });
});

// ── withPep: token ausente/inválido retorna 401 ──────────────────────────────

const noopHandler = async () => new Response("OK", { status: 200 });

test("withPep: retorna HTTP 401 quando Authorization header está ausente", async () => {
  const handler = withPep(noopHandler, { resourceType: "workspace" });
  const req = new Request("https://example.com/api", { method: "GET" });
  const res = await handler(makeMockCtx(), req);
  expect(res.status).toBe(401);
});

test("withPep: retorna HTTP 401 quando JWT está malformado (segmentos insuficientes)", async () => {
  const handler = withPep(noopHandler, { resourceType: "workspace" });
  const req = new Request("https://example.com/api", {
    method: "GET",
    headers: { Authorization: "Bearer eyJhbGci.payload" },
  });
  const res = await handler(makeMockCtx(), req);
  expect(res.status).toBe(401);
});

test("withPep: retorna HTTP 401 quando payload JWT não é JSON válido", async () => {
  const handler = withPep(noopHandler, { resourceType: "workspace" });
  const req = new Request("https://example.com/api", {
    method: "GET",
    headers: { Authorization: "Bearer eyJhbGci.bm90anNvbg.sig" },
  });
  const res = await handler(makeMockCtx(), req);
  expect(res.status).toBe(401);
});

test("withPep: retorna HTTP 401 quando formato do token API Key é inválido", async () => {
  const handler = withPep(noopHandler, { resourceType: "workspace" });
  const req = new Request("https://example.com/api", {
    method: "GET",
    headers: { Authorization: "Bearer gk_live_pk_nossep" },
  });
  const res = await handler(makeMockCtx(), req);
  expect(res.status).toBe(401);
});

// ── withPep: PDP DENY retorna 403 ────────────────────────────────────────────

test("withPep: retorna HTTP 403 com JSON quando pdpDecide retorna DENY", async () => {
  const t = convexTest(schema, modules);

  const orgId = await t.run(async (ctx) => ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() }));
  const wsId = await t.run(async (ctx) => ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" }));
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "u@test.com", passwordHash: "h", status: "suspended", loginAttempts: 0, updatedAt: Date.now() }),
  );

  const payload = makeJwt({ sub: userId as string, orgId: orgId as string, sessionId: "", workspaceIds: [wsId as string], roles: {} });
  const handler = withPep(noopHandler, { resourceType: "workspace", workspaceId: wsId as string });

  const ctx = makeMockCtx(async (fn, args) => t.run(async (c) => c.runQuery(fn as never, args as never)));
  const req = new Request("https://example.com/api", { method: "GET", headers: { Authorization: payload } });
  const res = await handler(ctx, req);

  expect(res.status).toBe(403);
  const body = await res.json();
  expect(body).toMatchObject({ allowed: false, reason: expect.any(String) });
});

// ── withPepMutation ──────────────────────────────────────────────────────────

import { withPepMutation } from "./pepMutation";

test("withPepMutation: executa handler quando PDP permite", async () => {
  const t = convexTest(schema, modules);

  const orgId = await t.run(async (ctx) => ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() }));
  const wsId = await t.run(async (ctx) => ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" }));
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "m@test.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now() }),
  );
  await t.run(async (ctx) => ctx.db.insert("workspace_members", { userId, workspaceId: wsId, status: "active" }));
  const roleId = await t.run(async (ctx) => ctx.db.insert("roles", { name: "admin", isBase: true }));
  const capId = await t.run(async (ctx) =>
    ctx.db.insert("capabilities", { name: "read", description: "read", isBase: true }),
  );
  await t.run(async (ctx) => ctx.db.insert("role_capabilities", { roleId, capabilityId: capId }));
  await t.run(async (ctx) =>
    ctx.db.insert("bindings", { userId, roleId, resourceType: "workspace", workspaceId: wsId }),
  );

  const result = await t.mutation(internal.pepMutation.testMutation, {
    userId,
    orgId,
    workspaceId: wsId,
    requiredCapability: "read",
  });
  expect(result).toBe("ok");
});

test("withPepMutation: pode ser registrada como internalMutation", () => {
  expect(typeof withPepMutation).toBe("function");
  const registered = withPepMutation(async () => "result", "read");
  expect(registered).toBeDefined();
  expect(typeof registered.isConvexFunction).toBe("undefined");
});

// ── withPep: PDP ALLOW delega ao handler ────────────────────────────────────

test("withPep: chama handler e retorna sua Response quando PDP permite (sem workspaceId)", async () => {
  const handler = withPep(
    async (_ctx, _req, auth) =>
      new Response(JSON.stringify({ userId: auth.type === "jwt" ? auth.data.userId : null }), { status: 200 }),
    { resourceType: "workspace" },
  );
  const jwtHeader = makeJwt({ sub: "user42", orgId: "org1" });
  const req = new Request("https://example.com/api", { method: "GET", headers: { Authorization: jwtHeader } });
  const res = await handler(makeMockCtx(), req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.userId).toBe("user42");
});

test("withPep: resposta 403 tem Content-Type application/json", async () => {
  const t = convexTest(schema, modules);

  const orgId = await t.run(async (ctx) => ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() }));
  const wsId = await t.run(async (ctx) => ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" }));
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "u2@test.com", passwordHash: "h", status: "suspended", loginAttempts: 0, updatedAt: Date.now() }),
  );

  const payload = makeJwt({ sub: userId as string, orgId: orgId as string, sessionId: "", workspaceIds: [], roles: {} });
  const handler = withPep(noopHandler, { resourceType: "workspace", workspaceId: wsId as string });

  const ctx = makeMockCtx(async (fn, args) => t.run(async (c) => c.runQuery(fn as never, args as never)));
  const req = new Request("https://example.com/api", { method: "GET", headers: { Authorization: payload } });
  const res = await handler(ctx, req);

  expect(res.status).toBe(403);
  expect(res.headers.get("Content-Type")).toContain("application/json");
});
