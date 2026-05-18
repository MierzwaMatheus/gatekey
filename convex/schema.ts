// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("deleted")),
    loginAttempts: v.number(),
    lockedUntil: v.optional(v.number()),
    updatedAt: v.number(),
    isRoot: v.optional(v.boolean()),
    mustChangePassword: v.optional(v.boolean()),
  }).index("by_email", ["email"]),

  orgs: defineTable({
    name: v.string(),
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("deleted")),
    updatedAt: v.number(),
  }),

  org_settings: defineTable({
    orgId: v.id("orgs"),
    loginMethods: v.array(
      v.union(
        v.literal("email_password"),
        v.literal("magic_link"),
        v.literal("oauth_google"),
        v.literal("oauth_github"),
      ),
    ),
    mfaRequired: v.boolean(),
    jwtExpiryAccess: v.number(),
    jwtExpiryRefresh: v.number(),
    quotas: v.record(v.string(), v.number()),
    defaultLanguage: v.optional(v.string()),
  }),

  workspaces: defineTable({
    orgId: v.id("orgs"),
    name: v.string(),
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("deleted")),
  }),

  org_members: defineTable({
    userId: v.id("users"),
    orgId: v.id("orgs"),
    role: v.string(),
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("removed")),
  }),

  workspace_members: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    status: v.union(v.literal("active"), v.literal("removed")),
  }).index("by_userId_and_workspaceId", ["userId", "workspaceId"]),

  roles: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    name: v.string(),
    isBase: v.boolean(),
  }),

  capabilities: defineTable({
    orgId: v.optional(v.id("orgs")),
    name: v.string(),
    description: v.string(),
    isBase: v.boolean(),
  }),

  role_capabilities: defineTable({
    roleId: v.id("roles"),
    capabilityId: v.id("capabilities"),
  }),

  resource_types: defineTable({
    orgId: v.id("orgs"),
    name: v.string(),
    inheritsFrom: v.optional(v.string()),
    inheritanceMode: v.optional(v.string()),
  }).index("by_orgId", ["orgId"]),

  bindings: defineTable({
    userId: v.id("users"),
    roleId: v.id("roles"),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    parentResourceId: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
  })
    .index("by_workspaceId_and_userId", ["workspaceId", "userId"])
    .index("by_resourceType_and_resourceId", ["resourceType", "resourceId"])
    .index("by_userId_and_resourceType_and_resourceId", ["userId", "resourceType", "resourceId"]),

  api_keys: defineTable({
    orgId: v.id("orgs"),
    publicId: v.string(),
    secretHash: v.string(),
    scopes: v.array(v.string()),
    description: v.string(),
    lastUsedAt: v.optional(v.number()),
    lastUsedIp: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("revoked")),
  })
    .index("by_orgId_and_status", ["orgId", "status"])
    .index("by_publicId", ["publicId"]),

  sessions: defineTable({
    userId: v.id("users"),
    refreshTokenHash: v.string(),
    expiresAt: v.number(),
    deviceInfo: v.optional(v.string()),
    ip: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  session_blacklist: defineTable({
    sessionId: v.id("sessions"),
    expiresAt: v.number(),
  }).index("by_sessionId", ["sessionId"]),

  audit_log: defineTable({
    timestamp: v.number(),
    actorType: v.union(v.literal("user"), v.literal("api_key"), v.literal("system")),
    actorId: v.string(),
    actorRole: v.optional(v.string()),
    action: v.string(),
    target: v.object({
      type: v.string(),
      id: v.optional(v.string()),
    }),
    orgId: v.optional(v.id("orgs")),
    workspaceId: v.optional(v.id("workspaces")),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    result: v.union(v.literal("allow"), v.literal("deny")),
    reason: v.optional(v.string()),
  })
    .index("by_orgId_and_timestamp", ["orgId", "timestamp"])
    .index("by_workspaceId_and_timestamp", ["workspaceId", "timestamp"]),

  audit_exports: defineTable({
    orgId: v.id("orgs"),
    period: v.object({
      start: v.number(),
      end: v.number(),
    }),
    storagePath: v.string(),
    createdAt: v.number(),
  }),

  magic_link_tokens: defineTable({
    tokenHash: v.string(),
    userId: v.id("users"),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_tokenHash", ["tokenHash"]),

  mfa_configs: defineTable({
    userId: v.id("users"),
    secret: v.optional(v.string()),
    backupCodes: v.array(v.string()),
    activatedAt: v.optional(v.number()),
    pendingSecret: v.optional(v.string()),
    pendingSecretExpiresAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  ip_rate_limits: defineTable({
    ip: v.string(),
    endpoint: v.string(),
    count: v.number(),
    windowStart: v.number(),
  }).index("by_ip_and_endpoint", ["ip", "endpoint"]),

  key_pairs: defineTable({
    kid: v.string(),
    privateKeyJwk: v.string(),
    publicKeyJwk: v.string(),
    createdAt: v.number(),
    status: v.union(v.literal("active"), v.literal("retired")),
  }).index("by_status_and_createdAt", ["status", "createdAt"]),
});
