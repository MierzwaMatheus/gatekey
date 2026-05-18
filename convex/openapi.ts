// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

export const OPENAPI_SPEC = {
  openapi: "3.0.0",
  info: {
    title: "GateKey API",
    version: "1.0.0",
    description:
      "GateKey — Authorization as a Service. Fine-grained RBAC with org/workspace hierarchy, JWT RS256, API Keys, MFA TOTP, and Audit Logs.",
  },
  servers: [{ url: "/", description: "Current deployment" }],
  components: {
    securitySchemes: {
      BearerJWT: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      ApiKey: {
        type: "http",
        scheme: "bearer",
        description: "API Key in format: gk_live_pk_{publicId}_{secret}",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/v1/auth/login": {
      post: {
        summary: "Login with email and password",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    accessToken: { type: "string" },
                    refreshToken: { type: "string" },
                    sessionId: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { description: "Invalid credentials" },
          "429": { description: "Account locked or quota exceeded" },
        },
      },
    },
    "/v1/auth/refresh": {
      post: {
        summary: "Refresh access token",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sessionId", "refreshToken", "orgId"],
                properties: {
                  sessionId: { type: "string" },
                  refreshToken: { type: "string" },
                  orgId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "New token pair" },
          "401": { description: "Invalid or rotated refresh token" },
        },
      },
    },
    "/v1/auth/logout": {
      post: {
        summary: "Logout — blacklist session",
        tags: ["Auth"],
        security: [{ BearerJWT: [] }],
        responses: {
          "200": { description: "Session invalidated" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/v1/auth/.well-known/jwks": {
      get: {
        summary: "Get JWKS public keys",
        tags: ["Auth"],
        responses: {
          "200": { description: "JWKS JSON" },
        },
      },
    },
    "/v1/auth/magic-link": {
      post: {
        summary: "Request magic link email",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                  orgId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Email sent" },
          "403": { description: "Magic link disabled for org" },
        },
      },
    },
    "/v1/auth/magic-link/verify": {
      get: {
        summary: "Verify magic link token",
        tags: ["Auth"],
        parameters: [
          { name: "token", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Tokens or MFA challenge" },
          "401": { description: "Expired or already used token" },
        },
      },
    },
    "/v1/auth/mfa/setup": {
      post: {
        summary: "Setup TOTP MFA — get QR code",
        tags: ["Auth", "MFA"],
        responses: {
          "200": { description: "TOTP secret and QR code URL" },
        },
      },
    },
    "/v1/auth/mfa/verify-setup": {
      post: {
        summary: "Activate MFA with TOTP code",
        tags: ["Auth", "MFA"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["totpCode"],
                properties: {
                  totpCode: { type: "string", minLength: 6, maxLength: 6 },
                  mfaSetupToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "MFA activated, backup codes returned" },
          "401": { description: "Invalid TOTP code" },
        },
      },
    },
    "/v1/auth/mfa/challenge": {
      post: {
        summary: "Complete MFA challenge",
        tags: ["Auth", "MFA"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["mfaToken", "totpCode"],
                properties: {
                  mfaToken: { type: "string" },
                  totpCode: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Access + refresh tokens" },
          "401": { description: "Invalid TOTP code" },
        },
      },
    },
    "/v1/check": {
      post: {
        summary: "Check permission (PDP decision)",
        tags: ["Permissions"],
        security: [{ BearerJWT: [] }, { ApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId", "capability", "resourceType", "workspaceId"],
                properties: {
                  userId: { type: "string" },
                  capability: { type: "string", example: "document:read" },
                  resourceType: { type: "string", example: "document" },
                  resourceId: { type: "string" },
                  workspaceId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "PDP decision",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    allowed: { type: "boolean" },
                    reason: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/v1/check/batch": {
      post: {
        summary: "Batch permission check (dry-run — nenhum dado é persistido além do audit log)",
        description: "Verifica múltiplas permissões em paralelo. Retorna um array de decisões na mesma ordem do array de entrada. Requer escopo `check`.",
        tags: ["Permissions"],
        security: [{ BearerJWT: [] }, { ApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "items"],
                properties: {
                  workspaceId: { type: "string" },
                  items: {
                    type: "array",
                    minItems: 1,
                    maxItems: 100,
                    items: {
                      type: "object",
                      required: ["userId", "capability", "resourceType"],
                      properties: {
                        userId: { type: "string" },
                        capability: { type: "string", example: "document:read" },
                        resourceType: { type: "string", example: "document" },
                        resourceId: { type: "string" },
                      },
                    },
                  },
                },
              },
              example: {
                workspaceId: "ws_abc123",
                items: [
                  { userId: "user_1", capability: "document:read", resourceType: "document", resourceId: "doc_xyz" },
                  { userId: "user_2", capability: "document:write", resourceType: "document" },
                ],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Array de decisões PDP na mesma ordem do input",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      allowed: { type: "boolean" },
                      reason: { type: "string", example: "direct_binding" },
                    },
                  },
                },
                example: [
                  { allowed: true, reason: "direct_binding" },
                  { allowed: false, reason: "no_binding_found" },
                ],
              },
            },
          },
          "401": { description: "Token ausente ou inválido" },
          "403": { description: "Escopo check ausente na API Key" },
          "422": {
            description: "Body inválido (array vazio, mais de 100 itens, campo obrigatório ausente)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/v1/users": {
      get: {
        summary: "List users in org",
        tags: ["Users"],
        security: [{ BearerJWT: [] }],
        responses: {
          "200": { description: "User list" },
        },
      },
      post: {
        summary: "Create user",
        tags: ["Users"],
        security: [{ BearerJWT: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "role"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  role: { type: "string" },
                  orgId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "User created" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "429": { description: "Quota exceeded" },
        },
      },
    },
    "/v1/users/{id}": {
      get: {
        summary: "Get user by ID",
        tags: ["Users"],
        security: [{ BearerJWT: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "User data (no passwordHash)" },
          "404": { description: "User not found" },
        },
      },
      patch: {
        summary: "Update user",
        tags: ["Users"],
        security: [{ BearerJWT: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Updated" } },
      },
      delete: {
        summary: "Suspend or remove user",
        tags: ["Users"],
        security: [{ BearerJWT: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Deleted/suspended" } },
      },
    },
    "/v1/users/{id}/permissions": {
      get: {
        summary: "List user bindings with resolved capabilities",
        tags: ["Users"],
        security: [{ BearerJWT: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Bindings list" } },
      },
    },
    "/v1/bindings": {
      get: {
        summary: "List bindings",
        tags: ["Bindings"],
        security: [{ BearerJWT: [] }],
        parameters: [
          { name: "workspaceId", in: "query", required: true, schema: { type: "string" } },
          { name: "userId", in: "query", schema: { type: "string" } },
          { name: "resourceType", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Bindings" } },
      },
      post: {
        summary: "Create binding",
        tags: ["Bindings"],
        security: [{ BearerJWT: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId", "roleId", "resourceType", "workspaceId"],
                properties: {
                  userId: { type: "string" },
                  roleId: { type: "string" },
                  resourceType: { type: "string" },
                  resourceId: { type: "string" },
                  workspaceId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Binding created" },
          "422": { description: "Role/workspace mismatch" },
        },
      },
    },
    "/v1/bindings/{id}": {
      delete: {
        summary: "Delete binding",
        tags: ["Bindings"],
        security: [{ BearerJWT: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "workspaceId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Revoked" } },
      },
    },
    "/v1/roles": {
      get: {
        summary: "List roles",
        tags: ["Roles"],
        security: [{ BearerJWT: [] }],
        parameters: [{ name: "workspaceId", in: "query", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Roles list" } },
      },
      post: {
        summary: "Create custom role",
        tags: ["Roles"],
        security: [{ BearerJWT: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "workspaceId"],
                properties: {
                  name: { type: "string" },
                  workspaceId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Role created" },
          "429": { description: "Quota exceeded" },
        },
      },
    },
    "/v1/roles/{id}": {
      delete: {
        summary: "Delete custom role",
        tags: ["Roles"],
        security: [{ BearerJWT: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Deleted" },
          "409": { description: "Active bindings using this role" },
        },
      },
    },
    "/v1/capabilities": {
      get: {
        summary: "List capabilities",
        tags: ["Capabilities"],
        security: [{ BearerJWT: [] }],
        responses: { "200": { description: "Capabilities list" } },
      },
      post: {
        summary: "Create custom capability",
        tags: ["Capabilities"],
        security: [{ BearerJWT: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "description"],
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Capability created" },
          "429": { description: "Quota exceeded" },
        },
      },
    },
    "/v1/resource-types": {
      get: {
        summary: "List resource types",
        tags: ["Resource Types"],
        security: [{ BearerJWT: [] }],
        responses: { "200": { description: "Resource types" } },
      },
      post: {
        summary: "Register resource type",
        tags: ["Resource Types"],
        security: [{ BearerJWT: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  inheritsFrom: { type: "string" },
                  inheritanceMode: { type: "string", enum: ["parent", "all"] },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Resource type registered" } },
      },
    },
    "/v1/sessions": {
      get: {
        summary: "List active sessions",
        tags: ["Sessions"],
        security: [{ BearerJWT: [] }],
        parameters: [{ name: "userId", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Sessions list" } },
      },
    },
    "/v1/sessions/{id}": {
      delete: {
        summary: "Revoke session",
        tags: ["Sessions"],
        security: [{ BearerJWT: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Session revoked" } },
      },
    },
    "/v1/api-keys": {
      get: {
        summary: "List API Keys",
        tags: ["API Keys"],
        security: [{ BearerJWT: [] }],
        responses: { "200": { description: "API Keys list (no secrets)" } },
      },
      post: {
        summary: "Create API Key",
        tags: ["API Keys"],
        security: [{ BearerJWT: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  scopes: { type: "array", items: { type: "string" } },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "API Key created — secret shown once" },
          "429": { description: "Quota exceeded" },
        },
      },
    },
    "/v1/api-keys/{id}": {
      delete: {
        summary: "Revoke API Key",
        tags: ["API Keys"],
        security: [{ BearerJWT: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Revoked" } },
      },
    },
    "/v1/audit-log": {
      get: {
        summary: "Query audit log (hot tier)",
        tags: ["Audit"],
        security: [{ BearerJWT: [] }],
        parameters: [
          { name: "orgId", in: "query", schema: { type: "string" } },
          { name: "workspaceId", in: "query", schema: { type: "string" } },
          { name: "action", in: "query", schema: { type: "string" } },
          { name: "result", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "number" } },
          { name: "to", in: "query", schema: { type: "number" } },
          { name: "cursor", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated audit events" } },
      },
    },
    "/v1/audit-exports": {
      get: {
        summary: "Get presigned URL for cold tier export",
        tags: ["Audit"],
        security: [{ BearerJWT: [] }],
        parameters: [
          { name: "start", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "end", in: "query", required: true, schema: { type: "string", format: "date" } },
        ],
        responses: {
          "200": { description: "Presigned download URL (TTL 15 min)" },
          "404": { description: "No export found for period" },
        },
      },
    },
    "/v1/workspaces": {
      get: {
        summary: "List workspaces in org",
        tags: ["Workspaces"],
        security: [{ BearerJWT: [] }],
        responses: { "200": { description: "Workspaces list" } },
      },
      post: {
        summary: "Create workspace",
        tags: ["Workspaces"],
        security: [{ BearerJWT: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: { name: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "201": { description: "Workspace created" },
          "429": { description: "Quota exceeded" },
        },
      },
    },
    "/v1/orgs": {
      get: {
        summary: "List organizations (Root only)",
        tags: ["Organizations"],
        security: [{ BearerJWT: [] }],
        responses: { "200": { description: "Orgs list" } },
      },
      post: {
        summary: "Create organization (Root only)",
        tags: ["Organizations"],
        security: [{ BearerJWT: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "adminEmail"],
                properties: {
                  name: { type: "string" },
                  adminEmail: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Org created with first admin" } },
      },
    },
  },
};
