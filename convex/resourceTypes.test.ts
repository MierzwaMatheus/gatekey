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
  const orgId2 = await t.mutation(internal.hierarchy.createOrg, {
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
  const orgId2 = await t.mutation(internal.hierarchy.createOrg, {
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
