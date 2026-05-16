"use node";

import { internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { type AuthContext, type ApiKeyContext, extractJwtContext } from "./pepUtils";

const API_KEY_PREFIX = "gk_live_pk_";

export type { ApiKeyContext, AuthContext };

/**
 * Valida o formato do header de API Key e retorna { publicId, secret }.
 * Separado para ser testável sem acesso ao banco.
 * Formato esperado: "Bearer gk_live_pk_{publicId}_{secret}"
 */
export function extractApiKeyContextFormat(authHeader: string): {
  publicId: string;
  secret: string;
} {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("missing_bearer");
  }
  const token = authHeader.slice(7);
  if (!token.startsWith(API_KEY_PREFIX)) {
    throw new Error("invalid_api_key_format");
  }
  const rest = token.slice(API_KEY_PREFIX.length);
  const sepIdx = rest.indexOf("_");
  if (sepIdx === -1) {
    throw new Error("invalid_api_key_format");
  }
  return {
    publicId: rest.slice(0, sepIdx),
    secret: rest.slice(sepIdx + 1),
  };
}

export async function extractApiKeyContext(
  authHeader: string,
  ctx: ActionCtx,
): Promise<ApiKeyContext> {
  const { publicId, secret } = extractApiKeyContextFormat(authHeader);

  const argon2 = await import("argon2");

  const key = await ctx.runQuery(internal.pdp.findApiKey, { publicId });
  if (!key || key.status !== "active") {
    throw new Error("api_key_invalid");
  }

  const valid = await argon2.verify(key.secretHash, secret);
  if (!valid) {
    throw new Error("api_key_invalid");
  }

  return {
    orgId: key.orgId as string,
    scopes: key.scopes,
    keyId: key._id as string,
    publicId,
  };
}

export async function resolveAuthContext(
  authHeader: string,
  ctx: ActionCtx,
): Promise<AuthContext> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("missing_bearer");
  }
  const token = authHeader.slice(7);
  if (token.startsWith(API_KEY_PREFIX)) {
    const data = await extractApiKeyContext(authHeader, ctx);
    return { type: "api_key", data };
  }
  const data = extractJwtContext(authHeader);
  return { type: "jwt", data };
}

export const resolveAuth = internalAction({
  args: { authHeader: v.string() },
  returns: v.union(
    v.object({ success: v.literal(true), type: v.union(v.literal("jwt"), v.literal("api_key")) }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, { authHeader }) => {
    try {
      const auth = await resolveAuthContext(authHeader, ctx);
      return { success: true as const, type: auth.type };
    } catch (e) {
      return { success: false as const, error: (e as Error).message };
    }
  },
});

export const verifyApiKey = internalAction({
  args: { authHeader: v.string() },
  returns: v.union(
    v.object({ success: v.literal(true), orgId: v.string(), scopes: v.array(v.string()), keyId: v.string(), publicId: v.string() }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, { authHeader }) => {
    try {
      const context = await extractApiKeyContext(authHeader, ctx);
      return { success: true as const, ...context };
    } catch (e) {
      return { success: false as const, error: (e as Error).message };
    }
  },
});

export function withPep(
  handler: (ctx: ActionCtx, req: Request, auth: AuthContext) => Promise<Response>,
  _options: {
    requiredCapability?: string;
    requiredScope?: string;
    resourceType: string;
    workspaceId?: string;
  },
): (ctx: ActionCtx, req: Request) => Promise<Response> {
  return async (ctx: ActionCtx, req: Request): Promise<Response> => {
    let auth: AuthContext;
    try {
      const authHeader = req.headers.get("Authorization") ?? "";
      auth = await resolveAuthContext(authHeader, ctx);
    } catch {
      return new Response(null, { status: 401 });
    }

    // PDP check will be added in Ciclo 7
    return handler(ctx, req, auth);
  };
}
