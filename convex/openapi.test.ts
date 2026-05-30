/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── Ciclo 11a: GET /v1/openapi.json ──────────────────────────────────────────

test("GET /v1/openapi.json retorna spec OpenAPI 3.0 com paths de auth", async () => {
  const t = convexTest(schema, modules);

  const res = await t.fetch("/v1/openapi.json", { method: "GET" });

  expect(res.status).toBe(200);
  const contentType = res.headers.get("content-type") ?? "";
  expect(contentType).toContain("application/json");

  const body = await res.json();
  expect(body.openapi).toBe("3.0.0");
  expect(body.info).toBeDefined();
  expect(body.info.title).toContain("GateKey");
  expect(body.paths).toBeDefined();
  expect(body.paths["/v1/auth/login"]).toBeDefined();
  expect(body.paths["/v1/check"]).toBeDefined();
  expect(body.paths["/v1/bindings"]).toBeDefined();
});

// ── Ciclo 11b: GET /v1/docs ───────────────────────────────────────────────────

test("GET /v1/docs retorna HTML com Swagger UI", async () => {
  const t = convexTest(schema, modules);

  const res = await t.fetch("/v1/docs", { method: "GET" });

  expect(res.status).toBe(200);
  const contentType = res.headers.get("content-type") ?? "";
  expect(contentType).toContain("text/html");

  const html = await res.text();
  expect(html).toContain("swagger");
  expect(html).toContain("/v1/openapi.json");
});
