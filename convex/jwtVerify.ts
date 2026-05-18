// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { jwtVerify, createLocalJWKSet, type JWTPayload, type JWK } from "jose";

export type JwtVerifiedPayload = {
  sub: string;
  orgId: string;
  sessionId: string;
  workspaceIds: string[];
  roles: Record<string, string>;
  capabilities: string[];
};

export async function verifyJwtToken(
  token: string,
  publicKeys: Array<{ publicKeyJwk: string }>,
): Promise<JwtVerifiedPayload> {
  if (publicKeys.length === 0) throw new Error("no_active_key_pair");
  const jwks = { keys: publicKeys.map((k) => JSON.parse(k.publicKeyJwk) as JWK) };
  const keySet = createLocalJWKSet(jwks);
  const { payload } = await jwtVerify(token, keySet, { algorithms: ["RS256"] });
  const p = payload as JWTPayload & Record<string, unknown>;
  return {
    sub: p.sub as string,
    orgId: p["orgId"] as string,
    sessionId: typeof p["sessionId"] === "string" ? p["sessionId"] : "",
    workspaceIds: Array.isArray(p["workspaceIds"]) ? (p["workspaceIds"] as string[]) : [],
    roles:
      p["roles"] && typeof p["roles"] === "object" && !Array.isArray(p["roles"])
        ? (p["roles"] as Record<string, string>)
        : {},
    capabilities: Array.isArray(p["capabilities"]) ? (p["capabilities"] as string[]) : [],
  };
}
