"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export const loginWithPassword = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    ip: v.optional(v.string()),
    deviceInfo: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      accessToken: v.string(),
      refreshToken: v.string(),
      sessionId: v.string(),
      mustChangePassword: v.boolean(),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
      lockedUntil: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args): Promise<
    | { success: true; accessToken: string; refreshToken: string; sessionId: string; mustChangePassword: boolean }
    | { success: false; error: string; lockedUntil?: number }
  > => {
    const bcrypt = await import("bcryptjs");

    // Verificar rate limiting por IP
    if (args.ip) {
      const allowed = (await ctx.runMutation(internal.authStore.checkAndIncrementRateLimit, {
        ip: args.ip,
        endpoint: "/v1/auth/login",
      })) as boolean;
      if (!allowed) {
        return { success: false as const, error: "rate_limit_exceeded" };
      }
    }

    const user = (await ctx.runQuery(internal.authStore.getUserByEmail, {
      email: args.email,
    })) as {
      _id: string;
      email: string;
      passwordHash: string;
      status: string;
      loginAttempts: number;
      lockedUntil?: number;
      mustChangePassword?: boolean;
    } | null;

    if (!user) {
      return { success: false as const, error: "invalid_credentials" };
    }

    // Verificar se conta está bloqueada
    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      await ctx.runMutation(internal.auditLog.writeAuditEvent, {
        actorType: "user",
        actorId: user._id as string,
        action: "auth.login.blocked",
        target: { type: "session" },
        ip: args.ip,
        result: "deny",
        reason: "account_locked",
      });
      return { success: false as const, error: "account_locked", lockedUntil: user.lockedUntil };
    }

    const passwordValid = await bcrypt.compare(args.password, user.passwordHash);

    if (!passwordValid) {
      const newAttempts = (await ctx.runMutation(internal.authStore.incrementLoginAttempts, {
        userId: user._id as never,
      })) as number;

      if (newAttempts >= LOCK_THRESHOLD) {
        const lockedUntil = Date.now() + LOCK_DURATION_MS;
        await ctx.runMutation(internal.authStore.lockAccount, { userId: user._id as never, lockedUntil });
        await ctx.runMutation(internal.auditLog.writeAuditEvent, {
          actorType: "user",
          actorId: user._id as string,
          action: "auth.login.blocked",
          target: { type: "session" },
          ip: args.ip,
          result: "deny",
          reason: "account_locked",
        });
        return { success: false as const, error: "account_locked", lockedUntil };
      }

      await ctx.runMutation(internal.auditLog.writeAuditEvent, {
        actorType: "user",
        actorId: user._id as string,
        action: "auth.login.failure",
        target: { type: "session" },
        ip: args.ip,
        result: "deny",
        reason: "invalid_credentials",
      });
      return { success: false as const, error: "invalid_credentials" };
    }

    // Login bem-sucedido — zerar tentativas
    await ctx.runMutation(internal.authStore.resetLoginAttempts, { userId: user._id as never });

    // Obter orgId do usuário (primeira org ativa)
    const orgMembership = (await ctx.runQuery(internal.authStore.getFirstActiveOrgForUser, {
      userId: user._id as never,
    })) as { orgId: string } | null;
    const orgId = orgMembership?.orgId;

    // Obter configurações de expiração
    let accessExpirySeconds = 3600;
    if (orgId) {
      const expiry = (await ctx.runQuery(internal.jwtStore.getOrgJwtExpiry, {
        orgId: orgId as never,
      })) as { jwtExpiryAccess: number } | null;
      if (expiry) accessExpirySeconds = expiry.jwtExpiryAccess;
    }

    // Verificar cota sessions_per_user
    if (orgId) {
      const orgSettings = (await ctx.runQuery(internal.jwtStore.getOrgJwtExpiry, {
        orgId: orgId as never,
      })) as { jwtExpiryAccess: number; jwtExpiryRefresh: number } | null;
      const orgSettingsFull = (await ctx.runQuery(internal.authStore.getOrgSettings, {
        orgId: orgId as never,
      })) as { quotas?: Record<string, number> } | null;
      const sessionQuota = orgSettingsFull?.quotas?.["sessions_per_user"] ?? 5;
      const activeSessionCount = (await ctx.runQuery(
        internal.jwtStore.countActiveSessionsForUser,
        { userId: user._id as never },
      )) as number;
      if (activeSessionCount >= sessionQuota) {
        return { success: false as const, error: "quota_exceeded" };
      }
    }

    // Criar sessão com refresh token
    const sessionResult = (await ctx.runAction(internal.jwt.createSessionWithRefreshToken, {
      userId: user._id as never,
      orgId: orgId as never,
      ip: args.ip,
      deviceInfo: args.deviceInfo,
    })) as { sessionId: string; refreshToken: string };
    const { sessionId, refreshToken } = sessionResult;

    // Assinar JWT de acesso
    const accessToken = (await ctx.runAction(internal.jwt.signJwt, {
      sub: user._id as unknown as string,
      orgId: orgId ?? "",
      workspaceIds: [],
      roles: {},
      capabilities: [],
      sessionId: sessionId as unknown as string,
      expiresInSeconds: accessExpirySeconds,
    })) as string;

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: user._id as string,
      action: "auth.login.success",
      target: { type: "session", id: sessionId as string },
      orgId: orgId as never,
      ip: args.ip,
      result: "allow",
    });

    return {
      success: true as const,
      accessToken,
      refreshToken,
      sessionId,
      mustChangePassword: user.mustChangePassword ?? false,
    };
  },
});

export const createUserWithPassword = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(args.password, 10);
    return (await ctx.runMutation(internal.authStore.createUserRecord, {
      email: args.email,
      passwordHash,
    })) as string;
  },
});

export const refreshTokens = internalAction({
  args: {
    sessionId: v.id("sessions"),
    refreshToken: v.string(),
    orgId: v.string(),
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
    const result = (await ctx.runAction(internal.jwt.rotateRefreshToken, {
      sessionId: args.sessionId,
      refreshToken: args.refreshToken,
      orgId: args.orgId as never,
      ip: args.ip,
      deviceInfo: args.deviceInfo,
    })) as
      | { valid: true; newSessionId: string; newRefreshToken: string }
      | { valid: false; error: string };

    if (!result.valid) {
      return { success: false as const, error: result.error };
    }

    const session = (await ctx.runQuery(internal.jwtStore.getSession, {
      sessionId: result.newSessionId as never,
    })) as { userId: string } | null;

    let accessExpirySeconds = 3600;
    const expiry = (await ctx.runQuery(internal.jwtStore.getOrgJwtExpiry, {
      orgId: args.orgId as never,
    })) as { jwtExpiryAccess: number } | null;
    if (expiry) accessExpirySeconds = expiry.jwtExpiryAccess;

    const accessToken = (await ctx.runAction(internal.jwt.signJwt, {
      sub: session?.userId ?? "",
      orgId: args.orgId,
      workspaceIds: [],
      roles: {},
      capabilities: [],
      sessionId: result.newSessionId,
      expiresInSeconds: accessExpirySeconds,
    })) as string;

    return {
      success: true as const,
      accessToken,
      refreshToken: result.newRefreshToken,
      sessionId: result.newSessionId,
    };
  },
});

export const logoutSession = internalAction({
  args: {
    sessionId: v.id("sessions"),
    accessTokenExp: v.number(),
    userId: v.optional(v.string()),
    ip: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const expiresAt = args.accessTokenExp * 1000;
    await ctx.runMutation(internal.jwtStore.blacklistSession, {
      sessionId: args.sessionId,
      expiresAt,
    });

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: args.userId ?? "unknown",
      action: "auth.logout",
      target: { type: "session", id: args.sessionId as string },
      ip: args.ip,
      result: "allow",
    });

    return null;
  },
});

export const resetUserPassword = internalAction({
  args: {
    callerId: v.id("users"),
    userId: v.id("users"),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(args.newPassword, 10);

    await ctx.runMutation(internal.hierarchy.patchUserPasswordHash, {
      callerId: args.callerId,
      userId: args.userId,
      passwordHash,
      clearMustChangePassword: true,
    });

    return null;
  },
});

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

export const createOrgWithBootstrap = internalAction({
  args: {
    callerId: v.id("users"),
    name: v.string(),
    adminEmail: v.string(),
  },
  returns: v.object({
    orgId: v.id("orgs"),
    adminTempPassword: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args): Promise<{ orgId: Id<"orgs">; adminTempPassword: string | null }> => {
    const bcrypt = await import("bcryptjs");
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const result = (await ctx.runMutation(internal.hierarchy.createOrg, {
      callerId: args.callerId,
      name: args.name,
      adminEmail: args.adminEmail,
      adminPasswordHash: passwordHash,
    })) as { orgId: Id<"orgs">; isNewAdmin: boolean };

    return {
      orgId: result.orgId,
      adminTempPassword: result.isNewAdmin ? tempPassword : null,
    };
  },
});

export const createUser = internalAction({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    email: v.string(),
    password: v.string(),
    role: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args): Promise<Id<"users">> => {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(args.password, 10);

    return await ctx.runMutation(internal.hierarchy.createUserForOrg, {
      callerId: args.callerId,
      orgId: args.orgId,
      email: args.email,
      passwordHash,
      role: args.role,
    });
  },
});

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

export const verifyMagicLink = internalAction({
  args: {
    token: v.string(),
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
    const crypto = await import("crypto");
    const tokenHash = crypto.createHash("sha256").update(args.token).digest("hex");

    const tokenRecord = (await ctx.runQuery(internal.authStore.getMagicLinkTokenByHash, {
      tokenHash,
    })) as { _id: string; userId: string; expiresAt: number; usedAt?: number } | null;

    if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt < Date.now()) {
      if (tokenRecord && !tokenRecord.usedAt && tokenRecord.expiresAt < Date.now()) {
        await ctx.runMutation(internal.authStore.consumeMagicLinkToken, {
          tokenId: tokenRecord._id as never,
        });
        await ctx.runMutation(internal.auditLog.writeAuditEvent, {
          actorType: "user",
          actorId: tokenRecord.userId as string,
          action: "auth.magiclink.expired",
          target: { type: "session" },
          ip: args.ip,
          result: "deny",
          reason: "token_expired",
        });
      }
      return { success: false as const, error: "invalid_or_expired" };
    }

    await ctx.runMutation(internal.authStore.consumeMagicLinkToken, {
      tokenId: tokenRecord._id as never,
    });

    const orgMembership = (await ctx.runQuery(internal.authStore.getFirstActiveOrgForUser, {
      userId: tokenRecord.userId as never,
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
      userId: tokenRecord.userId as never,
      orgId: orgId as never,
      ip: args.ip,
      deviceInfo: args.deviceInfo,
    })) as { sessionId: string; refreshToken: string };
    const { sessionId, refreshToken } = sessionResult;

    const accessToken = (await ctx.runAction(internal.jwt.signJwt, {
      sub: tokenRecord.userId as string,
      orgId: orgId ?? "",
      workspaceIds: [],
      roles: {},
      capabilities: [],
      sessionId: sessionId as unknown as string,
      expiresInSeconds: accessExpirySeconds,
    })) as string;

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: tokenRecord.userId as string,
      action: "auth.magiclink.used",
      target: { type: "session", id: sessionId as string },
      orgId: orgId as never,
      ip: args.ip,
      result: "allow",
    });

    return { success: true as const, accessToken, refreshToken, sessionId };
  },
});

export const requestMagicLink = internalAction({
  args: {
    email: v.string(),
    orgId: v.id("orgs"),
    ip: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const crypto = await import("crypto");

    const orgSettings = (await ctx.runQuery(internal.authStore.getOrgSettings, {
      orgId: args.orgId,
    })) as { loginMethods?: string[] } | null;

    if (!orgSettings?.loginMethods?.includes("magic_link")) {
      throw new Error("method_disabled");
    }

    const user = (await ctx.runQuery(internal.authStore.getUserByEmail, {
      email: args.email,
    })) as { _id: string; email: string } | null;

    if (!user) {
      return { ok: true };
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = Date.now() + MAGIC_LINK_TTL_MS;

    await ctx.runMutation(internal.authStore.storeMagicLinkToken, {
      tokenHash,
      userId: user._id as never,
      expiresAt,
    });

    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        const { Resend } = await import("resend");
        const { magicLinkHtml } = await import("./emailTemplates");
        const resend = new Resend(resendApiKey);
        const link = `${args.baseUrl ?? "https://app.gatekey.dev"}/auth/magic-link/verify?token=${rawToken}`;
        const locale = (orgSettings as { defaultLanguage?: string }).defaultLanguage ?? "en";
        const isPtBr = locale === "pt-BR";
        await resend.emails.send({
          from: "GateKey <noreply@gatekey.dev>",
          to: args.email,
          subject: isPtBr ? "Seu link de acesso" : "Your sign-in link",
          html: magicLinkHtml(link, locale),
        });
      }
    } catch {
      // falha de email não interrompe o fluxo
    }

    await ctx.runMutation(internal.auditLog.writeAuditEvent, {
      actorType: "user",
      actorId: user._id as string,
      action: "auth.magiclink.sent",
      target: { type: "session" },
      orgId: args.orgId,
      ip: args.ip,
      result: "allow",
    });

    return { ok: true };
  },
});
