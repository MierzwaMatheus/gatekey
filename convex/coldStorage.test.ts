/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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

// ── Ciclo 2: getAuditEventsForExport retorna apenas eventos antigos ───────────

test("getAuditEventsForExport retorna eventos mais antigos que 30 dias, não os recentes", async () => {
  const t = convexTest(schema, modules);

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "ExportOrg", status: "active", updatedAt: Date.now() }),
  );

  const now = Date.now();
  const oldTimestamp = now - THIRTY_DAYS_MS - 1000; // 30 dias + 1s atrás
  const recentTimestamp = now - 1000; // 1s atrás

  await t.run((ctx) =>
    ctx.db.insert("audit_log", {
      timestamp: oldTimestamp,
      actorType: "system",
      actorId: "system",
      action: "old.event",
      target: { type: "org" },
      orgId,
      result: "allow",
    }),
  );

  await t.run((ctx) =>
    ctx.db.insert("audit_log", {
      timestamp: recentTimestamp,
      actorType: "system",
      actorId: "system",
      action: "recent.event",
      target: { type: "org" },
      orgId,
      result: "allow",
    }),
  );

  const threshold = now - THIRTY_DAYS_MS;
  const result = await t.query(internal.auditLog.getAuditEventsForExport, {
    orgId,
    beforeTimestamp: threshold,
    paginationOpts: { numItems: 100, cursor: null },
  });

  expect(result.page).toHaveLength(1);
  expect(result.page[0].action).toBe("old.event");
});
