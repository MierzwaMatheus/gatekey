/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { decodeJwt, decodeProtectedHeader } from "jose";

const modules = import.meta.glob("./**/*.ts");

test("par RS256 gerado pelo CLI é o mesmo usado por signJwt em runtime", async () => {
  const t = convexTest(schema, modules);

  const { kid } = await t.action(internal.jwt.initializeKeyPair, {});

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
    ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() }),
  );

  const token = await t.action(internal.jwt.signJwt, {
    sub: userId as unknown as string,
    orgId: orgId as unknown as string,
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: "sess_test",
    expiresInSeconds: 3600,
  });

  const header = decodeProtectedHeader(token);
  expect(header.kid).toBe(kid);
  expect(header.alg).toBe("RS256");
});

test("par RS256 gerado pelo CLI é verificável por verifyJwt em runtime", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "verify@example.com",
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
    workspaceIds: ["ws1"],
    roles: { ws1: "owner" },
    capabilities: ["document:read"],
    sessionId: "sess_verify",
    expiresInSeconds: 3600,
  });

  const result = await t.action(internal.jwt.verifyJwt, { token });
  expect(result.valid).toBe(true);
  if (result.valid) {
    expect(result.payload.sub).toBe(userId as unknown as string);
    expect(result.payload.sessionId).toBe("sess_verify");
  }
});

test("kid gerado por initializeKeyPair aparece no endpoint JWKS", async () => {
  const t = convexTest(schema, modules);
  const { kid } = await t.action(internal.jwt.initializeKeyPair, {});

  const jwks = await t.action(internal.jwt.getJwks, {});
  const kids = jwks.keys.map((k: { kid?: string }) => k.kid);
  expect(kids).toContain(kid);
});
