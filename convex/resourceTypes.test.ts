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
