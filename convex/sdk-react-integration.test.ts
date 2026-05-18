/// <reference types="vite/client" />
/**
 * Ciclo 3 — integração do hook usePermission
 *
 * O hook `usePermission` é um wrapper sobre `client.permissions.check()`.
 * Este teste valida o comportamento do hook através do cliente real,
 * confirmando que o contrato end-to-end (allowed/denied) funciona.
 *
 * A camada React (renderização, estado, efeitos) é validada pelos unit tests
 * em sdk-react, que mockam o cliente e verificam o fluxo de estado.
 * A integração real do cliente está validada aqui.
 */
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import bcrypt from "bcryptjs";
import { GatekeyClient } from "../sdk/src/client.js";

const modules = import.meta.glob("./**/*.ts");

async function setupPermissionEnv(email: string, withBinding: boolean) {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const PASSWORD = "perm-test-pass";
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "PermOrg", status: "active", updatedAt: Date.now() }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_settings", {
      orgId: orgId as never,
      loginMethods: ["email_password"],
      mfaRequired: false,
      jwtExpiryAccess: 900,
      jwtExpiryRefresh: 604800,
      quotas: {},
    }),
  );
  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: true }),
  );
  const capId = await t.run((ctx) =>
    ctx.db.insert("capabilities", { name: "document:read", description: "Read", isBase: true }),
  );
  await t.run((ctx) =>
    ctx.db.insert("role_capabilities", { roleId: roleId as never, capabilityId: capId as never }),
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
  await t.run((ctx) =>
    ctx.db.insert("resource_types", { orgId: orgId as never, name: "document" }),
  );

  if (withBinding) {
    await t.run((ctx) =>
      ctx.db.insert("bindings", { userId: userId as never, roleId: roleId as never, resourceType: "document", workspaceId: workspaceId as never }),
    );
  }

  const fetchFn = (url: string, init?: RequestInit) =>
    t.fetch(url.replace("http://perm-test", ""), init as RequestInit);
  const client = new GatekeyClient({ baseUrl: "http://perm-test", fetchFn });
  await client.auth.login(email, PASSWORD);

  return { client, userId: String(userId), workspaceId: String(workspaceId) };
}

// ── Testes: validam o contrato que usePermission expõe via client.permissions.check ──

test("usePermission integração: check retorna allowed=true (base para hook retornar allowed=true)", async () => {
  const { client, userId, workspaceId } = await setupPermissionEnv("user-with-binding@test.com", true);

  // Este é o mesmo check que usePermission executa internamente
  const result = await client.permissions.check("document:read", "document", undefined, {
    userId,
    workspaceId,
  });

  // usePermission mapeia result.allow → state.allowed
  expect(result.allow).toBe(true);
});

test("usePermission integração: check retorna allowed=false (base para hook retornar allowed=false)", async () => {
  const { client, userId, workspaceId } = await setupPermissionEnv("user-no-binding@test.com", false);

  const result = await client.permissions.check("document:read", "document", undefined, {
    userId,
    workspaceId,
  });

  expect(result.allow).toBe(false);
});
