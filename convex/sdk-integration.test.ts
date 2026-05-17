/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, beforeEach } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import bcrypt from "bcryptjs";
import { GatekeyClient } from "../sdk/src/client.js";

const modules = import.meta.glob("./**/*.ts");

// ── Helper: cria ambiente completo (org, workspace, usuário, binding) ─────────

async function setupFullEnv(t: ReturnType<typeof convexTest>) {
  await t.action(internal.jwt.initializeKeyPair, {});

  const PASSWORD = "test-password-123";
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Cria org com org_settings padrão
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "TestOrg", status: "active", updatedAt: Date.now() }),
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

  // Cria roles base necessários
  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: true }),
  );

  // Cria capability
  const capId = await t.run((ctx) =>
    ctx.db.insert("capabilities", {
      name: "document:read",
      description: "Read documents",
      isBase: true,
    }),
  );

  // Vincula capability ao role
  await t.run((ctx) =>
    ctx.db.insert("role_capabilities", {
      roleId: roleId as never,
      capabilityId: capId as never,
    }),
  );

  // Cria workspace
  const workspaceId = await t.run((ctx) =>
    ctx.db.insert("workspaces", {
      orgId: orgId as never,
      name: "Main Workspace",
      status: "active",
    }),
  );

  // Cria usuário
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "user@testorg.com",
      passwordHash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  // Adiciona como membro da org
  await t.run((ctx) =>
    ctx.db.insert("org_members", {
      userId: userId as never,
      orgId: orgId as never,
      role: "member",
      status: "active",
    }),
  );

  // Adiciona como membro do workspace
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", {
      userId: userId as never,
      workspaceId: workspaceId as never,
      status: "active",
    }),
  );

  // Cria resource type
  await t.run((ctx) =>
    ctx.db.insert("resource_types", {
      orgId: orgId as never,
      name: "document",
    }),
  );

  // Cria binding: userId → viewer no workspace inteiro
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId: userId as never,
      roleId: roleId as never,
      resourceType: "document",
      workspaceId: workspaceId as never,
    }),
  );

  // Função fetchFn que adapta t.fetch para o GatekeyClient
  const fetchFn = (url: string, init?: RequestInit) => {
    const path = url.replace("http://test", "");
    return t.fetch(path, init as RequestInit);
  };

  const client = new GatekeyClient({
    baseUrl: "http://test",
    fetchFn,
  });

  return {
    client,
    userId: String(userId),
    orgId: String(orgId),
    workspaceId: String(workspaceId),
    email: "user@testorg.com",
    password: PASSWORD,
  };
}

// ── Ciclo 1: login + check end-to-end ─────────────────────────────────────────

test("SDK integração: client.auth.login retorna success com tokens válidos", async () => {
  const t = convexTest(schema, modules);
  const env = await setupFullEnv(t);

  const result = await env.client.auth.login(env.email, env.password);

  expect(result.type).toBe("success");
  if (result.type === "success") {
    expect(result.accessToken.split(".").length).toBe(3);
    expect(result.refreshToken).toBeTypeOf("string");
  }
});

test("SDK integração: client.permissions.check retorna allowed=true com binding correto", async () => {
  const t = convexTest(schema, modules);
  const env = await setupFullEnv(t);

  const loginResult = await env.client.auth.login(env.email, env.password);
  expect(loginResult.type).toBe("success");

  const checkResult = await env.client.permissions.check(
    "document:read",
    "document",
    undefined,
    { userId: env.userId, workspaceId: env.workspaceId },
  );

  expect(checkResult.allow).toBe(true);
});

test("SDK integração: client.permissions.check retorna allowed=false sem binding", async () => {
  const t = convexTest(schema, modules);
  const env = await setupFullEnv(t);

  // Cria segundo usuário sem binding
  const passwordHash = await bcrypt.hash("other-pass", 10);
  const otherId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "other@testorg.com",
      passwordHash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", {
      userId: otherId as never,
      orgId: env.orgId as never,
      role: "member",
      status: "active",
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", {
      userId: otherId as never,
      workspaceId: env.workspaceId as never,
      status: "active",
    }),
  );

  // Loga como o usuário sem binding
  const fetchFn = (url: string, init?: RequestInit) => {
    const path = url.replace("http://test", "");
    return t.fetch(path, init as RequestInit);
  };
  const otherClient = new GatekeyClient({ baseUrl: "http://test", fetchFn });
  await otherClient.auth.login("other@testorg.com", "other-pass");

  const checkResult = await otherClient.permissions.check(
    "document:read",
    "document",
    undefined,
    { userId: String(otherId), workspaceId: env.workspaceId },
  );

  expect(checkResult.allow).toBe(false);
});
