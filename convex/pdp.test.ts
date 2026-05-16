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

// ── checkSessionValid ────────────────────────────────────────────────────────

test("checkSessionValid: retorna true para sessão válida e não blacklistada", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await t.run(async (ctx) => {
    return await ctx.db.insert("sessions", {
      userId: await ctx.db.insert("users", {
        email: "u@example.com",
        passwordHash: "h",
        status: "active",
        loginAttempts: 0,
        updatedAt: Date.now(),
      }),
      refreshTokenHash: "rth",
      expiresAt: Date.now() + 60_000,
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkSessionValid, { sessionId });
  });
  expect(result).toBe(true);
});

test("checkSessionValid: retorna false para sessão na blacklist", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await t.run(async (ctx) => {
    const sid = await ctx.db.insert("sessions", {
      userId: await ctx.db.insert("users", {
        email: "u2@example.com",
        passwordHash: "h",
        status: "active",
        loginAttempts: 0,
        updatedAt: Date.now(),
      }),
      refreshTokenHash: "rth",
      expiresAt: Date.now() + 60_000,
    });
    await ctx.db.insert("session_blacklist", { sessionId: sid, expiresAt: Date.now() + 60_000 });
    return sid;
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkSessionValid, { sessionId });
  });
  expect(result).toBe(false);
});

test("checkSessionValid: retorna false para sessão expirada", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await t.run(async (ctx) => {
    return await ctx.db.insert("sessions", {
      userId: await ctx.db.insert("users", {
        email: "u3@example.com",
        passwordHash: "h",
        status: "active",
        loginAttempts: 0,
        updatedAt: Date.now(),
      }),
      refreshTokenHash: "rth",
      expiresAt: Date.now() - 1,
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkSessionValid, { sessionId });
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

// ── checkApiKeyValid ─────────────────────────────────────────────────────────

test("checkApiKeyValid: retorna true para api_key ativa", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    await ctx.db.insert("api_keys", {
      orgId,
      publicId: "gk_live_pk_abc123",
      secretHash: "h",
      scopes: ["check"],
      description: "test key",
      status: "active",
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkApiKeyValid, { publicId: "gk_live_pk_abc123" });
  });
  expect(result).toBe(true);
});

test("checkApiKeyValid: retorna false para api_key revogada", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    await ctx.db.insert("api_keys", {
      orgId,
      publicId: "gk_live_pk_revoked",
      secretHash: "h",
      scopes: ["check"],
      description: "revoked key",
      status: "revoked",
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkApiKeyValid, { publicId: "gk_live_pk_revoked" });
  });
  expect(result).toBe(false);
});

test("checkApiKeyValid: retorna false para publicId inexistente", async () => {
  const t = convexTest(schema, modules);
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkApiKeyValid, { publicId: "gk_live_pk_nonexistent" });
  });
  expect(result).toBe(false);
});

// ── checkApiKeyScope ─────────────────────────────────────────────────────────

test("checkApiKeyScope: retorna true quando scope está presente", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    await ctx.db.insert("api_keys", {
      orgId,
      publicId: "gk_live_pk_scoped",
      secretHash: "h",
      scopes: ["check", "users:read"],
      description: "scoped key",
      status: "active",
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkApiKeyScope, {
      publicId: "gk_live_pk_scoped",
      requiredScope: "check",
    });
  });
  expect(result).toBe(true);
});

test("checkApiKeyScope: retorna false quando scope está ausente", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    await ctx.db.insert("api_keys", {
      orgId,
      publicId: "gk_live_pk_limited",
      secretHash: "h",
      scopes: ["check"],
      description: "limited key",
      status: "active",
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkApiKeyScope, {
      publicId: "gk_live_pk_limited",
      requiredScope: "users:write",
    });
  });
  expect(result).toBe(false);
});

// ── findDirectBinding ────────────────────────────────────────────────────────

test("findDirectBinding: retorna binding quando existe correspondência direta", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId, roleId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "bound@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    const wsId = await ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" });
    const rId = await ctx.db.insert("roles", { name: "editor", isBase: true });
    await ctx.db.insert("bindings", {
      userId: uid, roleId: rId, resourceType: "document", resourceId: "doc_1", workspaceId: wsId,
    });
    return { userId: uid, workspaceId: wsId, roleId: rId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.findDirectBinding, {
      userId, resourceType: "document", resourceId: "doc_1",
    });
  });
  expect(result).not.toBeNull();
  expect(result?.roleId).toBe(roleId);
});

test("findDirectBinding: retorna null quando não existe binding direto", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "unbound@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.findDirectBinding, {
      userId, resourceType: "document", resourceId: "doc_999",
    });
  });
  expect(result).toBeNull();
});

// ── findWorkspaceBinding ─────────────────────────────────────────────────────

test("findWorkspaceBinding: retorna binding de workspace quando existe", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId, roleId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "wsmember@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    const wsId = await ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" });
    const rId = await ctx.db.insert("roles", { name: "viewer", isBase: true });
    await ctx.db.insert("bindings", {
      userId: uid, roleId: rId, resourceType: "workspace", workspaceId: wsId,
    });
    return { userId: uid, workspaceId: wsId, roleId: rId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.findWorkspaceBinding, { userId, workspaceId });
  });
  expect(result).not.toBeNull();
  expect(result?.roleId).toBe(roleId);
});

test("findWorkspaceBinding: retorna null quando não existe binding de workspace", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "nowsbinding@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    const wsId = await ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" });
    return { userId: uid, workspaceId: wsId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.findWorkspaceBinding, { userId, workspaceId });
  });
  expect(result).toBeNull();
});

// ── resolveRole ──────────────────────────────────────────────────────────────

test("resolveRole: retorna nomes das capabilities do role", async () => {
  const t = convexTest(schema, modules);
  const roleId = await t.run(async (ctx) => {
    const rId = await ctx.db.insert("roles", { name: "editor", isBase: true });
    const cap1 = await ctx.db.insert("capabilities", { name: "document:read", description: "Read docs", isBase: true });
    const cap2 = await ctx.db.insert("capabilities", { name: "document:write", description: "Write docs", isBase: true });
    await ctx.db.insert("role_capabilities", { roleId: rId, capabilityId: cap1 });
    await ctx.db.insert("role_capabilities", { roleId: rId, capabilityId: cap2 });
    return rId;
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.resolveRole, { roleId });
  });
  expect(result).toHaveLength(2);
  expect(result).toContain("document:read");
  expect(result).toContain("document:write");
});

test("resolveRole: retorna array vazio quando role não tem capabilities", async () => {
  const t = convexTest(schema, modules);
  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", { name: "empty-role", isBase: false });
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.resolveRole, { roleId });
  });
  expect(result).toEqual([]);
});

// ── findParentBinding ────────────────────────────────────────────────────────

test("findParentBinding: retorna binding do tipo pai quando existe herança configurada", async () => {
  const t = convexTest(schema, modules);
  const { userId, orgId, roleId } = await t.run(async (ctx) => {
    const oId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "parent@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    const wsId = await ctx.db.insert("workspaces", { orgId: oId, name: "WS", status: "active" });
    const rId = await ctx.db.insert("roles", { name: "editor", isBase: true });
    await ctx.db.insert("resource_types", {
      orgId: oId, name: "document", inheritsFrom: "folder", inheritanceMode: "auto",
    });
    await ctx.db.insert("bindings", {
      userId: uid, roleId: rId, resourceType: "folder", resourceId: "folder_1", workspaceId: wsId,
    });
    await ctx.db.insert("bindings", {
      userId: uid, roleId: rId, resourceType: "document", resourceId: "doc_1",
      parentResourceId: "folder_1", workspaceId: wsId,
    });
    return { userId: uid, orgId: oId, roleId: rId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.findParentBinding, {
      userId, resourceType: "document", resourceId: "doc_1", orgId,
    });
  });
  expect(result).not.toBeNull();
  expect(result?.roleId).toBe(roleId);
});

test("findParentBinding: retorna null quando tipo não tem herança configurada", async () => {
  const t = convexTest(schema, modules);
  const { userId, orgId } = await t.run(async (ctx) => {
    const oId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "noparent@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    await ctx.db.insert("resource_types", { orgId: oId, name: "document" });
    return { userId: uid, orgId: oId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.findParentBinding, {
      userId, resourceType: "document", resourceId: "doc_1", orgId,
    });
  });
  expect(result).toBeNull();
});

// ── pdpDecide ────────────────────────────────────────────────────────────────

async function setupPdpContext(ctx: any, opts: {
  userStatus?: "active" | "suspended" | "deleted";
  sessionBlacklisted?: boolean;
  sessionExpired?: boolean;
  apiKeyStatus?: "active" | "revoked";
  apiKeyScopes?: string[];
  isMember?: boolean;
  bindingLevel?: "direct" | "parent" | "workspace" | "none";
  capability?: string;
} = {}) {
  const {
    userStatus = "active",
    sessionBlacklisted = false,
    sessionExpired = false,
    apiKeyStatus = "active",
    apiKeyScopes = ["check"],
    isMember = true,
    bindingLevel = "direct",
    capability = "document:read",
  } = opts;

  const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
  const userId = await ctx.db.insert("users", {
    email: `user-${Date.now()}@example.com`, passwordHash: "h",
    status: userStatus, loginAttempts: 0, updatedAt: Date.now(),
  });
  const workspaceId = await ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" });

  const sessionId = await ctx.db.insert("sessions", {
    userId, refreshTokenHash: "rth",
    expiresAt: sessionExpired ? Date.now() - 1 : Date.now() + 60_000,
  });
  if (sessionBlacklisted) {
    await ctx.db.insert("session_blacklist", { sessionId, expiresAt: Date.now() + 60_000 });
  }

  await ctx.db.insert("api_keys", {
    orgId, publicId: `gk_live_pk_${Date.now()}`, secretHash: "h",
    scopes: apiKeyScopes, description: "test", status: apiKeyStatus,
  });
  const publicId = (await ctx.db.query("api_keys").order("desc").first())!.publicId;

  if (isMember) {
    await ctx.db.insert("workspace_members", { userId, workspaceId, status: "active" });
  }

  const capId = await ctx.db.insert("capabilities", { name: capability, description: "", isBase: true });
  const roleId = await ctx.db.insert("roles", { name: "editor", isBase: true });
  await ctx.db.insert("role_capabilities", { roleId, capabilityId: capId });

  if (bindingLevel === "direct") {
    await ctx.db.insert("bindings", {
      userId, roleId, resourceType: "document", resourceId: "doc_1", workspaceId,
    });
  } else if (bindingLevel === "workspace") {
    await ctx.db.insert("bindings", {
      userId, roleId, resourceType: "workspace", workspaceId,
    });
  } else if (bindingLevel === "parent") {
    await ctx.db.insert("resource_types", {
      orgId, name: "document", inheritsFrom: "folder", inheritanceMode: "auto",
    });
    await ctx.db.insert("bindings", {
      userId, roleId, resourceType: "folder", resourceId: "folder_1", workspaceId,
    });
    await ctx.db.insert("bindings", {
      userId, roleId, resourceType: "document", resourceId: "doc_1",
      parentResourceId: "folder_1", workspaceId,
    });
  }

  return { userId, orgId, workspaceId, sessionId, publicId };
}

test("pdpDecide: ALLOW por binding direto no recurso", async () => {
  const t = convexTest(schema, modules);
  const args = await t.run(async (ctx) => setupPdpContext(ctx, { bindingLevel: "direct" }));
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.pdpDecide, {
      userId: args.userId, orgId: args.orgId, capability: "document:read",
      resourceType: "document", resourceId: "doc_1", workspaceId: args.workspaceId,
      sessionId: args.sessionId,
    });
  });
  expect(result.allowed).toBe(true);
});

test("pdpDecide: ALLOW por binding no workspace (sem binding direto)", async () => {
  const t = convexTest(schema, modules);
  const args = await t.run(async (ctx) => setupPdpContext(ctx, { bindingLevel: "workspace" }));
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.pdpDecide, {
      userId: args.userId, orgId: args.orgId, capability: "document:read",
      resourceType: "document", resourceId: "doc_1", workspaceId: args.workspaceId,
      sessionId: args.sessionId,
    });
  });
  expect(result.allowed).toBe(true);
});

test("pdpDecide: DENY quando usuário está suspenso", async () => {
  const t = convexTest(schema, modules);
  const args = await t.run(async (ctx) => setupPdpContext(ctx, { userStatus: "suspended" }));
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.pdpDecide, {
      userId: args.userId, orgId: args.orgId, capability: "document:read",
      resourceType: "document", resourceId: "doc_1", workspaceId: args.workspaceId,
      sessionId: args.sessionId,
    });
  });
  expect(result.allowed).toBe(false);
  expect(result.reason).toBe("user_inactive");
});

test("pdpDecide: DENY quando sessão está na blacklist", async () => {
  const t = convexTest(schema, modules);
  const args = await t.run(async (ctx) => setupPdpContext(ctx, { sessionBlacklisted: true }));
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.pdpDecide, {
      userId: args.userId, orgId: args.orgId, capability: "document:read",
      resourceType: "document", resourceId: "doc_1", workspaceId: args.workspaceId,
      sessionId: args.sessionId,
    });
  });
  expect(result.allowed).toBe(false);
  expect(result.reason).toBe("session_invalid");
});

test("pdpDecide: DENY quando API Key não tem o escopo necessário", async () => {
  const t = convexTest(schema, modules);
  const args = await t.run(async (ctx) =>
    setupPdpContext(ctx, { apiKeyScopes: ["audit:read"] }),
  );
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.pdpDecide, {
      userId: args.userId, orgId: args.orgId, capability: "document:read",
      resourceType: "document", resourceId: "doc_1", workspaceId: args.workspaceId,
      apiKeyPublicId: args.publicId, requiredScope: "check",
    });
  });
  expect(result.allowed).toBe(false);
  expect(result.reason).toBe("api_key_scope_missing");
});

test("pdpDecide: DENY quando nenhum binding existe em nenhum nível", async () => {
  const t = convexTest(schema, modules);
  const args = await t.run(async (ctx) => setupPdpContext(ctx, { bindingLevel: "none" }));
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.pdpDecide, {
      userId: args.userId, orgId: args.orgId, capability: "document:read",
      resourceType: "document", resourceId: "doc_1", workspaceId: args.workspaceId,
      sessionId: args.sessionId,
    });
  });
  expect(result.allowed).toBe(false);
  expect(result.reason).toBe("no_binding_found");
});

test("pdpDecide: ALLOW por herança de container pai (inheritanceMode configurado)", async () => {
  const t = convexTest(schema, modules);
  const args = await t.run(async (ctx) => setupPdpContext(ctx, { bindingLevel: "parent" }));
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.pdpDecide, {
      userId: args.userId, orgId: args.orgId, capability: "document:read",
      resourceType: "document", resourceId: "doc_1", workspaceId: args.workspaceId,
      sessionId: args.sessionId,
    });
  });
  expect(result.allowed).toBe(true);
});

// ── checkWorkspaceMembership ──────────────────────────────────────────────────

test("checkWorkspaceMembership: retorna true para membro ativo", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "member@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    const wsId = await ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" });
    await ctx.db.insert("workspace_members", { userId: uid, workspaceId: wsId, status: "active" });
    return { userId: uid, workspaceId: wsId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkWorkspaceMembership, { userId, workspaceId });
  });
  expect(result).toBe(true);
});

test("checkWorkspaceMembership: retorna false quando não há registro", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "nomember@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    const wsId = await ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" });
    return { userId: uid, workspaceId: wsId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkWorkspaceMembership, { userId, workspaceId });
  });
  expect(result).toBe(false);
});

test("checkWorkspaceMembership: retorna false para membro removido", async () => {
  const t = convexTest(schema, modules);
  const { userId, workspaceId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Org", status: "active", updatedAt: Date.now() });
    const uid = await ctx.db.insert("users", {
      email: "removed@example.com", passwordHash: "h", status: "active", loginAttempts: 0, updatedAt: Date.now(),
    });
    const wsId = await ctx.db.insert("workspaces", { orgId, name: "WS", status: "active" });
    await ctx.db.insert("workspace_members", { userId: uid, workspaceId: wsId, status: "removed" });
    return { userId: uid, workspaceId: wsId };
  });
  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.pdp.checkWorkspaceMembership, { userId, workspaceId });
  });
  expect(result).toBe(false);
});
