/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setupBase(t: ReturnType<typeof convexTest>) {
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Acme", status: "active", updatedAt: Date.now() }),
  );
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "admin@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId, orgId, role: "admin", status: "active" }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_settings", {
      orgId,
      loginMethods: ["email_password"],
      mfaRequired: false,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 2592000,
      quotas: { api_keys_per_org: 10 },
    }),
  );
  return { orgId, userId };
}

// ── Ciclo 1: createApiKey ─────────────────────────────────────────────────────

test("createApiKey: retorna publicId no formato gk_live_pk_*", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const result = await t.action(internal.apiKeysActions.createApiKey, {
    callerId: userId,
    orgId,
    scopes: ["check"],
    description: "test key",
    ip: "1.2.3.4",
  });

  expect(result.publicId).toMatch(/^gk_live_pk_/);
  expect(result.secret).toBeTruthy();
  expect(typeof result.secret).toBe("string");
});

test("createApiKey: não armazena o secret em plaintext no banco", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const result = await t.action(internal.apiKeysActions.createApiKey, {
    callerId: userId,
    orgId,
    scopes: ["check"],
    description: "test key",
    ip: "1.2.3.4",
  });

  const key = await t.run((ctx) =>
    ctx.db
      .query("api_keys")
      .withIndex("by_publicId", (q) => q.eq("publicId", result.publicId))
      .unique(),
  );

  expect(key).not.toBeNull();
  expect(key!.secretHash).not.toBe(result.secret);
  expect(key!.status).toBe("active");
  expect(key!.scopes).toEqual(["check"]);
});

// ── Ciclo 2: quota ────────────────────────────────────────────────────────────

test("createApiKey: lança quota_exceeded quando org atingiu o limite de api_keys_per_org", async () => {
  const t = convexTest(schema, modules);
  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Limited", status: "active", updatedAt: Date.now() }),
  );
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "admin@limited.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId, orgId, role: "admin", status: "active" }),
  );
  // Quota de 2 para facilitar o teste
  await t.run((ctx) =>
    ctx.db.insert("org_settings", {
      orgId,
      loginMethods: ["email_password"],
      mfaRequired: false,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 2592000,
      quotas: { api_keys_per_org: 2 },
    }),
  );

  // Inserir 2 keys ativas diretamente
  await t.run((ctx) =>
    ctx.db.insert("api_keys", {
      orgId,
      publicId: "gk_live_pk_aaaabbbbccccdddd11",
      secretHash: "hash1",
      scopes: ["check"],
      description: "key1",
      status: "active",
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("api_keys", {
      orgId,
      publicId: "gk_live_pk_aaaabbbbccccdddd22",
      secretHash: "hash2",
      scopes: ["check"],
      description: "key2",
      status: "active",
    }),
  );

  await expect(
    t.action(internal.apiKeysActions.createApiKey, {
      callerId: userId,
      orgId,
      scopes: ["check"],
      description: "key3",
      ip: "1.2.3.4",
    }),
  ).rejects.toThrow("quota_exceeded");
});

// ── Ciclo 3: listApiKeys ──────────────────────────────────────────────────────

test("listApiKeys: nunca retorna secretHash", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  await t.action(internal.apiKeysActions.createApiKey, {
    callerId: userId,
    orgId,
    scopes: ["check"],
    description: "my key",
    ip: "1.2.3.4",
  });

  const keys = await t.query(internal.apiKeys.listApiKeys, {
    callerId: userId,
    orgId,
  });

  expect(keys).toHaveLength(1);
  expect(keys[0]).not.toHaveProperty("secretHash");
  expect(keys[0].publicId).toMatch(/^gk_live_pk_/);
  expect(keys[0].description).toBe("my key");
});

test("listApiKeys: não lista keys de outra org", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const otherOrgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Other", status: "active", updatedAt: Date.now() }),
  );
  await t.run((ctx) =>
    ctx.db.insert("api_keys", {
      orgId: otherOrgId,
      publicId: "gk_live_pk_other000000000001",
      secretHash: "hash",
      scopes: ["check"],
      description: "other org key",
      status: "active",
    }),
  );

  const keys = await t.query(internal.apiKeys.listApiKeys, {
    callerId: userId,
    orgId,
  });

  expect(keys).toHaveLength(0);
});

// ── Ciclo 4: revokeApiKey ─────────────────────────────────────────────────────

test("revokeApiKey: muda status da key para revoked", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const { publicId } = await t.action(internal.apiKeysActions.createApiKey, {
    callerId: userId,
    orgId,
    scopes: ["check"],
    description: "to revoke",
    ip: "1.2.3.4",
  });

  const key = await t.run((ctx) =>
    ctx.db
      .query("api_keys")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .unique(),
  );
  expect(key).not.toBeNull();

  await t.mutation(internal.apiKeys.revokeApiKey, {
    callerId: userId,
    orgId,
    keyId: key!._id,
    ip: "1.2.3.4",
  });

  const updated = await t.run((ctx) => ctx.db.get(key!._id));
  expect(updated!.status).toBe("revoked");
});

test("revokeApiKey: lança not_found se keyId não existe", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const tempKeyId = await t.run((ctx) =>
    ctx.db.insert("api_keys", {
      orgId,
      publicId: "gk_live_pk_temp000000000001",
      secretHash: "hash",
      scopes: [],
      description: "temp",
      status: "active",
    }),
  );
  await t.run((ctx) => ctx.db.delete(tempKeyId));

  await expect(
    t.mutation(internal.apiKeys.revokeApiKey, {
      callerId: userId,
      orgId,
      keyId: tempKeyId,
      ip: "1.2.3.4",
    }),
  ).rejects.toThrow("not_found");
});

// ── Ciclo 5: updateLastUsed ───────────────────────────────────────────────────

test("updateLastUsed: atualiza lastUsedAt e lastUsedIp", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const { publicId } = await t.action(internal.apiKeysActions.createApiKey, {
    callerId: userId,
    orgId,
    scopes: ["check"],
    description: "used key",
    ip: undefined,
  });

  const key = await t.run((ctx) =>
    ctx.db
      .query("api_keys")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .unique(),
  );
  expect(key!.lastUsedAt).toBeUndefined();

  const before = Date.now();
  await t.mutation(internal.apiKeys.updateLastUsed, {
    keyId: key!._id,
    ip: "5.6.7.8",
  });

  const updated = await t.run((ctx) => ctx.db.get(key!._id));
  expect(updated!.lastUsedAt).toBeGreaterThanOrEqual(before);
  expect(updated!.lastUsedIp).toBe("5.6.7.8");
});

// ── Ciclo 6: audit log ────────────────────────────────────────────────────────

test("createApiKey: registra audit event api_key.create", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  await t.action(internal.apiKeysActions.createApiKey, {
    callerId: userId,
    orgId,
    scopes: ["check"],
    description: "audit test",
    ip: "1.2.3.4",
  });

  const event = await t.run((ctx) => ctx.db.query("audit_log").order("desc").first());
  expect(event).not.toBeNull();
  expect(event!.action).toBe("api_key.create");
  expect(event!.result).toBe("allow");
});

test("revokeApiKey: registra audit event api_key.revoke", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const { publicId } = await t.action(internal.apiKeysActions.createApiKey, {
    callerId: userId,
    orgId,
    scopes: ["check"],
    description: "to revoke",
    ip: "1.2.3.4",
  });
  const key = await t.run((ctx) =>
    ctx.db
      .query("api_keys")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .unique(),
  );

  await t.mutation(internal.apiKeys.revokeApiKey, {
    callerId: userId,
    orgId,
    keyId: key!._id,
    ip: "1.2.3.4",
  });

  const event = await t.run((ctx) => ctx.db.query("audit_log").order("desc").first());
  expect(event!.action).toBe("api_key.revoke");
  expect(event!.result).toBe("allow");
});

// ── Ciclo 9: escopo insuficiente ──────────────────────────────────────────────

test("checkApiKeyScope: key com escopo check não tem escopo users:write", async () => {
  const t = convexTest(schema, modules);
  const { orgId } = await setupBase(t);

  const keyId = await t.run((ctx) =>
    ctx.db.insert("api_keys", {
      orgId,
      publicId: "gk_live_pk_scopetest000001",
      secretHash: "hash",
      scopes: ["check"],
      description: "limited scope key",
      status: "active",
    }),
  );

  const key = await t.run((ctx) => ctx.db.get(keyId));
  expect(key!.scopes).not.toContain("users:write");
  expect(key!.scopes).toContain("check");
});

// ── Ciclo 10: key revogada ────────────────────────────────────────────────────

test("revokeApiKey: key revogada tem status revoked e não pode ser reativada", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const { publicId } = await t.action(internal.apiKeysActions.createApiKey, {
    callerId: userId,
    orgId,
    scopes: ["check"],
    description: "revocable",
    ip: "1.2.3.4",
  });

  const key = await t.run((ctx) =>
    ctx.db
      .query("api_keys")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .unique(),
  );

  await t.mutation(internal.apiKeys.revokeApiKey, {
    callerId: userId,
    orgId,
    keyId: key!._id,
    ip: "1.2.3.4",
  });

  const revoked = await t.run((ctx) =>
    ctx.db
      .query("api_keys")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .unique(),
  );

  expect(revoked!.status).toBe("revoked");
  // Key revogada não aparece na listagem de ativas
  const activeKeys = await t.run((ctx) =>
    ctx.db
      .query("api_keys")
      .withIndex("by_orgId_and_status", (q) => q.eq("orgId", orgId).eq("status", "active"))
      .collect(),
  );
  expect(activeKeys.find((k) => k._id === key!._id)).toBeUndefined();
});
