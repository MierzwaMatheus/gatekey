# PEP Coverage Checklist

> Audit de cobertura do Policy Enforcement Point (PEP) para todos os endpoints HTTP e mutations sensíveis.
> Atualizar sempre que novos endpoints ou mutations forem adicionados.

## Status

✅ = Protegido por PEP  
⚠️ = Público intencional (sem autenticação requerida)  
❌ = Sem proteção (NÃO DEVE EXISTIR)

---

## HTTP Action Endpoints

### Autenticação (públicos intencionais)

| Método | Endpoint | Proteção | Mecanismo |
|--------|----------|----------|-----------|
| GET | `/v1/auth/.well-known/jwks` | ⚠️ Público | JWKS endpoint público para verificação de tokens |
| POST | `/v1/auth/login` | ⚠️ Público | Credenciais validadas internamente |
| POST | `/v1/auth/refresh` | ⚠️ Público | Refresh token validado internamente |
| POST | `/v1/auth/logout` | ✅ JWT | Verifica Bearer token antes de invalidar sessão |

### Usuários

| Método | Endpoint | Proteção | Mecanismo |
|--------|----------|----------|-----------|
| POST | `/v1/users` | ✅ JWT/API Key | `resolveJwtCaller` + `assertOrgAdminOrRoot` na mutation |
| GET | `/v1/users/:id` | ✅ JWT/API Key | `resolveJwtCaller` |
| PATCH | `/v1/users/:id` | ✅ JWT/API Key | `resolveJwtCaller` + `assertOrgAdminOrRoot` na mutation |
| DELETE | `/v1/users/:id` | ✅ JWT/API Key | `resolveJwtCaller` + `assertOrgAdminOrRoot` na mutation |
| GET | `/v1/users/:id/permissions` | ✅ JWT/API Key | `resolveJwtCaller` |

### Roles e Capabilities

| Método | Endpoint | Proteção | Mecanismo |
|--------|----------|----------|-----------|
| POST | `/v1/roles` | ✅ JWT/API Key | `resolveJwtCaller` + `assertOrgAdminOrRoot` na mutation |
| GET | `/v1/roles` | ✅ JWT/API Key | `resolveJwtCaller` |
| DELETE | `/v1/roles/:id` | ✅ JWT/API Key | `resolveJwtCaller` + `assertOrgAdminOrRoot` na mutation |
| GET | `/v1/capabilities` | ✅ JWT/API Key | `resolveJwtCaller` |
| POST | `/v1/capabilities` | ✅ JWT/API Key | `resolveJwtCaller` + `assertOrgAdminOrRoot` na mutation |

### Bindings

| Método | Endpoint | Proteção | Mecanismo |
|--------|----------|----------|-----------|
| POST | `/v1/bindings` | ✅ JWT/API Key | `resolveJwtCaller` + validação na mutation |
| GET | `/v1/bindings` | ✅ JWT/API Key | `resolveJwtCaller` |
| DELETE | `/v1/bindings/:id` | ✅ JWT/API Key | `resolveJwtCaller` + validação na mutation |

### Tipos de Recurso

| Método | Endpoint | Proteção | Mecanismo |
|--------|----------|----------|-----------|
| POST | `/v1/resource-types` | ✅ JWT/API Key | `resolveJwtCaller` + `assertOrgAdminOrRoot` na mutation |
| GET | `/v1/resource-types` | ✅ JWT/API Key | `resolveJwtCaller` |

### Verificação de Permissão

| Método | Endpoint | Proteção | Mecanismo |
|--------|----------|----------|-----------|
| POST | `/v1/check` | ✅ JWT/API Key | `resolveJwtCaller` |

### Sessões

| Método | Endpoint | Proteção | Mecanismo |
|--------|----------|----------|-----------|
| GET | `/v1/sessions` | ✅ JWT/API Key | `resolveJwtCaller` + filtro por orgId |
| DELETE | `/v1/sessions/:id` | ✅ JWT/API Key | `resolveJwtCaller` + validação na mutation |

### API Keys

| Método | Endpoint | Proteção | Mecanismo |
|--------|----------|----------|-----------|
| POST | `/v1/api-keys` | ✅ JWT/API Key | `resolveJwtCaller` + `_assertOrgAdminOrRoot` na action |
| GET | `/v1/api-keys` | ✅ JWT/API Key | `resolveJwtCaller` |
| DELETE | `/v1/api-keys/:id` | ✅ JWT/API Key | `resolveJwtCaller` + `assertOrgAdminOrRoot` na mutation |

### Audit Log

| Método | Endpoint | Proteção | Mecanismo |
|--------|----------|----------|-----------|
| GET | `/v1/audit-log` | ✅ JWT/API Key | `resolveJwtCaller` |

---

## Mutations Sensíveis (Seções 1.6 e 2.x)

Todas as mutations abaixo têm autorização inline via `assertOrgAdminOrRoot`, `isOrgAdminOrRoot` ou verificações equivalentes. Nenhuma mutation sensível executa sem verificação de autenticidade do caller.

### Hierarquia (1.6) — `convex/hierarchy.ts`

| Mutation | Verificação PEP |
|----------|-----------------|
| `createOrg` | `callerId` deve ser Root (`isRoot = true`) |
| `suspendOrg` | `callerId` deve ser Root |
| `deleteOrg` | `callerId` deve ser Root |
| `createWorkspace` | `isOrgAdminOrRoot` query |
| `suspendWorkspace` | `isOrgAdminOrRoot` query |
| `createUserForOrg` | `isOrgAdminOrRoot` query |
| `suspendUser` | `isOrgAdminOrRoot` query |
| `patchUserPasswordHash` | `isOrgAdminOrRoot` query |
| `addWorkspaceMember` | `isOrgAdminOrRoot` query |
| `removeWorkspaceMember` | `isOrgAdminOrRoot` query |
| `changeWorkspaceMemberRole` | `isOrgAdminOrRoot` query |

### Roles e Capabilities (2.2) — `convex/roles.ts`

| Mutation | Verificação PEP |
|----------|-----------------|
| `createRole` | `assertOrgAdminOrRoot` |
| `deleteRole` | `assertOrgAdminOrRoot` |
| `createCapability` | `assertOrgAdminOrRoot` |

### Bindings (2.3) — `convex/bindings.ts`

| Mutation | Verificação PEP |
|----------|-----------------|
| `createBinding` | Valida caller pertence à org |
| `deleteBinding` | Valida caller pertence à org |

### API Keys (2.7) — `convex/apiKeys.ts` + `convex/apiKeysActions.ts`

| Mutation/Action | Verificação PEP |
|-----------------|-----------------|
| `createApiKey` (action) | `_assertOrgAdminOrRoot` |
| `revokeApiKey` | Valida caller é org admin ou root |

### Audit Log (2.8) — `convex/auditLog.ts`

| Mutation | Verificação PEP |
|----------|-----------------|
| `writeAuditEvent` | Interno apenas (`internalMutation`) — nunca exposto via HTTP |

---

## Mecanismo `resolveJwtCaller` (http.ts)

Função usada por todos os endpoints autenticados. Verifica em ordem:

1. Header `Authorization: Bearer <token>` presente
2. Se token começa com `gk_live_pk_` → delega para `internal.pep.verifyApiKey` (Node runtime, suporta argon2id)
3. Se token é JWT → `internal.jwt.verifyJwt` (verifica assinatura RS256 e expiração)
4. Se JWT válido → verifica `sessionId` na `session_blacklist`
5. Retorna `{ callerId, orgId }` ou `Response 401`

## Garantias de Segurança

- **Sessões revogadas**: `resolveJwtCaller` verifica `session_blacklist` antes de aceitar qualquer JWT
- **API Keys revogadas**: `verifyApiKey` verifica `status = "active"` antes de aceitar
- **JWT expirado**: `verifyJwt` usa `jose` que rejeita tokens com `exp` no passado
- **Fail closed**: qualquer exceção em `resolveJwtCaller` resulta em 401

## Testes de Cobertura PEP

Arquivo: `convex/pepIntegration.test.ts`

| Cenário | Status |
|---------|--------|
| Sem `Authorization` header → 401 | ✅ |
| JWT expirado → 401 | ✅ |
| SessionId na blacklist → 401 | ✅ |
| API Key revogada → 401 | ✅ |
