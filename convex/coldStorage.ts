"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { gzipSync } from "node:zlib";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const serializeEventsToNdjsonGz = internalAction({
  args: {
    events: v.array(v.any()),
  },
  returns: v.bytes(),
  handler: async (_ctx, args) => {
    const ndjson = args.events.map((e) => JSON.stringify(e)).join("\n");
    const compressed = gzipSync(Buffer.from(ndjson, "utf-8"));
    return compressed.buffer.slice(
      compressed.byteOffset,
      compressed.byteOffset + compressed.byteLength,
    ) as ArrayBuffer;
  },
});

export const uploadToR2 = internalAction({
  args: {
    buffer: v.bytes(),
    storagePath: v.string(),
  },
  returns: v.string(),
  handler: async (_ctx, args) => {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;

    if (!accountId) throw new Error("R2_ACCOUNT_ID not configured");
    if (!accessKeyId) throw new Error("R2_ACCESS_KEY_ID not configured");
    if (!secretAccessKey) throw new Error("R2_SECRET_ACCESS_KEY not configured");
    if (!bucket) throw new Error("R2_BUCKET_NAME not configured");

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: args.storagePath,
        Body: Buffer.from(args.buffer),
        ContentType: "application/gzip",
        ContentEncoding: "gzip",
      }),
    );

    return args.storagePath;
  },
});

export const exportAuditLogsForOrg = internalAction({
  args: {
    orgId: v.id("orgs"),
    exportEnd: v.number(),
    mockStoragePath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allEvents: unknown[] = [];
    let cursor: string | null = null;

    // Paginar todos os eventos antigos
    while (true) {
      const page: { page: unknown[]; isDone: boolean; continueCursor: string } = await ctx.runQuery(internal.auditLog.getAuditEventsForExport, {
        orgId: args.orgId,
        beforeTimestamp: args.exportEnd,
        paginationOpts: { numItems: 200, cursor },
      });
      allEvents.push(...page.page);
      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    if (allEvents.length === 0) return;

    const exportStart = Math.min(...(allEvents as { timestamp: number }[]).map((e) => e.timestamp));

    let storagePath: string;
    if (args.mockStoragePath) {
      storagePath = args.mockStoragePath;
    } else {
      const buffer = await ctx.runAction(internal.coldStorage.serializeEventsToNdjsonGz, {
        events: allEvents,
      });

      const date = new Date(args.exportEnd);
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(date.getUTCDate()).padStart(2, "0");
      const path = `${args.orgId}/${yyyy}/${mm}/${dd}/logs.ndjson.gz`;

      storagePath = await ctx.runAction(internal.coldStorage.uploadToR2, {
        buffer,
        storagePath: path,
      });
    }

    await ctx.runMutation(internal.auditLog.recordAuditExport, {
      orgId: args.orgId,
      period: { start: exportStart, end: args.exportEnd },
      storagePath,
    });
  },
});

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const exportAuditLogs = internalAction({
  args: {
    mockMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const orgs = await ctx.runQuery(internal.auditLog.listOrgsWithStaleEvents, {});
    const exportEnd = Date.now() - THIRTY_DAYS_MS;

    for (const orgId of orgs) {
      await ctx.runAction(internal.coldStorage.exportAuditLogsForOrg, {
        orgId,
        exportEnd,
        mockStoragePath: args.mockMode
          ? `mock/${orgId}/logs.ndjson.gz`
          : undefined,
      });
    }
  },
});
