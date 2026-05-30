/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const EXPECTED_TABLES = [
  "users",
  "orgs",
  "org_settings",
  "workspaces",
  "org_members",
  "workspace_members",
  "roles",
  "capabilities",
  "role_capabilities",
  "resource_types",
  "bindings",
  "api_keys",
  "sessions",
  "session_blacklist",
  "audit_log",
  "audit_exports",
  "magic_link_tokens",
  "mfa_configs",
  "ip_rate_limits",
  "key_pairs",
  "impersonation_sessions",
  "global_settings",
  "rate_limit_counters",
];

test("schema: todas as tabelas esperadas estão definidas na mesma fonte de verdade", () => {
  const tableNames = Object.keys(schema.tables);
  for (const table of EXPECTED_TABLES) {
    expect(tableNames, `Tabela "${table}" deve estar no schema`).toContain(table);
  }
  expect(tableNames.length).toBe(EXPECTED_TABLES.length);
});

test("schema: tabela key_pairs tem os campos necessários para armazenar o par RS256", () => {
  const { validator } = schema.tables.key_pairs;
  const fields = Object.keys(validator.fields);
  expect(fields).toContain("kid");
  expect(fields).toContain("privateKeyJwk");
  expect(fields).toContain("publicKeyJwk");
  expect(fields).toContain("status");
  expect(fields).toContain("createdAt");
});

test("schema: tabela users tem o campo isRoot para o usuário root", () => {
  const { validator } = schema.tables.users;
  const fields = Object.keys(validator.fields);
  expect(fields).toContain("isRoot");
  expect(fields).toContain("email");
  expect(fields).toContain("passwordHash");
});

test("schema: deploy via convexTest usa o mesmo schema.ts — tabelas são acessíveis em runtime", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "root@example.com",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );
  const user = await t.run(async (ctx) => ctx.db.get(userId));
  expect(user?.isRoot).toBe(true);
  expect(user?.email).toBe("root@example.com");
});
