/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import argon2 from "argon2";

const modules = import.meta.glob("./**/*.ts");

test("root criado via bootstrapRootUser autentica com a senha em texto claro (hash argon2 compatível)", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const plainPassword = "SenhaSegura@123";
  const passwordHash = await argon2.hash(plainPassword);

  const result = await t.action(internal.setup.bootstrapRootUser, {
    email: "root@gatekey.dev",
    passwordHash,
  });

  expect(result.success).toBe(true);

  const loginResult = await t.action(internal.auth.loginWithPassword, {
    email: "root@gatekey.dev",
    password: plainPassword,
  });

  // Root sem MFA recebe mfa_setup_required — isso é comportamento correto (task 4.5).
  // O importante é que NÃO retorna invalid_credentials: o hash argon2 bate.
  expect(loginResult.success).toBe(false);
  if (!loginResult.success) {
    expect(loginResult.error).not.toBe("invalid_credentials");
    expect(loginResult.error).toBe("mfa_setup_required");
  }
});

test("root com senha errada retorna invalid_credentials", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const passwordHash = await argon2.hash("SenhaCorreta@123");
  await t.action(internal.setup.bootstrapRootUser, {
    email: "root@gatekey.dev",
    passwordHash,
  });

  const loginResult = await t.action(internal.auth.loginWithPassword, {
    email: "root@gatekey.dev",
    password: "SenhaErrada",
  });

  expect(loginResult.success).toBe(false);
  if (!loginResult.success) {
    expect(loginResult.error).toBe("invalid_credentials");
  }
});

test("bootstrapRootUser retorna erro quando root já existe", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const passwordHash = await argon2.hash("Senha1");

  await t.action(internal.setup.bootstrapRootUser, {
    email: "root@gatekey.dev",
    passwordHash,
  });

  const second = await t.action(internal.setup.bootstrapRootUser, {
    email: "root@gatekey.dev",
    passwordHash,
  });

  expect(second.success).toBe(false);
  if (!second.success) {
    expect(second.error).toBe("root_user_already_exists");
  }
});

test("root tem flag isRoot=true no banco após criação via bootstrapRootUser", async () => {
  const t = convexTest(schema, modules);
  await t.action(internal.jwt.initializeKeyPair, {});

  const passwordHash = await argon2.hash("Senha2");
  const result = await t.action(internal.setup.bootstrapRootUser, {
    email: "rootcheck@gatekey.dev",
    passwordHash,
  });

  expect(result.success).toBe(true);
  if (result.success) {
    const user = await t.run(async (ctx) => ctx.db.get(result.userId as never));
    expect(user?.isRoot).toBe(true);
  }
});
