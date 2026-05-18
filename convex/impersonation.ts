// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { SignJWT, importJWK, type JWK } from "jose";
import { verifyJwtToken } from "./jwtVerify";

export const createImpersonationToken = internalAction({
  args: {
    rootUserId: v.string(),
    targetUserId: v.string(),
    expiresInSeconds: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const keyPairRecord = (await ctx.runQuery(internal.jwtStore.getActiveKeyPair, {})) as {
      kid: string;
      privateKeyJwk: string;
    } | null;
    if (!keyPairRecord) throw new Error("no_active_key_pair");
    const privateKeyJwk = JSON.parse(keyPairRecord.privateKeyJwk) as JWK;
    const privateKey = await importJWK(privateKeyJwk, "RS256");
    const now = Math.floor(Date.now() / 1000);
    const ttl = args.expiresInSeconds ?? 3600;
    return await new SignJWT({
      impersonating: args.targetUserId,
      actor: { type: "root_impersonating" },
    })
      .setProtectedHeader({ alg: "RS256", kid: keyPairRecord.kid })
      .setSubject(args.rootUserId)
      .setIssuedAt(now)
      .setExpirationTime(now + ttl)
      .sign(privateKey);
  },
});

export const verifyImpersonationToken = internalAction({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      rootUserId: v.string(),
      targetUserId: v.string(),
    }),
    v.object({ valid: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, { token }) => {
    try {
      const activeKeys = (await ctx.runQuery(internal.jwtStore.getAllActivePublicKeys, {})) as Array<{
        publicKeyJwk: string;
      }>;
      const payload = await verifyJwtToken(token, activeKeys);
      const raw = JSON.parse(
        Buffer.from(token.split(".")[1]!, "base64url").toString("utf-8"),
      ) as Record<string, unknown>;
      const actor = raw["actor"] as Record<string, unknown> | undefined;
      if (actor?.type !== "root_impersonating") {
        return { valid: false as const, error: "not_impersonation_token" };
      }
      const targetUserId = raw["impersonating"] as string | undefined;
      if (!targetUserId) {
        return { valid: false as const, error: "missing_impersonating_claim" };
      }
      return { valid: true as const, rootUserId: payload.sub, targetUserId };
    } catch (e) {
      return { valid: false as const, error: (e as Error).message };
    }
  },
});
