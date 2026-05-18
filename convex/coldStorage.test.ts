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

// ── Ciclo 3: serialização NDJSON + gzip ───────────────────────────────────────

test("serializeEventsToNdjsonGz produz buffer gzip descomprimível com JSON válido por linha", async () => {
  const t = convexTest(schema, modules);

  const events = [
    { _id: "id1", timestamp: 1000, action: "login", result: "allow" },
    { _id: "id2", timestamp: 2000, action: "logout", result: "allow" },
  ];

  const result = await t.action(internal.coldStorage.serializeEventsToNdjsonGz, { events });

  expect(result).toBeInstanceOf(ArrayBuffer);

  const { gunzipSync } = await import("node:zlib");
  const decompressed = gunzipSync(Buffer.from(result));
  const lines = decompressed.toString("utf-8").trim().split("\n");

  expect(lines).toHaveLength(2);
  expect(JSON.parse(lines[0]).action).toBe("login");
  expect(JSON.parse(lines[1]).action).toBe("logout");
});

// ── Ciclo 4: uploadToR2 falha graciosamente sem env vars ──────────────────────

test("uploadToR2 lança erro descritivo quando R2_ACCOUNT_ID não está configurado", async () => {
  const t = convexTest(schema, modules);

  const fakeBuffer = new ArrayBuffer(8);
  await expect(
    t.action(internal.coldStorage.uploadToR2, {
      buffer: fakeBuffer,
      storagePath: "test-org/2024/01/01/logs.ndjson.gz",
    }),
  ).rejects.toThrow("R2_ACCOUNT_ID");
});
