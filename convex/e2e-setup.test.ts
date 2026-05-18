/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import argon2 from "argon2";

const modules = import.meta.glob("./**/*.ts");

// Fluxo completo: gatekey init → login → org → workspace → usuário → binding → /check ALLOW
test("E2E: setup completo retorna ALLOW no pdpDecide após gatekey init", async () => {
  const t = convexTest(schema, modules);

  // 1. CLI step: generateKeyPair → par RS256 armazenado
  const { kid } = await t.action(internal.jwt.initializeKeyPair, {});
  expect(kid).toBeTypeOf("string");

  // 2. CLI step: createRootUser → root criado com hash argon2
  const rootPassword = "RootSenha@456";
  const rootPasswordHash = await argon2.hash(rootPassword);
  const bootstrapResult = await t.action(internal.setup.bootstrapRootUser, {
    email: "root@gatekey.dev",
    passwordHash: rootPasswordHash,
  });
  expect(bootstrapResult.success).toBe(true);

  const rootId = await t.run(async (ctx) => {
    const root = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "root@gatekey.dev"))
      .first();
    return root!._id;
  });

  // 3. Root cria uma org com um admin
  const adminEmail = "admin@acme.io";
  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail,
  });
  expect(orgId).toBeTypeOf("string");

  // 4. Root cria um workspace na org
  const workspaceId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Main Workspace",
  });
  expect(workspaceId).toBeTypeOf("string");

  // 5. Cria um usuário na org (inserção direta para simplicidade)
  const memberPassword = "Membro@123";
  const memberHash = await argon2.hash(memberPassword);
  const memberId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "member@acme.io",
      passwordHash: memberHash,
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run(async (ctx) =>
    ctx.db.insert("org_members", {
      userId: memberId,
      orgId,
      role: "member",
      status: "active",
    }),
  );

  // 6. Adiciona o membro ao workspace
  await t.mutation(internal.hierarchy.addWorkspaceMember, {
    callerId: rootId,
    workspaceId,
    userId: memberId,
  });

  // 7. Cria a capability e role necessários para o binding
  const capId = await t.run(async (ctx) =>
    ctx.db.insert("capabilities", {
      name: "document:read",
      description: "Leitura de documentos",
      isBase: true,
    }),
  );
  const roleId = await t.run(async (ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: true }),
  );
  await t.run(async (ctx) =>
    ctx.db.insert("role_capabilities", { roleId, capabilityId: capId }),
  );

  // 8. Cria o binding no nível workspace
  await t.mutation(internal.bindings.createBinding, {
    callerId: rootId,
    orgId,
    workspaceId,
    userId: memberId,
    roleId,
    resourceType: "workspace",
  });

  // 9. pdpDecide → deve retornar ALLOW
  const decision = await t.query(internal.pdp.pdpDecide, {
    userId: memberId,
    orgId,
    capability: "document:read",
    resourceType: "workspace",
    workspaceId,
  });

  expect(decision.allowed).toBe(true);
});
