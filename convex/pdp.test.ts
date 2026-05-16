import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── checkUserActive ──────────────────────────────────────────────────────────

test("checkUserActive: retorna true para usuário ativo", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "active@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkUserActive, { userId });
  });
  expect(result).toBe(true);
});

test("checkUserActive: retorna false para usuário suspenso", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "suspended@example.com",
      passwordHash: "hash",
      status: "suspended",
      loginAttempts: 0,
      updatedAt: Date.now(),
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkUserActive, { userId });
  });
  expect(result).toBe(false);
});

test("checkUserActive: retorna false para usuário deletado", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "deleted@example.com",
      passwordHash: "hash",
      status: "deleted",
      loginAttempts: 0,
      updatedAt: Date.now(),
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkUserActive, { userId });
  });
  expect(result).toBe(false);
});
