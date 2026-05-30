/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setupOrgWithAdmin(t: ReturnType<typeof convexTest>) {
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

  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
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
  const adminId = adminUser!._id;

  return { rootId, orgId, adminId };
}

// ── Ciclo 1: createResourceType ───────────────────────────────────────────────

test("createResourceType: cria resource type simples na org", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdmin(t);

  const result = await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId,
    orgId,
    name: "folder",
  });

  expect(result).toBeDefined();

  const stored = await t.run((ctx) => ctx.db.get(result));
  expect(stored).not.toBeNull();
  expect(stored!.name).toBe("folder");
  expect(stored!.orgId).toStrictEqual(orgId);
  expect(stored!.inheritsFrom).toBeUndefined();
});

test("createResourceType: cria resource type com herança", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdmin(t);

  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId,
    orgId,
    name: "folder",
  });

  const result = await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId,
    orgId,
    name: "document",
    inheritsFrom: "folder",
    inheritanceMode: "auto",
  });

  const stored = await t.run((ctx) => ctx.db.get(result));
  expect(stored!.name).toBe("document");
  expect(stored!.inheritsFrom).toBe("folder");
  expect(stored!.inheritanceMode).toBe("auto");
});

// ── Ciclo 2: listResourceTypes ────────────────────────────────────────────────

test("listResourceTypes: retorna apenas tipos da própria org", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdmin(t);

  // segunda org
  const rootId2 = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root2@gatekey.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );
  const { orgId: orgId2 } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId2,
    name: "Other Corp",
    adminEmail: "admin2@other.io",
  });

  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId,
    orgId,
    name: "folder",
  });
  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: rootId2,
    orgId: orgId2,
    name: "project",
  });

  const list = await t.run((ctx) =>
    ctx.runQuery(internal.resourceTypes.listResourceTypes, {
      callerId: adminId,
      orgId,
    }),
  );

  expect(list).toHaveLength(1);
  expect(list[0].name).toBe("folder");
});

test("listResourceTypes: retorna vazio quando nenhum tipo registrado", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdmin(t);

  const list = await t.run((ctx) =>
    ctx.runQuery(internal.resourceTypes.listResourceTypes, {
      callerId: adminId,
      orgId,
    }),
  );

  expect(list).toHaveLength(0);
});

// ── Ciclo 3: validação de inheritsFrom ────────────────────────────────────────

test("createResourceType: rejeita inheritsFrom inexistente na org", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdmin(t);

  await expect(
    t.mutation(internal.resourceTypes.createResourceType, {
      callerId: adminId,
      orgId,
      name: "document",
      inheritsFrom: "nonexistent",
    }),
  ).rejects.toThrow("invalid_inherits_from");
});

test("createResourceType: rejeita inheritsFrom de outra org", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdmin(t);

  const rootId2 = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root2@gatekey.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );
  const { orgId: orgId2 } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId2,
    name: "Other Corp",
    adminEmail: "admin2@other.io",
  });

  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: rootId2,
    orgId: orgId2,
    name: "folder",
  });

  await expect(
    t.mutation(internal.resourceTypes.createResourceType, {
      callerId: adminId,
      orgId,
      name: "document",
      inheritsFrom: "folder",
    }),
  ).rejects.toThrow("invalid_inherits_from");
});

// ── Helper: setup com JWT ─────────────────────────────────────────────────────

async function setupOrgWithAdminAndJwt(t: ReturnType<typeof convexTest>) {
  await t.action(internal.jwt.initializeKeyPair, {});
  const { adminId, orgId } = await setupOrgWithAdmin(t);
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId: adminId,
      refreshTokenHash: "hash",
      expiresAt: Date.now() + 3600_000,
    }),
  );
  const token = await t.action(internal.jwt.signJwt, {
    sub: adminId as string,
    orgId: orgId as string,
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: sessionId as string,
    expiresInSeconds: 3600,
  });
  return { adminId, orgId, token };
}

// ── Ciclo 4: HTTP endpoints ───────────────────────────────────────────────────

test("POST /v1/resource-types: cria via endpoint e retorna 201", async () => {
  const t = convexTest(schema, modules);
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
  await t.run((ctx) => ctx.db.insert("roles", { name: "admin", isBase: true }));

  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail: "admin@acme.io",
  });

  // Gera token válido para o admin
  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );
  const adminId = adminUser!._id;

  const sessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId: adminId,
      refreshTokenHash: "hash",
      expiresAt: Date.now() + 3600_000,
    }),
  );
  const tokenResult = await t.action(internal.jwt.signJwt, {
    sub: adminId as string,
    orgId: orgId as string,
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: sessionId as string,
    expiresInSeconds: 3600,
  });

  const resp = await t.fetch("/v1/resource-types", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${tokenResult}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "folder" }),
  });

  expect(resp.status).toBe(201);
  const body = await resp.json();
  expect(body.id).toBeDefined();
  expect(body.name).toBe("folder");
});

test("GET /v1/resource-types: lista tipos da org via endpoint", async () => {
  const t = convexTest(schema, modules);
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
  await t.run((ctx) => ctx.db.insert("roles", { name: "admin", isBase: true }));

  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail: "admin@acme.io",
  });

  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );
  const adminId = adminUser!._id;

  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId,
    orgId,
    name: "folder",
  });

  const sessionGet = await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId: adminId,
      refreshTokenHash: "hash",
      expiresAt: Date.now() + 3600_000,
    }),
  );
  const token = await t.action(internal.jwt.signJwt, {
    sub: adminId as string,
    orgId: orgId as string,
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: sessionGet as string,
    expiresInSeconds: 3600,
  });

  const resp = await t.fetch("/v1/resource-types", {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` },
  });

  expect(resp.status).toBe(200);
  const body = await resp.json();
  expect(body.resourceTypes).toHaveLength(1);
  expect(body.resourceTypes[0].name).toBe("folder");
});

test("POST /v1/resource-types: sem Authorization retorna 401", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const resp = await t.fetch("/v1/resource-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "folder" }),
  });

  expect(resp.status).toBe(401);
});

test("POST /v1/resource-types: inheritsFrom inválido retorna 422", async () => {
  const t = convexTest(schema, modules);
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
  await t.run((ctx) => ctx.db.insert("roles", { name: "admin", isBase: true }));

  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail: "admin@acme.io",
  });

  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );
  const adminId = adminUser!._id;

  const sessionPost = await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId: adminId,
      refreshTokenHash: "hash",
      expiresAt: Date.now() + 3600_000,
    }),
  );
  const token = await t.action(internal.jwt.signJwt, {
    sub: adminId as string,
    orgId: orgId as string,
    workspaceIds: [],
    roles: {},
    capabilities: [],
    sessionId: sessionPost as string,
    expiresInSeconds: 3600,
  });

  const resp = await t.fetch("/v1/resource-types", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "document", inheritsFrom: "nonexistent" }),
  });

  expect(resp.status).toBe(422);
});

// ── Ciclo 5: herança two-level via pdpDecide ──────────────────────────────────

test("herança: binding no folder permite acesso ao document via pdpDecide", async () => {
  const t = convexTest(schema, modules);

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
  await t.run((ctx) => ctx.db.insert("roles", { name: "admin", isBase: true }));

  const { orgId } = await t.mutation(internal.hierarchy.createOrg, {
    callerId: rootId,
    name: "Acme Corp",
    adminEmail: "admin@acme.io",
  });

  const adminUser = await t.run((ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@acme.io")).first(),
  );
  const adminId = adminUser!._id;

  const workspaceId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: rootId,
    orgId,
    name: "Main WS",
  });

  // Registrar tipos com herança via a nova mutation
  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId,
    orgId,
    name: "folder",
  });
  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId,
    orgId,
    name: "document",
    inheritsFrom: "folder",
    inheritanceMode: "auto",
  });

  // Role com capability document:read
  const capId = await t.run((ctx) =>
    ctx.db.insert("capabilities", {
      name: "document:read",
      description: "Read documents",
      isBase: true,
    }),
  );
  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "editor", isBase: false, workspaceId }),
  );
  await t.run((ctx) => ctx.db.insert("role_capabilities", { roleId, capabilityId: capId }));

  // Adicionar user ao workspace
  await t.run((ctx) =>
    ctx.db.insert("workspace_members", { userId: adminId, workspaceId, status: "active" }),
  );

  // Binding: user → editor → folder_1 (binding pai)
  const folderBindingId = await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId: adminId,
      roleId,
      resourceType: "folder",
      resourceId: "folder_1",
      workspaceId,
    }),
  );

  // Binding: user → (role sem capability) → doc_1 com parentResourceId=folder_1
  // Isso simula que doc_1 está dentro de folder_1
  const noCapRoleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId: adminId,
      roleId: noCapRoleId,
      resourceType: "document",
      resourceId: "doc_1",
      parentResourceId: "folder_1",
      workspaceId,
    }),
  );

  const session = await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId: adminId,
      refreshTokenHash: "hash",
      expiresAt: Date.now() + 3600_000,
    }),
  );

  const result = await t.run((ctx) =>
    ctx.runQuery(internal.pdp.pdpDecide, {
      userId: adminId,
      orgId,
      capability: "document:read",
      resourceType: "document",
      resourceId: "doc_1",
      workspaceId,
      sessionId: session,
    }),
  );

  expect(result.allowed).toBe(true);
  expect(result.reason).toBe("parent_binding");

  // Cleanup reference for unused variable
  void folderBindingId;
});

// ── Ciclo 6: getAffectedInheritanceUsers ─────────────────────────────────────

test("getAffectedInheritanceUsers: retorna 0 quando não há bindings herdados", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdmin(t);

  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId, orgId, name: "folder",
  });
  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId, orgId, name: "document", inheritsFrom: "folder", inheritanceMode: "auto",
  });

  const count = await t.run((ctx) =>
    ctx.runQuery(internal.resourceTypes.getAffectedInheritanceUsers, {
      callerId: adminId,
      orgId,
      resourceTypeName: "document",
    }),
  );

  expect(count).toBe(0);
});

test("getAffectedInheritanceUsers: retorna contagem de usuários distintos com parent bindings", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdmin(t);

  const workspaceId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: adminId,
    orgId,
    name: "WS Principal",
  });

  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId, orgId, name: "folder",
  });
  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId, orgId, name: "document", inheritsFrom: "folder", inheritanceMode: "auto",
  });

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId }),
  );

  // Usuário 1: binding herdado em document via folder_1
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId: adminId,
      roleId,
      resourceType: "document",
      resourceId: "doc_1",
      parentResourceId: "folder_1",
      workspaceId,
    }),
  );

  // Segundo binding do mesmo usuário (deve contar como 1 único)
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId: adminId,
      roleId,
      resourceType: "document",
      resourceId: "doc_2",
      parentResourceId: "folder_1",
      workspaceId,
    }),
  );

  const count = await t.run((ctx) =>
    ctx.runQuery(internal.resourceTypes.getAffectedInheritanceUsers, {
      callerId: adminId,
      orgId,
      resourceTypeName: "document",
    }),
  );

  expect(count).toBe(1);
});

// ── Ciclo 7: updateResourceTypeInheritance ────────────────────────────────────

test("updateResourceTypeInheritance: desativa inheritanceMode com sucesso", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdmin(t);

  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId, orgId, name: "folder",
  });
  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId, orgId, name: "document", inheritsFrom: "folder", inheritanceMode: "auto",
  });

  await t.mutation(internal.resourceTypes.updateResourceTypeInheritance, {
    callerId: adminId,
    orgId,
    resourceTypeName: "document",
    inheritanceMode: undefined,
  });

  const updated = await t.run((ctx) =>
    ctx.db
      .query("resource_types")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("name"), "document"))
      .first(),
  );
  expect(updated!.inheritanceMode).toBeUndefined();
});

test("updateResourceTypeInheritance: rejeita se caller não é admin", async () => {
  const t = convexTest(schema, modules);
  const { orgId } = await setupOrgWithAdmin(t);

  const nonAdminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "nonadmin@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );

  await expect(
    t.mutation(internal.resourceTypes.updateResourceTypeInheritance, {
      callerId: nonAdminId,
      orgId,
      resourceTypeName: "document",
      inheritanceMode: undefined,
    }),
  ).rejects.toThrow("forbidden");
});

test("updateResourceTypeInheritance: rejeita se resource type não existe", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdmin(t);

  await expect(
    t.mutation(internal.resourceTypes.updateResourceTypeInheritance, {
      callerId: adminId,
      orgId,
      resourceTypeName: "nonexistent",
      inheritanceMode: undefined,
    }),
  ).rejects.toThrow("not_found");
});

test("createResourceType: registra evento no audit_log", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId } = await setupOrgWithAdmin(t);

  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId,
    orgId,
    name: "folder",
  });

  const events = await t.run((ctx) =>
    ctx.db
      .query("audit_log")
      .withIndex("by_orgId_and_timestamp", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  const event = events.find((e) => e.action === "resource_type.create");
  expect(event).toBeDefined();
  expect(event!.result).toBe("allow");
});

// ── Ciclo 8: HTTP endpoints inheritance-check e PATCH ────────────────────────

test("GET /v1/resource-types/:name/inheritance-check: retorna affectedCount 0", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, token } = await setupOrgWithAdminAndJwt(t);

  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId, orgId, name: "folder",
  });
  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId, orgId, name: "document", inheritsFrom: "folder", inheritanceMode: "auto",
  });

  const resp = await t.fetch("/v1/resource-types/document/inheritance-check", {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` },
  });

  expect(resp.status).toBe(200);
  const body = await resp.json();
  expect(body.affectedCount).toBe(0);
});

test("GET /v1/resource-types/:name/inheritance-check: retorna count correto quando há usuários afetados", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, token } = await setupOrgWithAdminAndJwt(t);

  const workspaceId = await t.mutation(internal.hierarchy.createWorkspace, {
    callerId: adminId, orgId, name: "WS",
  });
  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId, orgId, name: "folder",
  });
  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId, orgId, name: "document", inheritsFrom: "folder", inheritanceMode: "auto",
  });

  const roleId = await t.run((ctx) =>
    ctx.db.insert("roles", { name: "viewer", isBase: false, workspaceId }),
  );
  await t.run((ctx) =>
    ctx.db.insert("bindings", {
      userId: adminId,
      roleId,
      resourceType: "document",
      resourceId: "doc_1",
      parentResourceId: "folder_1",
      workspaceId,
    }),
  );

  const resp = await t.fetch("/v1/resource-types/document/inheritance-check", {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` },
  });

  expect(resp.status).toBe(200);
  const body = await resp.json();
  expect(body.affectedCount).toBe(1);
});

test("PATCH /v1/resource-types/:name: atualiza inheritanceMode e retorna 200", async () => {
  const t = convexTest(schema, modules);
  const { adminId, orgId, token } = await setupOrgWithAdminAndJwt(t);

  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId, orgId, name: "folder",
  });
  await t.mutation(internal.resourceTypes.createResourceType, {
    callerId: adminId, orgId, name: "document", inheritsFrom: "folder", inheritanceMode: "auto",
  });

  const resp = await t.fetch("/v1/resource-types/document", {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inheritanceMode: null }),
  });

  expect(resp.status).toBe(200);
});

test("PATCH /v1/resource-types/:name: sem auth retorna 401", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const resp = await t.fetch("/v1/resource-types/document", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inheritanceMode: null }),
  });

  expect(resp.status).toBe(401);
});
