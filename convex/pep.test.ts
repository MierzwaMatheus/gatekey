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
