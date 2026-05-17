import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

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
        const status = result.error === "account_locked" ? 429 : 401;
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

async function resolveJwtCaller(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  req: Request,
): Promise<{ callerId: string; orgId: string } | Response> {
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
    return { callerId: result.orgId, orgId: result.orgId };
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
  path: "/v1/orgs/",
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
  path: "/v1/orgs/",
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
  path: "/v1/orgs/",
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
  path: "/v1/orgs/",
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
    const caller = await resolveJwtCaller(ctx, req);
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

    if (!userId) return jsonResponse({ error: "missing_user_id" }, 400);

    try {
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
    const caller = await resolveJwtCaller(ctx, req);
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
  path: "/v1/sessions/",
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

// Preflight OPTIONS — rotas com path fixo
http.route({ path: "/v1/orgs", method: "OPTIONS", handler: preflight });
http.route({ path: "/v1/orgs/", method: "OPTIONS", handler: preflight });
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
        orgId: body.orgId as never,
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
        return withCors({ error: result.error }, 401);
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

export default http;
