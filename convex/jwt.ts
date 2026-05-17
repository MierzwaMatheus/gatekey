"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  generateKeyPair,
  exportJWK,
  importJWK,
  SignJWT,
  type JWK,
} from "jose";
import { randomBytes } from "node:crypto";
export type { JwtVerifiedPayload } from "./jwtVerify";
import { verifyJwtToken } from "./jwtVerify";

export const initializeKeyPair = internalAction({
  args: {},
  returns: v.object({ kid: v.string(), keyPairId: v.id("key_pairs") }),
  handler: async (ctx) => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const privateKeyJwk = await exportJWK(privateKey);
    const publicKeyJwk = await exportJWK(publicKey);
    const kid = randomBytes(16).toString("hex");
    privateKeyJwk.kid = kid;
    publicKeyJwk.kid = kid;
    const keyPairId: string = await ctx.runMutation(internal.jwtStore.storeKeyPair, {
      kid,
      privateKeyJwk: JSON.stringify(privateKeyJwk),
      publicKeyJwk: JSON.stringify(publicKeyJwk),
      createdAt: Date.now(),
    });
    return { kid, keyPairId: keyPairId as never };
  },
});

export const signJwt = internalAction({
  args: {
    sub: v.string(),
    orgId: v.string(),
    workspaceIds: v.array(v.string()),
    roles: v.record(v.string(), v.string()),
    capabilities: v.array(v.string()),
    sessionId: v.string(),
    expiresInSeconds: v.number(),
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
    return await new SignJWT({
      orgId: args.orgId,
      workspaceIds: args.workspaceIds,
      roles: args.roles,
      capabilities: args.capabilities,
      sessionId: args.sessionId,
    })
      .setProtectedHeader({ alg: "RS256", kid: keyPairRecord.kid })
      .setSubject(args.sub)
      .setIssuedAt(now)
      .setExpirationTime(now + args.expiresInSeconds)
      .sign(privateKey);
  },
});

export const verifyJwt = internalAction({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      payload: v.object({
        sub: v.string(),
        orgId: v.string(),
        sessionId: v.string(),
        workspaceIds: v.array(v.string()),
        roles: v.record(v.string(), v.string()),
        capabilities: v.array(v.string()),
      }),
    }),
    v.object({ valid: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, { token }) => {
    try {
      const activeKeys = (await ctx.runQuery(internal.jwtStore.getAllActivePublicKeys, {})) as Array<{
        publicKeyJwk: string;
      }>;
      const payload = await verifyJwtToken(token, activeKeys);
      return { valid: true as const, payload };
    } catch (e) {
      return { valid: false as const, error: (e as Error).message };
    }
  },
});

export const getJwks = internalAction({
  args: {},
  returns: v.object({ keys: v.array(v.any()) }),
  handler: async (ctx) => {
    const activeKeys = (await ctx.runQuery(internal.jwtStore.getAllActivePublicKeys, {})) as Array<{
      publicKeyJwk: string;
    }>;
    return { keys: activeKeys.map((k) => JSON.parse(k.publicKeyJwk) as JWK) };
  },
});

export const createSessionWithRefreshToken = internalAction({
  args: {
    userId: v.id("users"),
    orgId: v.optional(v.id("orgs")),
    deviceInfo: v.optional(v.string()),
    ip: v.optional(v.string()),
  },
  returns: v.object({
    sessionId: v.id("sessions"),
    refreshToken: v.string(),
  }),
  handler: async (ctx, args) => {
    const bcrypt = await import("bcryptjs");
    const rawToken = randomBytes(32).toString("hex");
    const expiry = args.orgId ? (await ctx.runQuery(internal.jwtStore.getOrgJwtExpiry, {
      orgId: args.orgId,
    })) as { jwtExpiryRefresh: number } | null : null;
    const refreshExpiresAt = Date.now() + (expiry?.jwtExpiryRefresh ?? 30 * 24 * 3600) * 1000;
    const refreshTokenHash: string = await bcrypt.hash(rawToken, 10);
    const sessionId: string = await ctx.runMutation(internal.jwtStore.createSession, {
      userId: args.userId,
      refreshTokenHash,
      expiresAt: refreshExpiresAt,
      deviceInfo: args.deviceInfo,
      ip: args.ip,
    });
    return { sessionId: sessionId as never, refreshToken: rawToken };
  },
});

export const rotateRefreshToken = internalAction({
  args: {
    sessionId: v.id("sessions"),
    refreshToken: v.string(),
    orgId: v.id("orgs"),
    deviceInfo: v.optional(v.string()),
    ip: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      newSessionId: v.id("sessions"),
      newRefreshToken: v.string(),
    }),
    v.object({ valid: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const bcrypt = await import("bcryptjs");
    const session = (await ctx.runQuery(internal.jwtStore.getSession, {
      sessionId: args.sessionId,
    })) as { userId: string; refreshTokenHash: string; expiresAt: number } | null;
    if (!session) return { valid: false as const, error: "session_not_found" };
    if (session.expiresAt <= Date.now()) return { valid: false as const, error: "session_expired" };
    const blacklisted: boolean = await ctx.runQuery(internal.jwtStore.isSessionBlacklisted, {
      sessionId: args.sessionId,
    });
    if (blacklisted) return { valid: false as const, error: "session_revoked" };
    const tokenValid: boolean = await bcrypt.compare(args.refreshToken, session.refreshTokenHash);
    if (!tokenValid) return { valid: false as const, error: "refresh_token_invalid" };

    await ctx.runMutation(internal.jwtStore.blacklistSession, {
      sessionId: args.sessionId,
      expiresAt: session.expiresAt,
    });

    const rawToken = randomBytes(32).toString("hex");
    const expiry = (await ctx.runQuery(internal.jwtStore.getOrgJwtExpiry, {
      orgId: args.orgId,
    })) as { jwtExpiryRefresh: number } | null;
    const refreshExpiresAt = Date.now() + (expiry?.jwtExpiryRefresh ?? 30 * 24 * 3600) * 1000;
    const newRefreshTokenHash: string = await bcrypt.hash(rawToken, 10);
    const newSessionId: string = await ctx.runMutation(internal.jwtStore.createSession, {
      userId: session.userId as never,
      refreshTokenHash: newRefreshTokenHash,
      expiresAt: refreshExpiresAt,
      deviceInfo: args.deviceInfo,
      ip: args.ip,
    });
    return { valid: true as const, newSessionId: newSessionId as never, newRefreshToken: rawToken };
  },
});
