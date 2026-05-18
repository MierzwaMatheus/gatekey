"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { gzipSync } from "node:zlib";

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
