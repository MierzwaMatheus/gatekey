"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const PENDING_SECRET_TTL_MS = 10 * 60 * 1000;
const MFA_TOKEN_TTL_SECONDS = 5 * 60;

// ── Setup ─────────────────────────────────────────────────────────────────────

export const setupMfa = internalAction({
  args: {
    userId: v.id("users"),
    issuer: v.optional(v.string()),
  },
  returns: v.object({ secret: v.string(), qrCodeUrl: v.string() }),
  handler: async (ctx, args): Promise<{ secret: string; qrCodeUrl: string }> => {
    const { TOTP, Secret } = await import("otpauth");

    const secret = new Secret({ size: 20 });
    const base32Secret = secret.base32;

    const totp = new TOTP({
      issuer: args.issuer ?? "GateKey",
      label: "user",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });

    const qrCodeUrl = totp.toString();

    await ctx.runMutation(internal.mfaStore.upsertPendingMfaConfig, {
      userId: args.userId,
      pendingSecret: base32Secret,
      pendingSecretExpiresAt: Date.now() + PENDING_SECRET_TTL_MS,
    });

    return { secret: base32Secret, qrCodeUrl };
  },
});

// ── Verify Setup ─────────────────────────────────────────────────────────────

export const verifyMfaSetup = internalAction({
  args: {
    userId: v.id("users"),
    totpCode: v.string(),
    ip: v.optional(v.string()),
  },
  returns: v.union(
    v.object({ success: v.literal(true), backupCodes: v.array(v.string()) }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args): Promise<
    | { success: true; backupCodes: string[] }
    | { success: false; error: string }
  > => {
    const { TOTP, Secret } = await import("otpauth");

    const config = (await ctx.runQuery(internal.mfaStore.getAnyMfaConfig, {
      userId: args.userId,
    })) as { pendingSecret?: string; pendingSecretExpiresAt?: number } | null;

    if (!config?.pendingSecret) {
      return { success: false as const, error: "no_pending_setup" };
    }

    if (config.pendingSecretExpiresAt && config.pendingSecretExpiresAt < Date.now()) {
      return { success: false as const, error: "setup_expired" };
    }

    const totp = new TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(config.pendingSecret),
    });

    const delta = totp.validate({ token: args.totpCode, window: 1 });
    if (delta === null) {
      return { success: false as const, error: "invalid_code" };
    }

    const backupCodes = generateBackupCodes(10);

    await ctx.runMutation(internal.mfaStore.activateMfaConfig, {
      userId: args.userId,
      secret: config.pendingSecret,
      backupCodes,
    });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.userId as string,
      action: "auth.mfa.setup",
      target: { type: "mfa_config" },
      ip: args.ip,
      result: "allow",
    });

    return { success: true as const, backupCodes };
  },
});

// ── Sign / Verify MFA token ───────────────────────────────────────────────────

export const signMfaToken = internalAction({
  args: { userId: v.id("users") },
  returns: v.string(),
  handler: async (ctx, { userId }): Promise<string> => {
    const { SignJWT } = await import("jose");
    const secret = getMfaHmacSecret();
    const token = await new SignJWT({ purpose: "mfa_challenge" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId as string)
      .setIssuedAt()
      .setExpirationTime(`${MFA_TOKEN_TTL_SECONDS}s`)
      .sign(secret);
    return token;
  },
});

export const verifyMfaTokenAction = internalAction({
  args: { mfaToken: v.string() },
  returns: v.union(
    v.object({ valid: v.literal(true), userId: v.string() }),
    v.object({ valid: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, { mfaToken }): Promise<
    | { valid: true; userId: string }
    | { valid: false; error: string }
  > => {
    try {
      const { jwtVerify } = await import("jose");
      const secret = getMfaHmacSecret();
      const { payload } = await jwtVerify(mfaToken, secret);
      if (payload["purpose"] !== "mfa_challenge" || !payload.sub) {
        return { valid: false as const, error: "invalid_token" };
      }
      return { valid: true as const, userId: payload.sub };
    } catch {
      return { valid: false as const, error: "invalid_or_expired_token" };
    }
  },
});

function getMfaHmacSecret(): Uint8Array {
  const key = process.env.MFA_HMAC_SECRET ?? "gatekey-mfa-default-secret-change-me";
  return new TextEncoder().encode(key);
}

// ── Challenge ─────────────────────────────────────────────────────────────────

export const challengeMfa = internalAction({
  args: {
    mfaToken: v.string(),
    totpCode: v.string(),
    ip: v.optional(v.string()),
    deviceInfo: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      accessToken: v.string(),
      refreshToken: v.string(),
      sessionId: v.string(),
    }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args): Promise<
    | { success: true; accessToken: string; refreshToken: string; sessionId: string }
    | { success: false; error: string }
  > => {
    const tokenResult = (await ctx.runAction(internal.mfa.verifyMfaTokenAction, {
      mfaToken: args.mfaToken,
    })) as { valid: true; userId: string } | { valid: false; error: string };

    if (!tokenResult.valid) {
      return { success: false as const, error: tokenResult.error };
    }

    const userId = tokenResult.userId as Id<"users">;

    const config = (await ctx.runQuery(internal.mfaStore.getActiveMfaConfig, {
      userId,
    })) as { secret: string; backupCodes: string[] } | null;

    if (!config) {
      return { success: false as const, error: "mfa_not_configured" };
    }

    const isBackupCode = !/^\d{6}$/.test(args.totpCode);

    if (isBackupCode) {
      if (!config.backupCodes.includes(args.totpCode)) {
        await ctx.runMutation(internal.auditLog.writeAuditEvent, {
          actorType: "user",
          actorId: userId as string,
          action: "auth.mfa.failure",
          target: { type: "session" },
          ip: args.ip,
          result: "deny",
          reason: "invalid_backup_code",
        });
        return { success: false as const, error: "invalid_code" };
      }

      await ctx.runMutation(internal.mfaStore.invalidateBackupCode, {
        userId,
        code: args.totpCode,
      });

      await ctx.runMutation(internal.auditLog.writeAuditEvent, {
        actorType: "user",
        actorId: userId as string,
        action: "auth.mfa.backup_used",
        target: { type: "session" },
        ip: args.ip,
        result: "allow",
      });
    } else {
      const { TOTP, Secret } = await import("otpauth");
      const totp = new TOTP({
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(config.secret),
      });

      const delta = totp.validate({ token: args.totpCode, window: 1 });
      if (delta === null) {
        await ctx.runMutation(internal.auditLog.writeAuditEvent, {
          actorType: "user",
          actorId: userId as string,
          action: "auth.mfa.failure",
          target: { type: "session" },
          ip: args.ip,
          result: "deny",
          reason: "invalid_totp",
        });
        return { success: false as const, error: "invalid_code" };
      }

      await ctx.runMutation(internal.auditLog.writeAuditEvent, {
        actorType: "user",
        actorId: userId as string,
        action: "auth.mfa.success",
        target: { type: "session" },
        ip: args.ip,
        result: "allow",
      });
    }

    const orgMembership = (await ctx.runQuery(internal.authStore.getFirstActiveOrgForUser, {
      userId,
    })) as { orgId: string } | null;
    const orgId = orgMembership?.orgId;

    let accessExpirySeconds = 3600;
    if (orgId) {
      const expiry = (await ctx.runQuery(internal.jwtStore.getOrgJwtExpiry, {
        orgId: orgId as never,
      })) as { jwtExpiryAccess: number } | null;
      if (expiry) accessExpirySeconds = expiry.jwtExpiryAccess;
    }

    const sessionResult = (await ctx.runAction(internal.jwt.createSessionWithRefreshToken, {
      userId,
      orgId: orgId as never,
      ip: args.ip,
      deviceInfo: args.deviceInfo,
    })) as { sessionId: string; refreshToken: string };

    const accessToken = (await ctx.runAction(internal.jwt.signJwt, {
      sub: userId as string,
      orgId: orgId ?? "",
      workspaceIds: [],
      roles: {},
      capabilities: [],
      sessionId: sessionResult.sessionId as unknown as string,
      expiresInSeconds: accessExpirySeconds,
    })) as string;

    return {
      success: true as const,
      accessToken,
      refreshToken: sessionResult.refreshToken,
      sessionId: sessionResult.sessionId,
    };
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateBackupCodes(count: number): string[] {
  const codes: string[] = [];
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    codes.push(Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join(""));
  }
  return codes;
}
