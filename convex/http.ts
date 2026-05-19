// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { OPENAPI_SPEC } from "./openapi";

const http = httpRouter();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const preflight = httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS }));

function withCors(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

http.route({ path: "/v1/auth/.well-known/jwks", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/auth/login", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/auth/refresh", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/auth/logout", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/auth/magic-link", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/auth/magic-link/verify", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/auth/mfa/setup", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/auth/mfa/verify-setup", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/auth/mfa/challenge", method: "OPTIONS", handler: preflight });

http.route({
  path: "/v1/auth/.well-known/jwks",
  method: "GET",
  handler: httpAction(async (ctx, _req) => {
    const jwks = await ctx.runAction(internal.jwt.getJwks, {});
    return new Response(JSON.stringify(jwks), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
        ...CORS_HEADERS,
      },
    });
  }),
});

http.route({
  path: "/v1/auth/login",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      let body: { email?: string; password?: string };
      try {
        body = await req.json();
      } catch {
        return withCors({ error: "invalid_body" }, 400);
      }
      if (!body.email || !body.password) {
        return withCors({ error: "missing_fields" }, 400);
      }
      const ip = req.headers.get("x-forwarded-for") ?? undefined;
      const result = await ctx.runAction(internal.auth.loginWithPassword, {
        email: body.email,
        password: body.password,
        ip,
      });
      if (!result.success) {
        if (result.error === "mfa_required") {
          return withCors({ mfa_required: true, mfa_token: result.mfaToken });
        }
        if (result.error === "mfa_setup_required") {
          return withCors({ mfa_setup_required: true, mfa_setup_token: result.mfaSetupToken });
        }
        if (result.error === "rate_limit_exceeded") {
          const retryAfterSecs = Math.ceil((result.retryAfterMs ?? 60000) / 1000);
          return new Response(
            JSON.stringify({ error: "RateLimitExceeded", retryAfter: retryAfterSecs }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(retryAfterSecs),
                ...CORS_HEADERS,
              },
            },
          );
        }
        const status = result.error === "account_locked" ? 429
          : result.error === "method_disabled" ? 403
          : 401;
        return withCors({ error: result.error, lockedUntil: result.lockedUntil }, status);
      }
      return withCors({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        sessionId: result.sessionId,
        mustChangePassword: result.mustChangePassword,
      });
    } catch (e) {
      return withCors({ error: "internal_error", detail: (e as Error).message }, 500);
    }
  }),
});

http.route({
  path: "/v1/auth/refresh",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: { sessionId?: string; refreshToken?: string; orgId?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!body.sessionId || !body.refreshToken || !body.orgId) {
      return withCors({ error: "missing_fields" }, 400);
    }
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    const result = await ctx.runAction(internal.auth.refreshTokens, {
      sessionId: body.sessionId as never,
      refreshToken: body.refreshToken,
      orgId: body.orgId,
      ip,
    });
    if (!result.success) {
      if (result.error === "rate_limit_exceeded") {
        return new Response(
          JSON.stringify({ error: "RateLimitExceeded", retryAfter: 60 }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", "Retry-After": "60", ...CORS_HEADERS },
          },
        );
      }
      return withCors({ error: result.error }, 401);
    }
    return withCors({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      sessionId: result.sessionId,
    });
  }),
});

http.route({
  path: "/v1/auth/logout",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return withCors({ error: "missing_token" }, 401);
    }
    const token = authHeader.slice(7);
    const verified = await ctx.runAction(internal.jwt.verifyJwt, { token });
    if (!verified.valid) {
      return withCors({ error: "invalid_token" }, 401);
    }
    // Decodificar exp do payload para passar como TTL da blacklist
    const parts = token.split(".");
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    const exp = payload.exp ?? Math.floor(Date.now() / 1000) + 3600;

    await ctx.runAction(internal.auth.logoutSession, {
      sessionId: verified.payload.sessionId as never,
      accessTokenExp: exp,
      userId: verified.payload.sub,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return withCors({ success: true });
  }),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return withCors(body, status);
}

const API_KEY_PREFIX = "gk_live_pk_";

type CallerContext = {
  callerId: string;
  orgId: string;
  impersonation?: { rootUserId: string };
};

async function resolveJwtCaller(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  req: Request,
  requiredScope?: string,
): Promise<CallerContext | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "missing_token" }, 401);
  }
  const token = authHeader.slice(7);

  if (token.startsWith(API_KEY_PREFIX)) {
    const result = await ctx.runAction(internal.pep.verifyApiKey, { authHeader });
    if (!result.success) {
      return jsonResponse({ error: "invalid_api_key" }, 401);
    }
    if (requiredScope && !result.scopes.includes(requiredScope)) {
      return jsonResponse({ error: "forbidden", reason: "scope_missing" }, 403);
    }
    return { callerId: result.orgId, orgId: result.orgId };
  }

  // Check if this is an impersonation token before full JWT verification
  let rawPayload: Record<string, unknown> | null = null;
  try {
    rawPayload = JSON.parse(
      Buffer.from(token.split(".")[1]!, "base64url").toString("utf-8"),
    ) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "invalid_token" }, 401);
  }
  const actor = rawPayload["actor"] as Record<string, unknown> | undefined;
  if (actor?.type === "root_impersonating") {
    const result = await ctx.runAction(internal.impersonation.verifyImpersonationToken, { token });
    if (!result.valid) {
      return jsonResponse({ error: "invalid_token" }, 401);
    }
    const targetOrgId = (rawPayload["impersonatingOrgId"] as string | undefined) ?? "";
    return {
      callerId: result.targetUserId,
      orgId: targetOrgId,
      impersonation: { rootUserId: result.rootUserId },
    };
  }

  const verified = await ctx.runAction(internal.jwt.verifyJwt, { token });
  if (!verified.valid) {
    return jsonResponse({ error: "invalid_token" }, 401);
  }
  const sessionId = verified.payload.sessionId;
  if (sessionId) {
    const blacklisted = await ctx.runQuery(internal.jwtStore.isSessionBlacklisted, {
      sessionId: sessionId as never,
    });
    if (blacklisted) {
      return jsonResponse({ error: "session_revoked" }, 401);
    }
  }
  return {
    callerId: verified.payload.sub as string,
    orgId: verified.payload.orgId as string,
  };
}

function isResponse(v: unknown): v is Response {
  return v instanceof Response;
}

// ── GET /v1/orgs ─────────────────────────────────────────────────────────────

http.route({
  path: "/v1/orgs",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    try {
      const orgs = await ctx.runQuery(internal.hierarchy.listOrgs, {
        callerId: caller.callerId as never,
      });
      return jsonResponse(orgs);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/orgs ────────────────────────────────────────────────────────────

http.route({
  path: "/v1/orgs",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    let body: { name?: string; adminEmail?: string } = {};
    try { body = await req.json(); } catch { /* empty body */ }
    if (!body.name || !body.adminEmail) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }
    try {
      const result = await ctx.runAction(internal.auth.createOrgWithBootstrap, {
        callerId: caller.callerId as never,
        name: body.name,
        adminEmail: body.adminEmail,
      });
      return jsonResponse({ orgId: result.orgId, adminTempPassword: result.adminTempPassword });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/orgs/:id/suspend ─────────────────────────────────────────────────

http.route({
  pathPrefix: "/v1/orgs/",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/v1\/orgs\//, "").split("/");
    const orgId = parts[0];
    const action = parts[1];
    if (!orgId) return jsonResponse({ error: "missing_org_id" }, 400);
    try {
      if (action === "suspend") {
        await ctx.runMutation(internal.hierarchy.suspendOrg, {
          callerId: caller.callerId as never,
          orgId: orgId as never,
        });
      } else {
        return jsonResponse({ error: "unknown_action" }, 404);
      }
      return jsonResponse({ success: true });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── DELETE /v1/orgs/:id ───────────────────────────────────────────────────────

http.route({
  pathPrefix: "/v1/orgs/",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    const url = new URL(req.url);
    const orgId = url.pathname.replace(/^\/v1\/orgs\//, "").split("/")[0];
    if (!orgId) return jsonResponse({ error: "missing_org_id" }, 400);
    try {
      await ctx.runMutation(internal.hierarchy.deleteOrg, {
        callerId: caller.callerId as never,
        orgId: orgId as never,
      });
      return jsonResponse({ success: true });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── GET /v1/orgs/:id/settings ────────────────────────────────────────────────

http.route({
  pathPrefix: "/v1/orgs/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/v1\/orgs\//, "").split("/");
    const orgId = parts[0];
    const sub = parts[1];
    if (!orgId) return jsonResponse({ error: "missing_org_id" }, 400);
    try {
      if (sub === "settings") {
        const settings = await ctx.runQuery(internal.hierarchy.getOrgSettings, {
          callerId: caller.callerId as never,
          orgId: orgId as never,
        });
        return jsonResponse(settings);
      }
      return jsonResponse({ error: "not_found" }, 404);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── PATCH /v1/orgs/:id/settings ──────────────────────────────────────────────

http.route({
  pathPrefix: "/v1/orgs/",
  method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/v1\/orgs\//, "").split("/");
    const orgId = parts[0];
    const sub = parts[1];
    if (!orgId) return jsonResponse({ error: "missing_org_id" }, 400);
    let body: {
      quotas?: Record<string, number>;
      loginMethods?: string[];
      mfaRequired?: boolean;
      jwtExpiryAccess?: number;
      jwtExpiryRefresh?: number;
      rateLimits?: { checkPerMin?: number; checkBatchPerMin?: number };
    } = {};
    try { body = await req.json(); } catch { /* empty */ }
    try {
      if (sub === "settings") {
        await ctx.runMutation(internal.hierarchy.updateOrgSettings, {
          callerId: caller.callerId as never,
          orgId: orgId as never,
          quotas: body.quotas,
          loginMethods: body.loginMethods,
          mfaRequired: body.mfaRequired,
          jwtExpiryAccess: body.jwtExpiryAccess,
          jwtExpiryRefresh: body.jwtExpiryRefresh,
          rateLimits: body.rateLimits,
        });
        return jsonResponse({ success: true });
      }
      return jsonResponse({ error: "not_found" }, 404);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/users ───────────────────────────────────────────────────────────

http.route({
  path: "/v1/users",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req, "users:write");
    if (isResponse(caller)) return caller;

    let body: { email?: string; password?: string; role?: string; orgId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_body" }, 400);
    }
    if (!body.email || !body.password || !body.role) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }

    const orgId = (body.orgId ?? caller.orgId) as never;

    try {
      const result = await ctx.runAction(internal.usersActions.createUserWithPassword, {
        callerId: caller.callerId,
        orgId,
        email: body.email,
        password: body.password,
        role: body.role,
      });
      return jsonResponse(result, 201);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("quota_exceeded")) {
        const match = msg.match(/limit=(\d+), current=(\d+)/);
        return jsonResponse(
          {
            error: "QuotaExceeded",
            message: "Org has reached the maximum number of users.",
            quota: "users_per_org",
            limit: match ? Number(match[1]) : null,
            current: match ? Number(match[2]) : null,
          },
          429,
        );
      }
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── GET /v1/users/:id ───────────────────────────────────────────────────────

http.route({
  pathPrefix: "/v1/users/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    const url = new URL(req.url);
    const segments = url.pathname.replace(/^\/v1\/users\//, "").split("/");
    const userId = segments[0];
    const isPermissions = segments[1] === "permissions";
    const isEffectiveAccess = segments[1] === "effective-access";

    if (!userId) return jsonResponse({ error: "missing_user_id" }, 400);

    try {
      if (isEffectiveAccess) {
        const workspaceId = url.searchParams.get("workspaceId");
        if (!workspaceId) return jsonResponse({ error: "missing_workspace_id" }, 400);

        const result = await ctx.runQuery(internal.effectiveAccess.computeEffectiveAccess, {
          callerId: caller.callerId as never,
          userId: userId as never,
          workspaceId: workspaceId as never,
          orgId: caller.orgId as never,
        });
        return jsonResponse(result);
      }

      if (isPermissions) {
        const permissions = await ctx.runQuery(internal.users.getUserPermissions, {
          callerId: caller.callerId as never,
          userId: userId as never,
          orgId: caller.orgId as never,
        });
        return jsonResponse({ permissions });
      }

      const user = await ctx.runQuery(internal.users.getUserById, {
        callerId: caller.callerId as never,
        userId: userId as never,
        orgId: caller.orgId as never,
      });
      if (!user) return jsonResponse({ error: "not_found" }, 404);
      return jsonResponse(user);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── PATCH /v1/users/:id ─────────────────────────────────────────────────────

http.route({
  pathPrefix: "/v1/users/",
  method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    const url = new URL(req.url);
    const userId = url.pathname.replace(/^\/v1\/users\//, "").split("/")[0];
    if (!userId) return jsonResponse({ error: "missing_user_id" }, 400);

    let body: { email?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_body" }, 400);
    }

    try {
      if (body.password) {
        await ctx.runAction(internal.usersActions.updateUserPassword, {
          callerId: caller.callerId,
          userId,
          orgId: caller.orgId,
          password: body.password,
        });
      } else if (body.email) {
        await ctx.runMutation(internal.users.updateUser, {
          callerId: caller.callerId as never,
          userId: userId as never,
          orgId: caller.orgId as never,
          email: body.email,
        });
      }
      return jsonResponse({ success: true });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      if (msg.includes("not_in_org")) return jsonResponse({ error: "not_found" }, 404);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── DELETE /v1/users/:id ────────────────────────────────────────────────────

http.route({
  pathPrefix: "/v1/users/",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    const url = new URL(req.url);
    const userId = url.pathname.replace(/^\/v1\/users\//, "").split("/")[0];
    if (!userId) return jsonResponse({ error: "missing_user_id" }, 400);

    try {
      await ctx.runMutation(internal.users.deleteUser, {
        callerId: caller.callerId as never,
        userId: userId as never,
        orgId: caller.orgId as never,
      });
      return jsonResponse({ success: true });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      if (msg.includes("not_in_org")) return jsonResponse({ error: "not_found" }, 404);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/roles ────────────────────────────────────────────────────────────

http.route({
  path: "/v1/roles",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    let body: { name?: string; workspaceId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_body" }, 400);
    }
    if (!body.name || !body.workspaceId) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }

    try {
      const result = await ctx.runMutation(internal.roles.createRole, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
        workspaceId: body.workspaceId as never,
        name: body.name,
      });
      return jsonResponse(result, 201);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("quota_exceeded")) {
        const match = msg.match(/limit=(\d+), current=(\d+)/);
        return jsonResponse(
          {
            error: "QuotaExceeded",
            message: "Workspace has reached the maximum number of roles.",
            quota: "roles_per_workspace",
            limit: match ? Number(match[1]) : null,
            current: match ? Number(match[2]) : null,
          },
          429,
        );
      }
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── GET /v1/roles ─────────────────────────────────────────────────────────────

http.route({
  path: "/v1/roles",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return jsonResponse({ error: "missing_workspace_id" }, 400);

    try {
      const roles = await ctx.runQuery(internal.roles.listRoles, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
        workspaceId: workspaceId as never,
      });
      return jsonResponse({ roles });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── DELETE /v1/roles/:id ──────────────────────────────────────────────────────

http.route({
  pathPrefix: "/v1/roles/",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    const url = new URL(req.url);
    const roleId = url.pathname.replace(/^\/v1\/roles\//, "").split("/")[0];
    if (!roleId) return jsonResponse({ error: "missing_role_id" }, 400);

    try {
      await ctx.runMutation(internal.roles.deleteRole, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
        roleId: roleId as never,
      });
      return jsonResponse({ success: true });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("role_has_active_bindings")) {
        return jsonResponse(
          { error: "RoleHasActiveBindings", message: "Role cannot be deleted while active bindings exist." },
          409,
        );
      }
      if (msg.includes("not_found")) return jsonResponse({ error: "not_found" }, 404);
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── GET /v1/capabilities ──────────────────────────────────────────────────────

http.route({
  path: "/v1/capabilities",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    try {
      const capabilities = await ctx.runQuery(internal.roles.listCapabilities, {
        callerId: caller.callerId as never,
        orgId: (caller.orgId || undefined) as never,
      });
      return jsonResponse({ capabilities });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/capabilities ─────────────────────────────────────────────────────

http.route({
  path: "/v1/capabilities",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    let body: { name?: string; description?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_body" }, 400);
    }
    if (!body.name || !body.description) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }

    try {
      const result = await ctx.runMutation(internal.roles.createCapability, {
        callerId: caller.callerId as never,
        orgId: (caller.orgId || undefined) as never,
        name: body.name,
        description: body.description,
      });
      return jsonResponse(result, 201);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("quota_exceeded")) {
        const match = msg.match(/limit=(\d+), current=(\d+)/);
        return jsonResponse(
          {
            error: "QuotaExceeded",
            message: "Org has reached the maximum number of capabilities.",
            quota: "capabilities_per_org",
            limit: match ? Number(match[1]) : null,
            current: match ? Number(match[2]) : null,
          },
          429,
        );
      }
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/bindings ─────────────────────────────────────────────────────────

http.route({
  path: "/v1/bindings",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req, "bindings:write");
    if (isResponse(caller)) return caller;

    let body: {
      userId?: string;
      roleId?: string;
      resourceType?: string;
      resourceId?: string;
      parentResourceId?: string;
      workspaceId?: string;
    };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_body" }, 400);
    }
    if (!body.userId || !body.roleId || !body.resourceType || !body.workspaceId) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }

    try {
      const result = await ctx.runMutation(internal.bindings.createBinding, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
        workspaceId: body.workspaceId as never,
        userId: body.userId as never,
        roleId: body.roleId as never,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        parentResourceId: body.parentResourceId,
      });
      return jsonResponse(result, 201);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("invalid_role_workspace")) {
        return jsonResponse({ error: "InvalidRoleWorkspace", message: "Role does not belong to the specified workspace." }, 422);
      }
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      if (msg.includes("not_found")) return jsonResponse({ error: "not_found" }, 404);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── GET /v1/bindings ──────────────────────────────────────────────────────────

http.route({
  path: "/v1/bindings",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return jsonResponse({ error: "missing_workspace_id" }, 400);

    const userId = url.searchParams.get("userId") ?? undefined;
    const resourceType = url.searchParams.get("resourceType") ?? undefined;

    try {
      const bindings = await ctx.runQuery(internal.bindings.listBindings, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
        workspaceId: workspaceId as never,
        userId: userId as never,
        resourceType,
      });
      return jsonResponse({ bindings });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/bindings/simulate ────────────────────────────────────────────────

http.route({ path: "/v1/bindings/simulate", method: "OPTIONS", handler: preflight });

http.route({
  path: "/v1/bindings/simulate",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req, "bindings:write");
    if (isResponse(caller)) return caller;

    let body: {
      userId?: string;
      roleId?: string;
      resourceType?: string;
      resourceId?: string;
      parentResourceId?: string;
      workspaceId?: string;
      type?: string;
    };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_body" }, 400);
    }
    if (!body.userId || !body.roleId || !body.resourceType || !body.workspaceId) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }

    try {
      const result = await ctx.runAction(internal.bindingsSimulate.simulateBinding, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
        workspaceId: body.workspaceId as never,
        userId: body.userId as never,
        roleId: body.roleId as never,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        parentResourceId: body.parentResourceId,
        type: body.type as "allow" | "deny" | undefined,
      });
      return jsonResponse(result);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("no_privilege_escalation")) {
        return jsonResponse({ error: "forbidden: no_privilege_escalation", reason: "cannot_grant_capability" }, 403);
      }
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── DELETE /v1/bindings/:id ───────────────────────────────────────────────────

http.route({
  pathPrefix: "/v1/bindings/",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    const url = new URL(req.url);
    const bindingId = url.pathname.replace(/^\/v1\/bindings\//, "").split("/")[0];
    if (!bindingId) return jsonResponse({ error: "missing_binding_id" }, 400);

    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return jsonResponse({ error: "missing_workspace_id" }, 400);

    try {
      await ctx.runMutation(internal.bindings.deleteBinding, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
        workspaceId: workspaceId as never,
        bindingId: bindingId as never,
      });
      return jsonResponse({ success: true });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("not_found")) return jsonResponse({ error: "not_found" }, 404);
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/resource-types ───────────────────────────────────────────────────

http.route({
  path: "/v1/resource-types",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    let body: { name?: string; inheritsFrom?: string; inheritanceMode?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_body" }, 400);
    }
    if (!body.name) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }

    try {
      const id = await ctx.runMutation(internal.resourceTypes.createResourceType, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
        name: body.name,
        inheritsFrom: body.inheritsFrom,
        inheritanceMode: body.inheritanceMode,
      });
      return jsonResponse({ id, name: body.name, inheritsFrom: body.inheritsFrom, inheritanceMode: body.inheritanceMode }, 201);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("invalid_inherits_from")) {
        return jsonResponse({ error: "InvalidInheritsFrom", message: "inheritsFrom references a resource type that does not exist in this org." }, 422);
      }
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── GET /v1/resource-types ────────────────────────────────────────────────────

http.route({
  path: "/v1/resource-types",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    try {
      const resourceTypes = await ctx.runQuery(internal.resourceTypes.listResourceTypes, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
      });
      return jsonResponse({ resourceTypes });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/check ────────────────────────────────────────────────────────────

http.route({
  path: "/v1/check",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    let body: {
      userId?: string;
      capability?: string;
      resourceType?: string;
      resourceId?: string;
      workspaceId?: string;
    };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_body" }, 400);
    }
    if (!body.userId || !body.capability || !body.resourceType || !body.workspaceId) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }

    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const rl = await ctx.runMutation(internal.rateLimit.checkOrgRateLimit, {
      orgId: caller.orgId as never,
      endpoint: "check",
      defaultLimit: 100,
      windowMs: 60 * 1000,
    });
    if (!rl.allowed) {
      const retryAfterSecs = Math.ceil(rl.retryAfterMs / 1000);
      return new Response(
        JSON.stringify({ error: "RateLimitExceeded", retryAfter: retryAfterSecs }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterSecs), ...CORS_HEADERS },
        },
      );
    }

    try {
      const result = await ctx.runAction(internal.check.performCheck, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
        userId: body.userId as never,
        capability: body.capability,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        workspaceId: body.workspaceId as never,
        ip,
        userAgent,
      });
      return jsonResponse(result);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/check/batch ──────────────────────────────────────────────────────

http.route({ path: "/v1/check/batch", method: "OPTIONS", handler: preflight });

http.route({
  path: "/v1/check/batch",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req, "check");
    if (isResponse(caller)) return caller;

    let body: { workspaceId?: string; items?: unknown[] };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_body" }, 400);
    }

    if (!body.workspaceId) {
      return jsonResponse({ error: "invalid_body", message: "workspaceId is required" }, 422);
    }
    if (!Array.isArray(body.items)) {
      return jsonResponse({ error: "invalid_body", message: "items must be an array" }, 422);
    }
    if (body.items.length === 0) {
      return jsonResponse({ error: "invalid_body", message: "items array must have at least 1 item" }, 422);
    }
    if (body.items.length > 100) {
      return jsonResponse({ error: "invalid_body", message: "items array must have at most 100 items" }, 422);
    }
    for (const item of body.items) {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof (item as Record<string, unknown>).userId !== "string" ||
        typeof (item as Record<string, unknown>).capability !== "string" ||
        typeof (item as Record<string, unknown>).resourceType !== "string"
      ) {
        return jsonResponse({
          error: "invalid_body",
          message: "Each item must have userId, capability, and resourceType",
        }, 422);
      }
    }

    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const rlBatch = await ctx.runMutation(internal.rateLimit.checkOrgRateLimit, {
      orgId: caller.orgId as never,
      endpoint: "checkBatch",
      defaultLimit: 20,
      windowMs: 60 * 1000,
    });
    if (!rlBatch.allowed) {
      const retryAfterSecs = Math.ceil(rlBatch.retryAfterMs / 1000);
      return new Response(
        JSON.stringify({ error: "RateLimitExceeded", retryAfter: retryAfterSecs }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterSecs), ...CORS_HEADERS },
        },
      );
    }

    try {
      const items = (body.items as Array<{ userId: string; capability: string; resourceType: string; resourceId?: string }>).map(
        (item) => ({
          userId: item.userId as never,
          capability: item.capability,
          resourceType: item.resourceType,
          resourceId: item.resourceId,
        }),
      );

      const results = await ctx.runAction(internal.checkBatch.performCheckBatch, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
        workspaceId: body.workspaceId as never,
        items,
        ip,
        userAgent,
      });
      return jsonResponse(results);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: msg }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

http.route({
  path: "/v1/sessions",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    const url = new URL(req.url);
    const userIdFilter = url.searchParams.get("userId") ?? undefined;

    const sessions = await ctx.runQuery(internal.sessions.listSessions, {
      orgId: (caller.orgId || undefined) as never,
      callerId: caller.callerId as never,
      userId: userIdFilter as never,
    });
    return jsonResponse(sessions);
  }),
});

http.route({
  pathPrefix: "/v1/sessions/",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    const url = new URL(req.url);
    const sessionId = url.pathname.replace(/^\/v1\/sessions\//, "").split("/")[0];
    if (!sessionId) return jsonResponse({ error: "missing_session_id" }, 400);

    const ip = req.headers.get("x-forwarded-for") ?? undefined;

    try {
      await ctx.runAction(internal.sessions.revokeSession, {
        sessionId: sessionId as never,
        callerId: caller.callerId as never,
        orgId: (caller.orgId || undefined) as never,
        ip,
      });
      return jsonResponse({ success: true });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("session_not_found")) return jsonResponse({ error: "not_found" }, 404);
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/api-keys ────────────────────────────────────────────────────────

http.route({
  path: "/v1/api-keys",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    let body: { scopes?: string[]; description?: string } = {};
    try {
      body = await req.json();
    } catch {
      // body permanece vazio, defaults serão usados
    }

    const ip = req.headers.get("x-forwarded-for") ?? undefined;

    try {
      const result = await ctx.runAction(internal.apiKeysActions.createApiKey, {
        callerId: caller.callerId as never,
        orgId: (caller.orgId || undefined) as never,
        scopes: body.scopes ?? [],
        description: body.description ?? "",
        ip,
      });
      return jsonResponse(result, 201);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("quota_exceeded")) {
        return jsonResponse({ error: "QuotaExceeded", quota: "api_keys_per_org" }, 429);
      }
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── GET /v1/api-keys ─────────────────────────────────────────────────────────

http.route({
  path: "/v1/api-keys",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    try {
      const keys = await ctx.runQuery(internal.apiKeys.listApiKeys, {
        callerId: caller.callerId as never,
        orgId: (caller.orgId || undefined) as never,
      });
      return jsonResponse(keys);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── DELETE /v1/api-keys/:id ──────────────────────────────────────────────────

http.route({
  path: "/v1/api-keys/",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    const url = new URL(req.url);
    const keyId = url.pathname.replace(/^\/v1\/api-keys\//, "").split("/")[0];
    if (!keyId) return jsonResponse({ error: "missing_key_id" }, 400);

    const ip = req.headers.get("x-forwarded-for") ?? undefined;

    try {
      await ctx.runMutation(internal.apiKeys.revokeApiKey, {
        callerId: caller.callerId as never,
        orgId: (caller.orgId || undefined) as never,
        keyId: keyId as never,
        ip,
      });
      return jsonResponse({ success: true });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("not_found")) return jsonResponse({ error: "not_found" }, 404);
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── GET /v1/workspaces ───────────────────────────────────────────────────────

http.route({
  path: "/v1/workspaces",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    if (!caller.orgId) return jsonResponse({ error: "missing_org_id" }, 400);
    try {
      const workspaces = await ctx.runQuery(internal.hierarchy.listWorkspaces, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
      });
      return jsonResponse(workspaces);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/workspaces ──────────────────────────────────────────────────────

http.route({
  path: "/v1/workspaces",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    if (!caller.orgId) return jsonResponse({ error: "missing_org_id" }, 400);
    let body: { name?: string } = {};
    try { body = await req.json(); } catch { /* empty */ }
    if (!body.name) return jsonResponse({ error: "missing_name" }, 400);
    try {
      const wsId = await ctx.runMutation(internal.hierarchy.createWorkspace, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
        name: body.name,
      });
      return jsonResponse({ workspaceId: wsId }, 201);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("quota_exceeded")) return jsonResponse({ error: "QuotaExceeded", quota: "workspaces_per_org" }, 429);
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── GET /v1/users (list) ─────────────────────────────────────────────────────

http.route({
  path: "/v1/users",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    if (!caller.orgId) return jsonResponse({ error: "missing_org_id" }, 400);
    try {
      const users = await ctx.runQuery(internal.hierarchy.listUsersForOrg, {
        callerId: caller.callerId as never,
        orgId: caller.orgId as never,
      });
      return jsonResponse(users);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── GET /v1/workspaces/:wsId/members ────────────────────────────────────────

http.route({
  pathPrefix: "/v1/workspaces/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    // /v1/workspaces/:wsId/members
    if (parts.length < 5 || parts[4] !== "members") {
      return jsonResponse({ error: "not_found" }, 404);
    }
    const wsId = parts[3];
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    try {
      const members = await ctx.runQuery(internal.hierarchy.listWorkspaceMembers, {
        callerId: caller.callerId as never,
        workspaceId: wsId as never,
      });
      return jsonResponse(members);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("not_found")) return jsonResponse({ error: "not_found" }, 404);
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/workspaces/:wsId/members ───────────────────────────────────────

http.route({
  pathPrefix: "/v1/workspaces/",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    if (parts.length < 5 || parts[4] !== "members") {
      return jsonResponse({ error: "not_found" }, 404);
    }
    const wsId = parts[3];
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    let body: { userId?: string; roleId?: string } = {};
    try { body = await req.json(); } catch { /* empty */ }
    if (!body.userId) return jsonResponse({ error: "missing_userId" }, 400);
    try {
      await ctx.runMutation(internal.hierarchy.addWorkspaceMember, {
        callerId: caller.callerId as never,
        workspaceId: wsId as never,
        userId: body.userId as never,
      });
      return jsonResponse({ ok: true }, 201);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("quota_exceeded")) return jsonResponse({ error: "QuotaExceeded", quota: "users_per_workspace" }, 429);
      if (msg.includes("not_found")) return jsonResponse({ error: "not_found" }, 404);
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── DELETE /v1/workspaces/:wsId/members/:userId ──────────────────────────────

http.route({
  pathPrefix: "/v1/workspaces/",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    // /v1/workspaces/:wsId/members/:userId
    if (parts.length < 6 || parts[4] !== "members") {
      return jsonResponse({ error: "not_found" }, 404);
    }
    const wsId = parts[3];
    const userId = parts[5];
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    try {
      await ctx.runMutation(internal.hierarchy.removeWorkspaceMember, {
        callerId: caller.callerId as never,
        workspaceId: wsId as never,
        userId: userId as never,
      });
      return jsonResponse({ ok: true });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("not_found")) return jsonResponse({ error: "not_found" }, 404);
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── PATCH /v1/workspaces/:wsId/members/:userId ───────────────────────────────

http.route({
  pathPrefix: "/v1/workspaces/",
  method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    if (parts.length < 6 || parts[4] !== "members") {
      return jsonResponse({ error: "not_found" }, 404);
    }
    const wsId = parts[3];
    const userId = parts[5];
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    let body: { newRoleId?: string } = {};
    try { body = await req.json(); } catch { /* empty */ }
    if (!body.newRoleId) return jsonResponse({ error: "missing_newRoleId" }, 400);
    try {
      await ctx.runMutation(internal.hierarchy.changeWorkspaceMemberRole, {
        callerId: caller.callerId as never,
        workspaceId: wsId as never,
        userId: userId as never,
        newRoleId: body.newRoleId as never,
      });
      return jsonResponse({ ok: true });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("not_found")) return jsonResponse({ error: "not_found" }, 404);
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── GET /v1/audit-log ────────────────────────────────────────────────────────

http.route({
  path: "/v1/audit-log",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    const url = new URL(req.url);
    const orgIdParam = url.searchParams.get("orgId") ?? caller.orgId;
    const orgId = (orgIdParam || undefined) as never;
    const wsParam = url.searchParams.get("workspaceId");
    const workspaceId = wsParam ? (wsParam as never) : undefined;
    const action = url.searchParams.get("action") ?? undefined;
    const rawResult = url.searchParams.get("result");
    const resultFilter = (rawResult === "allow" || rawResult === "deny") ? rawResult : undefined;
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const from = fromParam ? Number(fromParam) : undefined;
    const to = toParam ? Number(toParam) : undefined;
    const cursor = url.searchParams.get("cursor") ?? null;
    const numItems = Math.min(Number(url.searchParams.get("numItems") ?? "50"), 200);

    try {
      const result = await ctx.runQuery(internal.auditLog.listAuditLog, {
        callerId: caller.callerId as never,
        orgId,
        workspaceId,
        action,
        result: resultFilter,
        from,
        to,
        paginationOpts: { numItems, cursor },
      });
      return jsonResponse({ logs: result.page, isDone: result.isDone, cursor: result.continueCursor });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/impersonation/start ─────────────────────────────────────────────

http.route({
  path: "/v1/impersonation/start",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    let body: { targetUserId?: string } = {};
    try { body = await req.json(); } catch { /* empty body */ }
    if (!body.targetUserId) {
      return jsonResponse({ error: "missing_targetUserId" }, 400);
    }
    try {
      const callerUser = await ctx.runQuery(internal.users.getUserById, {
        callerId: caller.callerId as never,
        userId: caller.callerId as never,
        orgId: caller.orgId as never,
      });
      const isRoot = (callerUser as { isRoot?: boolean } | null)?.isRoot === true;
      if (!isRoot) {
        return jsonResponse({ error: "forbidden", reason: "root_required" }, 403);
      }
      const token = await ctx.runAction(internal.impersonation.createImpersonationToken, {
        rootUserId: caller.callerId,
        targetUserId: body.targetUserId,
        targetOrgId: caller.orgId,
      });
      const expiresAt = Date.now() + 3600 * 1000;
      return jsonResponse({ impersonationToken: token, expiresAt });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── POST /v1/impersonation/end ───────────────────────────────────────────────

http.route({
  path: "/v1/impersonation/end",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    let body: { impersonationSessionId?: string } = {};
    try { body = await req.json(); } catch { /* empty body */ }
    if (!body.impersonationSessionId) {
      return jsonResponse({ error: "missing_impersonationSessionId" }, 400);
    }
    try {
      const callerUser = await ctx.runQuery(internal.users.getUserById, {
        callerId: caller.callerId as never,
        userId: caller.callerId as never,
        orgId: caller.orgId as never,
      });
      const isRoot = (callerUser as { isRoot?: boolean } | null)?.isRoot === true;
      if (!isRoot) {
        return jsonResponse({ error: "forbidden", reason: "root_required" }, 403);
      }
      await ctx.runMutation(internal.impersonationStore.endImpersonationSession, {
        impersonationSessionId: body.impersonationSessionId as never,
      });
      return jsonResponse({ ended: true });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("forbidden")) return jsonResponse({ error: "forbidden" }, 403);
      if (msg.includes("not_found") || msg.includes("session_not_found"))
        return jsonResponse({ error: "not_found" }, 404);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// Preflight OPTIONS — rotas com path fixo
http.route({ path: "/v1/orgs", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/orgs/", method: "OPTIONS", handler: preflight });
http.route({ pathPrefix: "/v1/orgs/", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/users", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/roles", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/capabilities", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/bindings", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/resource-types", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/check", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/sessions", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/api-keys", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/audit-log", method: "OPTIONS", handler: preflight });
// Preflight OPTIONS — rotas com pathPrefix
http.route({ pathPrefix: "/v1/users/", method: "OPTIONS", handler: preflight });
http.route({ pathPrefix: "/v1/roles/", method: "OPTIONS", handler: preflight });
http.route({ pathPrefix: "/v1/bindings/", method: "OPTIONS", handler: preflight });
http.route({ pathPrefix: "/v1/sessions/", method: "OPTIONS", handler: preflight });
http.route({ pathPrefix: "/v1/api-keys/", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/workspaces", method: "OPTIONS", handler: preflight });
http.route({ pathPrefix: "/v1/workspaces/", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/impersonation/start", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/impersonation/end", method: "OPTIONS", handler: preflight });

http.route({
  path: "/v1/auth/magic-link",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      let body: { email?: string; orgId?: string };
      try {
        body = await req.json();
      } catch {
        return withCors({ error: "invalid_body" }, 400);
      }
      if (!body.email || !body.orgId) {
        return withCors({ error: "missing_fields" }, 400);
      }
      const ip = req.headers.get("x-forwarded-for") ?? undefined;
      const origin = req.headers.get("origin") ?? undefined;
      await ctx.runAction(internal.auth.requestMagicLink, {
        email: body.email,
        orgId: body.orgId,
        ip,
        baseUrl: origin,
      });
      return withCors({ ok: true });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("method_disabled")) return withCors({ error: "method_disabled" }, 403);
      return withCors({ error: "internal_error" }, 500);
    }
  }),
});

http.route({
  path: "/v1/auth/magic-link/verify",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) {
        return withCors({ error: "missing_token" }, 400);
      }
      const ip = req.headers.get("x-forwarded-for") ?? undefined;
      const result = await ctx.runAction(internal.auth.verifyMagicLink, { token, ip });
      if (!result.success) {
        if (result.error === "mfa_required") {
          return withCors({ mfa_required: true, mfa_token: result.mfaToken });
        }
        if (result.error === "mfa_setup_required") {
          return withCors({ mfa_setup_required: true, mfa_setup_token: result.mfaSetupToken });
        }
        const status = result.error === "method_disabled" ? 403 : 401;
        return withCors({ error: result.error }, status);
      }
      return withCors({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        sessionId: result.sessionId,
      });
    } catch (e) {
      return withCors({ error: "internal_error", detail: (e as Error).message }, 500);
    }
  }),
});

// ── MFA endpoints ─────────────────────────────────────────────────────────────

async function resolveMfaUserId(
  ctx: { runAction: (fn: unknown, args: unknown) => Promise<unknown> },
  authHeader: string | null,
): Promise<string | null> {
  if (!authHeader) return null;

  if (authHeader.startsWith("MfaSetup ")) {
    const token = authHeader.slice("MfaSetup ".length);
    const result = (await ctx.runAction(internal.mfa.verifyMfaSetupTokenAction, {
      mfaSetupToken: token,
    })) as { valid: boolean; userId?: string };
    return result.valid ? (result.userId ?? null) : null;
  }

  if (authHeader.startsWith("Bearer ")) {
    const { jwtVerify, importSPKI } = await import("jose");
    const jwks = (await ctx.runAction(internal.jwt.getJwks, {})) as { keys: { n: string; e: string; kty: string; alg: string }[] };
    const keyData = jwks.keys[0];
    if (!keyData) return null;
    const spki = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(
      JSON.stringify({ kty: keyData.kty, n: keyData.n, e: keyData.e }),
    ).toString("base64")}\n-----END PUBLIC KEY-----`;
    try {
      const publicKey = await importSPKI(spki, "RS256").catch(() => null);
      if (!publicKey) return null;
      const v = await jwtVerify(authHeader.slice(7), publicKey);
      return (v.payload as { sub?: string }).sub ?? null;
    } catch {
      return null;
    }
  }

  return null;
}

http.route({
  path: "/v1/auth/mfa/setup",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const authHeader = req.headers.get("Authorization");
      const userId = await resolveMfaUserId(ctx as never, authHeader);
      if (!userId) return withCors({ error: "unauthorized" }, 401);
      const result = await ctx.runAction(internal.mfa.setupMfa, {
        userId: userId as never,
        issuer: "GateKey",
      });
      return withCors(result);
    } catch (e) {
      return withCors({ error: "internal_error", detail: (e as Error).message }, 500);
    }
  }),
});

http.route({
  path: "/v1/auth/mfa/verify-setup",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const authHeader = req.headers.get("Authorization");
      const userId = await resolveMfaUserId(ctx as never, authHeader);
      if (!userId) return withCors({ error: "unauthorized" }, 401);

      let body: { totpCode?: string };
      try { body = await req.json(); } catch { return withCors({ error: "invalid_body" }, 400); }
      if (!body.totpCode) return withCors({ error: "missing_fields" }, 400);

      const ip = req.headers.get("x-forwarded-for") ?? undefined;
      const result = await ctx.runAction(internal.mfa.verifyMfaSetup, {
        userId: userId as never,
        totpCode: body.totpCode,
        ip,
      });
      if (!result.success) return withCors({ error: result.error }, 400);
      return withCors(result);
    } catch (e) {
      return withCors({ error: "internal_error", detail: (e as Error).message }, 500);
    }
  }),
});

http.route({
  path: "/v1/auth/mfa/challenge",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      let body: { mfaToken?: string; totpCode?: string };
      try { body = await req.json(); } catch { return withCors({ error: "invalid_body" }, 400); }
      if (!body.mfaToken || !body.totpCode) return withCors({ error: "missing_fields" }, 400);

      const ip = req.headers.get("x-forwarded-for") ?? undefined;
      const result = await ctx.runAction(internal.mfa.challengeMfa, {
        mfaToken: body.mfaToken,
        totpCode: body.totpCode,
        ip,
      });
      if (!result.success) return withCors({ error: result.error }, 401);
      return withCors({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        sessionId: result.sessionId,
      });
    } catch (e) {
      return withCors({ error: "internal_error", detail: (e as Error).message }, 500);
    }
  }),
});

// ── GET /v1/audit-exports ─────────────────────────────────────────────────────

http.route({ path: "/v1/audit-exports", method: "OPTIONS", handler: preflight });

http.route({
  path: "/v1/audit-exports",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;

    const url = new URL(req.url);
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");

    if (!startParam || !endParam) {
      return jsonResponse({ error: "missing_params", required: ["start", "end"] }, 400);
    }

    const startTs = new Date(startParam).getTime();
    const endTs = new Date(endParam).getTime();

    if (isNaN(startTs) || isNaN(endTs)) {
      return jsonResponse({ error: "invalid_date_format", expected: "YYYY-MM-DD" }, 400);
    }

    const orgId = caller.orgId as never;

    try {
      const exportRecord = await ctx.runQuery(internal.auditLog.getAuditExportByPeriodInternal, {
        orgId,
        startTs,
        endTs,
      });

      if (!exportRecord) {
        return jsonResponse({ error: "not_found" }, 404);
      }

      const downloadUrl = await ctx.runAction(internal.coldStorage.generatePresignedUrl, {
        storagePath: exportRecord.storagePath,
      });

      return jsonResponse({
        downloadUrl,
        expiresAt: Date.now() + 15 * 60 * 1000,
        period: exportRecord.period,
      });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("not configured")) return jsonResponse({ error: "cold_storage_not_configured" }, 503);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }),
});

// ── GET /v1/openapi.json ─────────────────────────────────────────────────────

http.route({
  path: "/v1/openapi.json",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify(OPENAPI_SPEC), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }),
});

http.route({ path: "/v1/openapi.json", method: "OPTIONS", handler: preflight });

// ── GET /v1/docs ──────────────────────────────────────────────────────────────

http.route({
  path: "/v1/docs",
  method: "GET",
  handler: httpAction(async () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GateKey API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/v1/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS },
    });
  }),
});

http.route({ path: "/v1/docs", method: "OPTIONS", handler: preflight });

// ── GET /v1/global-settings/rate-limits ───────────────────────────────────────

http.route({ path: "/v1/global-settings/rate-limits", method: "OPTIONS", handler: preflight });

async function requireRoot(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  caller: CallerContext,
): Promise<boolean> {
  const callerUser = await ctx.runQuery(internal.users.getUserById, {
    callerId: caller.callerId as never,
    userId: caller.callerId as never,
    orgId: caller.orgId as never,
  });
  return (callerUser as { isRoot?: boolean } | null)?.isRoot === true;
}

http.route({
  path: "/v1/global-settings/rate-limits",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    if (!(await requireRoot(ctx, caller))) return jsonResponse({ error: "forbidden" }, 403);
    const limits = await ctx.runQuery(internal.globalSettings.getGlobalRateLimits, {});
    return jsonResponse(limits);
  }),
});

http.route({
  path: "/v1/global-settings/rate-limits",
  method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    if (!(await requireRoot(ctx, caller))) return jsonResponse({ error: "forbidden" }, 403);
    let body: { checkPerMin?: number; checkBatchPerMin?: number } = {};
    try { body = await req.json(); } catch { /* empty */ }
    await ctx.runMutation(internal.globalSettings.updateGlobalRateLimits, {
      checkPerMin: body.checkPerMin,
      checkBatchPerMin: body.checkBatchPerMin,
    });
    return jsonResponse({ success: true });
  }),
});

// ── POST /v1/auth/rotate-key ──────────────────────────────────────────────────

http.route({ path: "/v1/auth/rotate-key", method: "OPTIONS", handler: preflight });

http.route({
  path: "/v1/auth/rotate-key",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const caller = await resolveJwtCaller(ctx, req);
    if (isResponse(caller)) return caller;
    if (!(await requireRoot(ctx, caller))) {
      return jsonResponse({ error: "forbidden", reason: "root_required" }, 403);
    }
    try {
      const result = await ctx.runAction(internal.jwt.rotateKeyPairWithActor, {
        actorId: caller.callerId,
      });
      return jsonResponse({
        rotatedAt: result.rotatedAt,
        newKeyId: result.newKeyId,
        previousKeyId: result.previousKeyId,
        previousKeyExpiresAt: result.previousKeyExpiresAt,
      });
    } catch (e) {
      return jsonResponse({ error: "internal_error", message: (e as Error).message }, 500);
    }
  }),
});

export default http;
