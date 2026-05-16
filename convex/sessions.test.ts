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
      email: "user@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId, orgId, role: "admin", status: "active" }),
  );
  return { orgId, userId };
}

// ── Ciclo 1: listSessions ─────────────────────────────────────────────────────

test("listSessions: retorna sessões ativas da org", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const sessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId,
      refreshTokenHash: "rth",
      expiresAt: Date.now() + 60_000,
      ip: "1.2.3.4",
    }),
  );

  const result = await t.query(internal.sessions.listSessions, { orgId });

  expect(result).toHaveLength(1);
  expect(result[0]._id).toBe(sessionId);
  expect(result[0].userId).toBe(userId);
});

test("listSessions: não retorna sessões expiradas", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId,
      refreshTokenHash: "rth",
      expiresAt: Date.now() - 1000,
    }),
  );

  const result = await t.query(internal.sessions.listSessions, { orgId });
  expect(result).toHaveLength(0);
});

test("listSessions: não retorna sessões blacklistadas", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const sessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId,
      refreshTokenHash: "rth",
      expiresAt: Date.now() + 60_000,
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("session_blacklist", { sessionId, expiresAt: Date.now() + 60_000 }),
  );

  const result = await t.query(internal.sessions.listSessions, { orgId });
  expect(result).toHaveLength(0);
});

test("listSessions: filtra por userId quando fornecido", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const userId2 = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "other@acme.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: userId2, orgId, role: "editor", status: "active" }),
  );

  await t.run((ctx) =>
    ctx.db.insert("sessions", { userId, refreshTokenHash: "rth1", expiresAt: Date.now() + 60_000 }),
  );
  const session2Id = await t.run((ctx) =>
    ctx.db.insert("sessions", { userId: userId2, refreshTokenHash: "rth2", expiresAt: Date.now() + 60_000 }),
  );

  const result = await t.query(internal.sessions.listSessions, { orgId, userId: userId2 });
  expect(result).toHaveLength(1);
  expect(result[0]._id).toBe(session2Id);
});

test("listSessions: não retorna sessões de usuários de outra org", async () => {
  const t = convexTest(schema, modules);
  const { orgId } = await setupBase(t);

  const otherOrgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Other", status: "active", updatedAt: Date.now() }),
  );
  const otherUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "other@other.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: otherUserId, orgId: otherOrgId, role: "admin", status: "active" }),
  );
  await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId: otherUserId,
      refreshTokenHash: "rth",
      expiresAt: Date.now() + 60_000,
    }),
  );

  const result = await t.query(internal.sessions.listSessions, { orgId });
  expect(result).toHaveLength(0);
});

// ── Root access ──────────────────────────────────────────────────────────────

test("listSessions: Root visualiza sessões de qualquer org", async () => {
  const t = convexTest(schema, modules);

  const rootId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root@system.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );

  const orgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "AnyOrg", status: "active", updatedAt: Date.now() }),
  );
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "user@anyorg.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId, orgId, role: "admin", status: "active" }),
  );
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", { userId, refreshTokenHash: "rth", expiresAt: Date.now() + 60_000 }),
  );

  // Root passes a special "root" orgId sentinel; implementation should detect isRoot
  const result = await t.query(internal.sessions.listSessions, {
    orgId,
    callerId: rootId,
  });
  expect(result.map((s: { _id: string }) => s._id)).toContain(sessionId);
});

test("revokeSession: Root pode revogar sessão de qualquer org", async () => {
  const t = convexTest(schema, modules);

  const rootId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "root@system.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
      isRoot: true,
    }),
  );

  const otherOrgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Other", status: "active", updatedAt: Date.now() }),
  );
  const otherUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "other@other.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: otherUserId, orgId: otherOrgId, role: "admin", status: "active" }),
  );

  const sessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId: otherUserId,
      refreshTokenHash: "rth",
      expiresAt: Date.now() + 60_000,
    }),
  );

  // Root uses any orgId (e.g. the session's user's org) — should not throw
  await expect(
    t.action(internal.sessions.revokeSession, {
      sessionId,
      callerId: rootId,
      orgId: otherOrgId,
    }),
  ).resolves.toBeNull();

  const blacklisted = await t.run((ctx) =>
    ctx.db.query("session_blacklist").withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId)).first(),
  );
  expect(blacklisted).not.toBeNull();
});

// ── Ciclo 3: revokeSession ────────────────────────────────────────────────────

test("revokeSession: insere sessionId na blacklist com TTL correto", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const expiresAt = Date.now() + 60_000;
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", { userId, refreshTokenHash: "rth", expiresAt }),
  );

  await t.action(internal.sessions.revokeSession, {
    sessionId,
    callerId: userId,
    orgId,
  });

  const blacklisted = await t.run((ctx) =>
    ctx.db.query("session_blacklist").withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId)).first(),
  );
  expect(blacklisted).not.toBeNull();
  expect(blacklisted!.expiresAt).toBe(expiresAt);
});

test("revokeSession: registra audit event com action session.revoke", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const sessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", { userId, refreshTokenHash: "rth", expiresAt: Date.now() + 60_000 }),
  );

  await t.action(internal.sessions.revokeSession, { sessionId, callerId: userId, orgId });

  const auditEntry = await t.run((ctx) =>
    ctx.db.query("audit_log").order("desc").first(),
  );
  expect(auditEntry).not.toBeNull();
  expect(auditEntry!.action).toBe("session.revoke");
  expect(auditEntry!.result).toBe("allow");
});

test("revokeSession: lança erro se sessionId não existe", async () => {
  const t = convexTest(schema, modules);
  const { orgId, userId } = await setupBase(t);

  const fakeSessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", { userId, refreshTokenHash: "rth", expiresAt: Date.now() + 60_000 }),
  );
  await t.run((ctx) => ctx.db.delete(fakeSessionId));

  await expect(
    t.action(internal.sessions.revokeSession, { sessionId: fakeSessionId, callerId: userId, orgId }),
  ).rejects.toThrow("session_not_found");
});

test("revokeSession: lança erro se sessão pertence a usuário de outra org", async () => {
  const t = convexTest(schema, modules);
  const { orgId } = await setupBase(t);

  const otherOrgId = await t.run((ctx) =>
    ctx.db.insert("orgs", { name: "Other", status: "active", updatedAt: Date.now() }),
  );
  const otherUserId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "other@other.io",
      passwordHash: "hash",
      status: "active",
      loginAttempts: 0,
      updatedAt: Date.now(),
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("org_members", { userId: otherUserId, orgId: otherOrgId, role: "admin", status: "active" }),
  );

  const sessionId = await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId: otherUserId,
      refreshTokenHash: "rth",
      expiresAt: Date.now() + 60_000,
    }),
  );

  await expect(
    t.action(internal.sessions.revokeSession, { sessionId, callerId: otherUserId, orgId }),
  ).rejects.toThrow("forbidden");
});
