/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { extractJwtContext } from "./pepUtils";

const modules = import.meta.glob("./**/*.ts");

// ── extractJwtContext: validação de formato ──────────────────────────────────

test("extractJwtContext: lança erro quando header é string vazia", () => {
  expect(() => extractJwtContext("")).toThrow();
});

test("extractJwtContext: lança erro quando header não tem prefixo Bearer", () => {
  expect(() => extractJwtContext("eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig")).toThrow();
});

test("extractJwtContext: lança erro quando token tem menos de 3 segmentos", () => {
  expect(() => extractJwtContext("Bearer eyJhbGci.eyJzdWIi")).toThrow();
});

test("extractJwtContext: lança erro quando payload base64 não é JSON válido", () => {
  expect(() => extractJwtContext("Bearer eyJhbGci.bm90anNvbg.sig")).toThrow();
});

// ── extractJwtContext: extração de payload ───────────────────────────────────

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `Bearer eyJhbGciOiJSUzI1NiJ9.${encoded}.sig`;
}

test("extractJwtContext: retorna userId do campo sub", () => {
  const header = makeJwt({ sub: "user123", orgId: "org1" });
  const ctx = extractJwtContext(header);
  expect(ctx.userId).toBe("user123");
});

test("extractJwtContext: retorna orgId, sessionId, workspaceIds, roles do payload", () => {
  const header = makeJwt({
    sub: "user1",
    orgId: "org1",
    sessionId: "sess1",
    workspaceIds: ["ws1", "ws2"],
    roles: { ws1: "admin" },
  });
  const ctx = extractJwtContext(header);
  expect(ctx.orgId).toBe("org1");
  expect(ctx.sessionId).toBe("sess1");
  expect(ctx.workspaceIds).toEqual(["ws1", "ws2"]);
  expect(ctx.roles).toEqual({ ws1: "admin" });
});

test("extractJwtContext: lança erro quando campo sub está ausente", () => {
  expect(() => extractJwtContext(makeJwt({ orgId: "org1" }))).toThrow();
});

test("extractJwtContext: lança erro quando campo orgId está ausente", () => {
  expect(() => extractJwtContext(makeJwt({ sub: "user1" }))).toThrow();
});

// ── extractApiKeyContext: validação de formato ───────────────────────────────

import { extractApiKeyContextFormat } from "./pep";

test("extractApiKeyContext: lança erro quando header não tem prefixo Bearer", () => {
  expect(() => extractApiKeyContextFormat("gk_live_pk_abc123_secret")).toThrow("missing_bearer");
});

test("extractApiKeyContext: lança erro quando token não começa com gk_live_pk_", () => {
  expect(() => extractApiKeyContextFormat("Bearer someOtherToken")).toThrow("invalid_api_key_format");
});

test("extractApiKeyContext: lança erro quando token não tem separador de publicId", () => {
  expect(() => extractApiKeyContextFormat("Bearer gk_live_pk_nosseparator")).toThrow("invalid_api_key_format");
});
