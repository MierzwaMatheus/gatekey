export type JwtContext = {
  userId: string;
  orgId: string;
  sessionId: string;
  workspaceIds: string[];
  roles: Record<string, string>;
};

export type ApiKeyContext = {
  orgId: string;
  scopes: string[];
  keyId: string;
  publicId: string;
};

export type AuthContext =
  | { type: "jwt"; data: JwtContext }
  | { type: "api_key"; data: ApiKeyContext };

function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

export function extractJwtContext(authHeader: string): JwtContext {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("missing_bearer");
  }
  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid_jwt_format");
  }
  let payload: Record<string, unknown>;
  try {
    const decoded = base64urlDecode(parts[1]);
    payload = JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    throw new Error("invalid_jwt_payload");
  }
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("missing_sub");
  }
  if (!payload.orgId || typeof payload.orgId !== "string") {
    throw new Error("missing_orgId");
  }
  return {
    userId: payload.sub,
    orgId: payload.orgId as string,
    sessionId: typeof payload.sessionId === "string" ? payload.sessionId : "",
    workspaceIds: Array.isArray(payload.workspaceIds)
      ? (payload.workspaceIds as string[])
      : [],
    roles:
      payload.roles && typeof payload.roles === "object" && !Array.isArray(payload.roles)
        ? (payload.roles as Record<string, string>)
        : {},
  };
}
