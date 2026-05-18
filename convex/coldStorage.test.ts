/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── Ciclo 1: audit_exports tem campo createdAt ────────────────────────────────

test("audit_exports registra createdAt ao ser inserido", async () => {
  const t = convexTest(schema, modules);

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "TestOrg", status: "active", updatedAt: Date.now() }),
  );

  const now = Date.now();
  const exportId = await t.run((ctx) =>
    ctx.db.insert("audit_exports", {
      orgId,
      period: { start: now - 30 * 24 * 60 * 60 * 1000, end: now },
      storagePath: "testorg/2024/01/01/logs.ndjson.gz",
      createdAt: now,
    }),
  );

  const record = await t.run((ctx) => ctx.db.get(exportId));
  expect(record).not.toBeNull();
  expect(record!.createdAt).toBe(now);
  expect(record!.storagePath).toBe("testorg/2024/01/01/logs.ndjson.gz");
});
