"use node";

import { internalAction } from "./_generated/server";
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
