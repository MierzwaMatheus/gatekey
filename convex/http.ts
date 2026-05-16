import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

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
      },
    });
  }),
});

http.route({
  path: "/v1/auth/login",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: { email?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!body.email || !body.password) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    const result = await ctx.runAction(internal.auth.loginWithPassword, {
      email: body.email,
      password: body.password,
      ip,
    });
    if (!result.success) {
      const status = result.error === "account_locked" ? 429 : 401;
      return new Response(
        JSON.stringify({ error: result.error, lockedUntil: result.lockedUntil }),
        { status, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        sessionId: result.sessionId,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
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
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    const result = await ctx.runAction(internal.auth.refreshTokens, {
      sessionId: body.sessionId as never,
      refreshToken: body.refreshToken,
      orgId: body.orgId,
      ip,
    });
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        sessionId: result.sessionId,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }),
});

http.route({
  path: "/v1/auth/logout",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing_token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);
    const verified = await ctx.runAction(internal.jwt.verifyJwt, { token });
    if (!verified.valid) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
