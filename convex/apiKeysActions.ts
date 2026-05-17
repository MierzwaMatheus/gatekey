"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const PUBLIC_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function generatePublicId(): string {
  const crypto = require("crypto") as typeof import("crypto");
  let result = "";
  const bytes = crypto.randomBytes(24);
  for (let i = 0; i < 24; i++) {
    result += PUBLIC_ID_CHARS[bytes[i] % PUBLIC_ID_CHARS.length];
  }
  return `gk_live_pk_${result}`;
}

function generateSecret(): string {
  const crypto = require("crypto") as typeof import("crypto");
  return crypto.randomBytes(32).toString("hex");
}

export const createApiKey = internalAction({
  args: {
    callerId: v.id("users"),
    orgId: v.optional(v.id("orgs")),
    scopes: v.array(v.string()),
    description: v.string(),
    ip: v.optional(v.string()),
  },
  returns: v.object({
    publicId: v.string(),
    secret: v.string(),
    keyId: v.string(),
    scopes: v.array(v.string()),
    description: v.string(),
  }),
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.apiKeys._assertOrgAdminOrRoot, {
      callerId: args.callerId,
      orgId: args.orgId,
    });

    const { count, quota } = (await ctx.runQuery(internal.apiKeys._countActiveKeys, {
      orgId: args.orgId,
    })) as { count: number; quota: number };

    if (count >= quota) {
      throw new Error(`quota_exceeded: api_keys_per_org, limit=${quota}, current=${count}`);
    }

    const publicId = generatePublicId();
    const secret = generateSecret();

    const bcrypt = await import("bcryptjs");
    const secretHash = await bcrypt.hash(secret, 10);

    const keyId: Id<"api_keys"> = await ctx.runMutation(internal.apiKeys._insertApiKey, {
      orgId: args.orgId as never,
      publicId,
      secretHash,
      scopes: args.scopes,
      description: args.description,
    });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.callerId,
      action: "api_key.create",
      target: { type: "api_key", id: keyId },
      orgId: args.orgId,
      ip: args.ip,
      result: "allow",
    });

    return {
      publicId,
      secret,
      keyId,
      scopes: args.scopes,
      description: args.description,
    };
  },
});
