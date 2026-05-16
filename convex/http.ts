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

export default http;
