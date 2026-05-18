# GateKey — Tasks

> Ordenadas por dependência. Seções marcadas com **"Integração:"** são pontos de conexão entre subsistemas — devem ser revisadas sempre que os dois lados estiverem prontos.

---

## Fase 1 — Core de autorização

### 1.1 Schema Convex — closes #1

- [x] Criar tabela `users` com campos: id, email, passwordHash, status, createdAt, updatedAt
- [x] Criar tabela `orgs` com campos: id, name, status, createdAt, updatedAt
- [x] Criar tabela `org_settings` com campos: orgId, loginMethods[], mfaRequired, jwtExpiryAccess, jwtExpiryRefresh, quotas{}
- [x] Criar tabela `workspaces` com campos: id, orgId, name, status, createdAt
- [x] Criar tabela `org_members` com campos: userId, orgId, role, status
- [x] Criar tabela `workspace_members` com campos: userId, workspaceId, status
- [x] Criar tabela `roles` com campos: id, workspaceId, name, isBase, createdAt
- [x] Criar tabela `capabilities` com campos: id, orgId (nullable para base), name, description, isBase
- [x] Criar tabela `role_capabilities` com campos: roleId, capabilityId
- [x] Criar tabela `resource_types` com campos: id, orgId, name, inheritsFrom (nullable), inheritanceMode (nullable)
- [x] Criar tabela `bindings` com campos: id, userId, roleId, resourceType, resourceId (nullable), parentResourceId (nullable), workspaceId
- [x] Criar tabela `api_keys` com campos: id, orgId, publicId, secretHash, scopes[], description, lastUsedAt, lastUsedIp, status, createdAt
- [x] Criar tabela `sessions` com campos: id, userId, refreshTokenHash, expiresAt, deviceInfo, ip, createdAt
- [x] Criar tabela `session_blacklist` com campos: sessionId, expiresAt
- [x] Criar tabela `audit_log` com campos: id, timestamp, actorType, actorId, actorRole, action, target{}, orgId, workspaceId, ip, userAgent, result, reason
- [x] Criar tabela `audit_exports` com campos: id, orgId, period{start, end}, storagePath, createdAt
- [x] Criar índice `bindings_by_workspace_user` em `(workspaceId, userId)`
- [x] Criar índice `bindings_by_resource` em `(resourceType, resourceId)`
- [x] Criar índice `bindings_by_user_resource` em `(userId, resourceType, resourceId)`
- [x] Criar índice `audit_log_by_org_time` em `(orgId, timestamp)`
- [x] Criar índice `audit_log_by_workspace_time` em `(workspaceId, timestamp)`
- [x] Criar índice `session_blacklist_by_sessionId` em `sessionId`
- [x] Criar índice `sessions_by_userId` em `userId`
- [x] Criar índice `api_keys_by_org_status` em `(orgId, status)`
- [x] Inserir seed dos 4 roles base: `owner`, `admin`, `editor`, `viewer` (isBase=true, workspaceId=null)
- [x] Inserir seed do catálogo base de capabilities: `document:read`, `document:write`, `user:invite`, `billing:view`, `report:export` (isBase=true)
- [x] Validar deploy do schema sem erros em ambiente local

### 1.2 PDP (Policy Decision Point) — closes #2 (parcial)

- [x] Criar função `checkUserActive(userId)` — retorna false se status = suspended ou deleted
- [x] Criar função `checkSessionValid(sessionId)` — consulta `session_blacklist` e verifica expiração, retorna false se revogada ou expirada
- [x] Criar função `checkApiKeyValid(publicId)` — verifica status = active
- [x] Criar função `checkApiKeyScope(publicId, requiredScope)` — verifica se `scopes[]` contém o escopo requerido
- [x] Criar função `checkWorkspaceMembership(userId, workspaceId)` — verifica existência de registro ativo em `workspace_members`
- [x] Criar função `findDirectBinding(userId, resourceType, resourceId)` — lookup em `bindings` pelo índice `bindings_by_user_resource`
- [x] Criar função `findParentBinding(userId, resourceType, resourceId)` — busca `resource_types.inheritsFrom` para o tipo, depois lookup binding no tipo pai
- [x] Criar função `findWorkspaceBinding(userId, workspaceId)` — lookup binding no nível de workspace (resourceId = null)
- [x] Criar função `resolveRole(roleId)` — retorna array de capability names via join `roles → role_capabilities → capabilities`
- [x] Criar função `pdpDecide(context: {userId, orgId, capability, resourceType, resourceId, workspaceId, sessionId?, apiKeyId?})` — orquestra os 8 passos em ordem, retorna `{allowed: boolean, reason: string}`
- [x] Implementar passo 1 no PDP: verificar `checkUserActive`
- [x] Implementar passo 2 no PDP: verificar `checkSessionValid` (quando autenticação por JWT)
- [x] Implementar passo 3 no PDP: verificar `checkApiKeyValid` (quando autenticação por API Key)
- [x] Implementar passo 4 no PDP: verificar `checkApiKeyScope` (quando autenticação por API Key)
- [x] Implementar passo 5 no PDP: verificar `checkWorkspaceMembership`
- [x] Implementar passo 6 no PDP: `findDirectBinding` — se encontrar, resolver role e verificar capability
- [x] Implementar passo 7 no PDP: `findParentBinding` — se tipo tem `inheritanceMode` configurado
- [x] Implementar passo 8 no PDP: `findWorkspaceBinding` — fallback para nível de workspace
- [x] Garantir que qualquer exceção não tratada no PDP resulta em `{allowed: false, reason: "internal_error"}` (fail closed)
- [x] Escrever teste unitário para `checkUserActive` — usuário ativo retorna true, suspenso retorna false
- [x] Escrever teste unitário para `checkSessionValid` — sessão na blacklist retorna false
- [x] Escrever teste unitário para `checkApiKeyScope` — escopo ausente retorna false
- [x] Escrever teste unitário para `findDirectBinding` — binding existente é encontrado
- [x] Escrever teste unitário para `findParentBinding` — binding no container pai é encontrado
- [x] Escrever teste unitário para `resolveRole` — capabilities do role são retornadas corretamente
- [x] Escrever teste de integração: ALLOW por binding direto no recurso
- [x] Escrever teste de integração: ALLOW por herança de container pai (inheritanceMode configurado)
- [x] Escrever teste de integração: ALLOW por herança de workspace (sem binding direto)
- [x] Escrever teste de integração: DENY quando nenhum binding existe em nenhum nível
- [x] Escrever teste de integração: DENY quando usuário está suspenso (mesmo com binding válido)
- [x] Escrever teste de integração: DENY quando sessão está na blacklist
- [x] Escrever teste de integração: DENY quando API Key não tem o escopo necessário

### 1.3 PEP (Policy Enforcement Point) — closes #2 (com 1.2)

- [x] Criar função `extractJwtContext(authHeader)` — valida Bearer token, retorna `{userId, orgId, sessionId, workspaceIds, roles}`
- [x] Criar função `extractApiKeyContext(authHeader)` — valida `gk_live_pk_...`, faz hash bcryptjs, compara com banco, retorna `{orgId, scopes, keyId}`
- [x] Criar função `resolveAuthContext(authHeader)` — escolhe entre JWT e API Key baseado no prefixo do token
- [x] Criar wrapper `withPep(handler, {requiredCapability?, requiredScope?})` para Convex HTTP Actions — extrai contexto, chama PDP, bloqueia se DENY
- [x] Criar wrapper `withPepMutation(mutationFn, requiredCapability)` para Convex mutations internas
- [x] Retornar HTTP 401 quando token ausente ou inválido
- [x] Retornar HTTP 403 com `{allowed: false, reason}` quando PDP retorna DENY
- [x] Garantir que nenhuma mutation ou query sensível executa sem passar pelo PEP
- [x] Escrever teste: requisição sem header Authorization retorna 401
- [x] Escrever teste: requisição com JWT malformado retorna 401
- [x] Escrever teste: requisição com permissão insuficiente retorna 403 com reason

### 1.4 JWT RS256 + JWKS — closes #3

- [x] Implementar Convex Action `initializeKeyPair` — gera par RS256 com `jose`, armazena chave privada e pública no Convex (privada nunca retornada em resposta)
- [x] Implementar função `signJwt(payload)` — assina com chave privada usando `jose`, algoritmo RS256
- [x] Implementar payload completo: `sub` (userId), `orgId`, `workspaceIds[]`, `roles{}`, `capabilities[]`, `sessionId`, `iat`, `exp`
- [x] Implementar função `verifyJwt(token)` — valida assinatura com chave pública e verifica `exp`
- [x] Implementar endpoint `GET /v1/auth/.well-known/jwks` — retorna chave pública em formato JWKS (sem autenticação)
- [x] Implementar geração de refresh token: 32 bytes aleatórios, hash bcryptjs armazenado em `sessions.refreshTokenHash`
- [x] Implementar rotação de refresh token: ao usar, invalidar sessão atual (inserir na blacklist) e criar nova sessão com novo token
- [x] Implementar leitura de `org_settings.jwtExpiryAccess` e `jwtExpiryRefresh` para configurar `exp` do token
- [x] Escrever teste: JWT emitido é verificável usando a chave pública retornada pelo JWKS
- [x] Escrever teste: JWT com `exp` no passado é rejeitado por `verifyJwt`
- [x] Escrever teste: refresh token rotacionado — apresentar o token antigo após rotação retorna erro

### 1.5 Login por email + senha — closes #4

- [x] Implementar `POST /v1/auth/login` — recebe `{email, password}`, valida credenciais, cria sessão, emite access + refresh token
- [x] Implementar hash de senha com bcryptjs via Convex Action (Node runtime) na criação de usuário
- [x] Implementar verificação de hash bcryptjs no login: `bcrypt.compare(inputPassword, storedHash)`
- [x] Implementar criação de registro em `sessions` a cada login bem-sucedido: userId, refreshTokenHash, expiresAt, ip, deviceInfo
- [x] Implementar `POST /v1/auth/refresh` — valida refresh token (hash comparison), insere sessionId antigo na blacklist, cria nova sessão, emite novo par
- [x] Implementar `POST /v1/auth/logout` — extrai sessionId do JWT, insere na `session_blacklist` com TTL = `exp` do token
- [x] Implementar campo `loginAttempts` e `lockedUntil` na tabela `users` para controle de bloqueio
- [x] Implementar incremento de `loginAttempts` a cada falha de senha
- [x] Implementar bloqueio temporário: quando `loginAttempts >= 5`, setar `lockedUntil = now + 15min`
- [x] Implementar verificação de `lockedUntil` no início do fluxo de login — retornar 429 se ainda bloqueado
- [x] Implementar reset de `loginAttempts` para 0 após login bem-sucedido
- [x] Implementar rate limiting por IP nos endpoints de auth via Convex Scheduler (contador por IP + TTL)
- [x] Chamar `writeAuditEvent` com action `auth.login.success` após login bem-sucedido
- [x] Chamar `writeAuditEvent` com action `auth.login.failure` após senha incorreta
- [x] Chamar `writeAuditEvent` com action `auth.login.blocked` quando conta está bloqueada
- [x] Chamar `writeAuditEvent` com action `auth.logout` após logout
- [x] Escrever teste: login com email e senha corretos retorna access token e refresh token válidos
- [x] Escrever teste: login com senha incorreta retorna 401 e incrementa contador de falhas
- [x] Escrever teste: na 5ª falha consecutiva, login retorna 429 com `lockedUntil`
- [x] Escrever teste: após bloqueio, login bem-sucedido ainda retorna 429 até `lockedUntil` expirar
- [x] Escrever teste: refresh token rotacionado — apresentar o token anterior retorna 401
- [x] Escrever teste: logout insere sessionId na blacklist, chamada seguinte com mesmo token retorna 401

### 1.6 Hierarquia Root → Org → Workspace → Member — closes #5

- [x] Criar Convex mutation `createOrg({name, adminEmail})` — apenas Root; cria org + org_settings padrão + primeiro Org Admin
- [x] Criar Convex mutation `suspendOrg({orgId})` — apenas Root; muda status para suspended
- [x] Criar Convex mutation `deleteOrg({orgId})` — apenas Root; soft delete (status = deleted)
- [x] Criar Convex mutation `createWorkspace({orgId, name})` — Org Admin da org ou Root
- [x] Criar Convex mutation `suspendWorkspace({workspaceId})` — Org Admin da org ou Root
- [x] Criar Convex mutation `createUser({orgId, email, password, role})` — Org Admin da org ou WS Admin (sem self-service)
- [x] Criar Convex mutation `suspendUser({userId})` — Org Admin (apenas usuários da própria org) ou Root
- [x] Criar Convex mutation `resetUserPassword({userId, newPassword})` — Org Admin (própria org) ou Root
- [x] Criar Convex mutation `addWorkspaceMember({workspaceId, userId, roleId})` — WS Admin ou Org Admin
- [x] Criar Convex mutation `removeWorkspaceMember({workspaceId, userId})` — WS Admin ou Org Admin
- [x] Criar Convex mutation `changeWorkspaceMemberRole({workspaceId, userId, newRoleId})` — WS Admin ou Org Admin
- [x] Implementar herança automática ao designar Org Admin: criar binding de role `admin` para cada workspace existente da org
- [x] Implementar herança automática ao criar workspace: criar binding de role `admin` para cada Org Admin da org
- [x] Implementar verificação de cota `users_per_org` em `createUser` — retornar QuotaExceeded se atingido
- [x] Implementar verificação de cota `workspaces_per_org` em `createWorkspace` — retornar QuotaExceeded se atingido
- [x] Implementar verificação de cota `users_per_workspace` em `addWorkspaceMember` — retornar QuotaExceeded se atingido
- [x] Implementar verificação de cota `sessions_per_user` em `POST /v1/auth/login` — retornar QuotaExceeded se atingido
- [x] Chamar `writeAuditEvent` em cada mutation acima com o respectivo action name
- [x] Escrever teste: Root cria org, Org Admin designado recebe binding admin em workspaces futuros
- [x] Escrever teste: criar workspace → todos os Org Admins da org recebem binding admin automaticamente
- [x] Escrever teste: `createUser` com org em quota máxima retorna `{error: "QuotaExceeded", quota: "users_per_org", limit: N, current: N}`
- [x] Escrever teste: Org Admin não consegue criar usuário em outra org

---

## Fase 2 — Management API

### 2.1 REST API — Usuários — closes #6 (parcial)

- [x] Implementar `POST /v1/users` — cria usuário na org; PEP requer escopo `users:write`
- [x] Implementar `GET /v1/users/:id` — retorna dados do usuário sem `passwordHash`; PEP requer `users:read`
- [x] Implementar `PATCH /v1/users/:id` — atualiza email, nome ou senha; PEP requer `users:write`
- [x] Implementar `DELETE /v1/users/:id` — suspende ou remove usuário; PEP requer `users:write`
- [x] Implementar `GET /v1/users/:id/permissions` — lista todos os bindings do usuário com capabilities resolvidas; PEP requer `users:read`
- [x] Aplicar PEP em todos os 5 endpoints acima
- [x] Chamar `writeAuditEvent` em create, update e delete
- [x] Escrever teste: `POST /v1/users` com org em cota máxima retorna 429 com QuotaExceeded
- [x] Escrever teste: Org Admin com JWT de org_A não acessa `GET /v1/users/:id` de usuário da org_B

### 2.2 REST API — Roles e Capabilities — closes #6 (parcial)

- [x] Implementar `POST /v1/roles` — cria role customizado no workspace; PEP requer `roles:write`
- [x] Implementar `GET /v1/roles` — lista roles do workspace (base + custom); PEP requer `roles:read`
- [x] Implementar `DELETE /v1/roles/:id` — remove role customizado; bloquear se há bindings ativos usando o role; PEP requer `roles:write`
- [x] Implementar `GET /v1/capabilities` — lista catálogo (base global + custom da org); PEP requer `roles:read`
- [x] Implementar `POST /v1/capabilities` — adiciona capability customizada à org; PEP requer `roles:write` + role org_admin
- [x] Implementar verificação de cota `capabilities_per_org` em `POST /v1/capabilities`
- [x] Implementar verificação de cota `roles_per_workspace` em `POST /v1/roles`
- [x] Garantir que `GET /v1/capabilities` filtra por `orgId` — capabilities de outras orgs nunca aparecem
- [x] Chamar `writeAuditEvent` em create e delete de role e capability
- [x] Escrever teste: capability criada em org_A não aparece na listagem de org_B
- [x] Escrever teste: `DELETE /v1/roles/:id` com bindings ativos retorna 409 com mensagem clara

### 2.3 REST API — Bindings — closes #6 (parcial)

- [x] Implementar `POST /v1/bindings` — cria binding `{userId, roleId, resourceType, resourceId?, workspaceId}`; PEP requer `bindings:write`
- [x] Implementar `GET /v1/bindings` — lista bindings com filtros opcionais `?userId=&resourceType=`; PEP requer `bindings:read`
- [x] Implementar `DELETE /v1/bindings/:id` — revoga binding; PEP requer `bindings:write`
- [x] Validar na criação que `roleId` pertence ao mesmo workspace do binding
- [x] Validar na criação que `userId` pertence ao workspace
- [x] Chamar `writeAuditEvent` em create e delete
- [x] Escrever teste: `POST /v1/bindings` com `roleId` de outro workspace retorna 422

### 2.4 REST API — Resource Types — closes #6 (parcial)

- [x] Implementar `POST /v1/resource-types` — registra tipo com `{name, inheritsFrom?, inheritanceMode?}`; PEP requer `roles:write`
- [x] Implementar `GET /v1/resource-types` — lista tipos registrados na org; PEP requer `roles:read`
- [x] Validar que `inheritsFrom` referencia um `resource_type.name` existente na mesma org
- [x] Escrever teste: registrar tipo `document` com `inheritsFrom: "folder"`, criar binding no folder, verificar que `POST /v1/check` retorna ALLOW para o document

### 2.5 REST API — Verificação de permissão — closes #6 (parcial)

- [x] Implementar `POST /v1/check` — recebe `{userId, capability, resourceType, resourceId?}`, chama `pdpDecide`, retorna `{allowed, reason}`; PEP requer escopo `check`
- [x] Chamar `writeAuditEvent` para cada chamada de `/check` incluindo o resultado ALLOW/DENY e reason
- [x] Escrever teste: `POST /v1/check` com binding correto retorna `{allowed: true}`
- [x] Escrever teste: `POST /v1/check` sem binding retorna `{allowed: false, reason: "no_binding_found"}`
- [x] Escrever teste: `POST /v1/check` com usuário suspenso retorna `{allowed: false, reason: "user_inactive"}`

### 2.6 REST API — Sessões — closes #6 (parcial)

- [x] Implementar `GET /v1/sessions` — lista sessões ativas; aceita filtro `?userId=`; PEP requer `sessions:write`
- [x] Implementar `DELETE /v1/sessions/:id` — insere sessionId na blacklist com TTL correto; PEP requer `sessions:write`
- [x] Garantir que Org Admin só visualiza e revoga sessões de usuários da própria org
- [x] Garantir que Root visualiza e revoga sessões de qualquer usuário
- [x] Chamar `writeAuditEvent` com action `session.revoke` em cada revogação

### 2.7 API Keys com escopos — closes #7

- [x] Implementar `POST /v1/api-keys` — gera `publicId` (`gk_live_pk_` + 24 chars aleatórios), gera secret (32 bytes), armazena `bcryptjs(secret)`, retorna secret em plaintext apenas nesta resposta; PEP requer role org_admin
- [x] Implementar `GET /v1/api-keys` — lista keys da org com metadata (publicId, scopes, description, lastUsedAt, status) sem secret; PEP requer role org_admin
- [x] Implementar `DELETE /v1/api-keys/:id` — muda status para `revoked`; PEP requer role org_admin
- [x] Implementar validação de API Key no PEP: recebe valor bruto no header, faz bcryptjs hash, compara com `secretHash` no banco
- [x] Implementar verificação de escopo no PEP: após validar a key, verificar se `scopes[]` contém o escopo requerido pelo endpoint
- [x] Implementar atualização de `lastUsedAt` e `lastUsedIp` a cada uso bem-sucedido da key
- [x] Implementar verificação de cota `api_keys_per_org` em `POST /v1/api-keys`
- [x] Chamar `writeAuditEvent` com action `api_key.create` e `api_key.revoke`
- [x] Escrever teste: `GET /v1/api-keys` nunca retorna o campo `secretHash` ou o secret original
- [x] Escrever teste: API Key com escopo `["check"]` recebe 403 ao chamar `POST /v1/users`
- [x] Escrever teste: API Key revogada recebe 401 imediatamente após revogação

### 2.8 Audit Log hot tier — closes #8

- [x] Criar função `writeAuditEvent(event: AuditEvent)` — helper centralizado que insere em `audit_log`; chamado internamente, nunca exposto diretamente
- [x] Confirmar que `writeAuditEvent` cobre todos os eventos listados no PRD seção 8.1
- [x] Implementar `GET /v1/audit-log` com paginação por cursor, filtros `?orgId=&workspaceId=&action=&result=&from=&to=`; PEP requer `audit:read`
- [x] Garantir ausência de endpoints `PUT`, `PATCH` ou `DELETE` para `audit_log`
- [x] Escrever teste: sequência login → criar binding → revogar binding gera 3 eventos na ordem correta
- [x] Escrever teste: Root acessa logs de qualquer org; Org Admin acessa apenas logs da própria org; WS Admin acessa apenas logs do próprio workspace

### 2.9 Integração: PEP ↔ Todas as mutations e endpoints — closes #6 (com 2.1–2.6)

- [x] Auditar cada Convex mutation criada nas seções 1.6 e 2.x — confirmar que nenhuma executa sem wrapper PEP
- [x] Auditar cada HTTP Action endpoint — confirmar que `withPep` está aplicado
- [x] Criar checklist de cobertura PEP e mantê-la atualizada no repositório
- [x] Escrever teste de integração: chamada sem header `Authorization` retorna 401
- [x] Escrever teste de integração: chamada com JWT expirado retorna 401
- [x] Escrever teste de integração: chamada com sessionId na blacklist retorna 401
- [x] Escrever teste de integração: chamada com API Key revogada retorna 401

---

## Fase 3 — Dashboard

### 3.1 Setup do projeto frontend — pré-requisito para #9, #10, #11

- [x] Inicializar projeto React + Vite na pasta `/dashboard`
- [x] Configurar TanStack Router com estrutura de rotas protegidas por role
- [x] Configurar `ConvexProvider` do `convex/react`
- [x] Instalar shadcn/ui e configurar Tailwind
- [x] Definir variáveis CSS no `globals.css`: `--gate-midnight: #0D1117`, `--gate-iron: #1C2333`, `--gate-steel: #30363D`, `--gate-key: #F0A500`, `--gate-key-dim: #7D5500`, `--gate-safe: #3FB950`, `--gate-danger: #F85149`, `--gate-text: #C9D1D9`, `--gate-muted: #8B949E`
- [x] Configurar fonte Inter para interface e JetBrains Mono para código e tokens via CSS
- [x] Instalar e configurar React Hook Form + Zod para validação de formulários
- [x] Instalar e configurar i18next com `i18next-browser-languagedetector`
- [x] Criar estrutura de rotas: `/login`, `/root/*`, `/org/:orgId/*`, `/org/:orgId/workspace/:wsId/*`
- [x] Criar componente `ProtectedRoute` que verifica role antes de renderizar

### 3.2 Autenticação no dashboard — pré-requisito para #9, #10, #11

- [x] Implementar tela `/login` com formulário de email + senha usando React Hook Form + Zod
- [x] Implementar chamada a `POST /v1/auth/login` e armazenamento de tokens (httpOnly cookie ou localStorage com cuidados)
- [x] Implementar interceptor de requisições que renova access token automaticamente chamando `POST /v1/auth/refresh` quando `exp` está próximo
- [x] Implementar redirect automático para `/login` quando qualquer requisição retorna 401
- [x] Implementar botão de logout que chama `POST /v1/auth/logout` e limpa tokens locais

### 3.3 Painel Root — closes #9

- [x] Implementar rota `/root` protegida — redireciona para `/login` se usuário não tem role Root
- [x] Implementar listagem de orgs: tabela com nome, status, contagem de usuários, contagem de workspaces, última atividade
- [x] Implementar formulário de criação de org: campos nome e email do Org Admin inicial
- [x] Implementar modal de confirmação para suspender org
- [x] Implementar modal de confirmação para deletar org (campo de texto para confirmar o nome)
- [x] Implementar tela de configuração de cotas por org: campos para os 7 limites do PRD seção 7
- [x] Implementar listagem de sessões ativas com filtros por org e usuário
- [x] Implementar botão de revogar sessão individual com confirmação
- [x] Implementar audit log global com tabela paginada e filtros por org, período, action e result
- [x] Implementar paginação do audit log via cursor
- [x] Implementar listagem de capabilities base do catálogo global
- [x] Implementar formulário de adição de capability ao catálogo base
- [x] Implementar tela de configuração de cold storage: campos para tipo (R2/S3), bucket, credenciais
- [x] Implementar listagem de API Keys de qualquer org (navegando por org)

### 3.4 Painel Org Admin — closes #10

- [x] Implementar rota `/org/:orgId` protegida — redireciona se usuário não tem role org_admin na org
- [x] Implementar listagem de usuários: tabela com nome, email, status, último login
- [x] Implementar formulário de criação de usuário: campos email, nome, senha inicial, role
- [x] Implementar ação de suspender usuário (modal de confirmação)
- [x] Implementar ação de resetar senha do usuário (modal com campo de nova senha)
- [x] Implementar listagem de workspaces da org com link para o painel de cada um
- [x] Implementar formulário de criação de workspace
- [x] Implementar listagem de capabilities customizadas da org
- [x] Implementar formulário de criação de capability customizada (nome + descrição)
- [x] Implementar listagem de API Keys da org: publicId, scopes, description, lastUsedAt, status
- [x] Implementar formulário de criação de API Key: descrição + checkboxes de escopos
- [x] Implementar modal pós-criação de API Key: exibir secret com alerta "copie agora — não será exibido novamente"
- [x] Implementar botão de revogar API Key com confirmação
- [x] Implementar audit log da org: tabela paginada com filtros
- [x] Implementar tela de download do cold tier: seletor de período + botão "Gerar link de download"
- [x] Implementar configurações de login: toggle para email+senha, magic link, OAuth Google, OAuth GitHub
- [x] Implementar configuração de MFA: toggle obrigatório ou opt-in
- [x] Implementar configuração de expiração de JWT: campos para access token (min) e refresh token (dias)

### 3.5 Painel Workspace Admin — closes #11 (parcial)

- [x] Implementar rota `/org/:orgId/workspace/:wsId` protegida — redireciona se usuário não tem role admin no workspace
- [x] Implementar listagem de membros: tabela com nome do usuário, role, data de adição
- [x] Implementar formulário de adição de membro: seletor de usuário da org + seletor de role do workspace
- [x] Implementar ação de remover membro (modal de confirmação)
- [x] Implementar ação de trocar role do membro (seletor inline ou modal)
- [x] Implementar listagem de roles customizados do workspace: nome, capabilities atribuídas
- [x] Implementar formulário de criação de role customizado: nome + seleção de capabilities (checkboxes do catálogo)
- [x] Implementar ação de deletar role customizado (bloqueado com mensagem se há bindings ativos)
- [x] Implementar listagem de bindings: tabela com userId, role, resourceType, resourceId (ou "workspace inteiro")
- [x] Implementar formulário de criação de binding: seletor usuário + seletor role + campo resourceType + campo resourceId (opcional)
- [x] Implementar ação de revogar binding (modal de confirmação)
- [x] Implementar listagem de resource types registrados: nome, inheritsFrom, inheritanceMode
- [x] Implementar formulário de registro de resource type: nome + toggle de herança + seletor do tipo pai
- [x] Implementar audit log do workspace: tabela paginada com filtros (hot tier)

### 3.6 Playground interativo — closes #11 (com 3.5)

- [x] Implementar seletor de método HTTP (GET, POST, PATCH, DELETE) e campo de endpoint
- [x] Implementar editor de body JSON com syntax highlight
- [x] Implementar seletor de API Key da org atual para autenticar a chamada
- [x] Implementar botão "Enviar" que executa a chamada e exibe resposta com syntax highlight e badge de status HTTP
- [x] Implementar histórico de chamadas da sessão atual persistido no `sessionStorage`
- [x] Implementar botão "copy as cURL" que gera o comando curl equivalente
- [x] Implementar botão "copy as SDK call" que gera o código TypeScript equivalente usando `@gatekey/sdk`
- [x] Implementar painel de documentação inline: ao selecionar um endpoint, exibir descrição, parâmetros e exemplo de resposta

### 3.7 Integração: Dashboard ↔ Convex real-time — closes #9, #10, #11 (com 3.3–3.6)

- [x] Confirmar que listagem de usuários usa `useQuery` do Convex — atualiza sem reload
- [x] Confirmar que listagem de sessões usa `useQuery` — sessão revogada some da lista em tempo real
- [x] Confirmar que listagem de bindings usa `useQuery` — novo binding aparece instantaneamente
- [x] Confirmar que audit log usa `useQuery` — novos eventos aparecem sem refresh manual
- [x] Escrever teste manual: revogar sessão no painel Root → na aba com aquela sessão, próxima ação retorna 401

---

## Fase 4 — Auth avançado + SDK

### 4.1 Magic link — closes #12 (parcial)

- [x] Instalar e configurar Resend (`@resend/node`) como Convex Action
- [x] Implementar `POST /v1/auth/magic-link` — gera token único (32 bytes, TTL 15 min), armazena hash, envia email via Resend com link `?token=...`
- [x] Implementar `GET /v1/auth/magic-link/verify?token=...` — busca token por hash, valida TTL, invalida token, cria sessão, retorna access + refresh token
- [x] Criar tabela `magic_link_tokens` com campos: tokenHash, userId, expiresAt, usedAt
- [x] Implementar invalidação imediata do token após uso (setar `usedAt`)
- [x] Criar template HTML de email de magic link com suporte a PT-BR e EN
- [x] Selecionar idioma do template baseado em `org_settings.defaultLanguage` da org do usuário
- [x] Chamar `writeAuditEvent` com action `auth.magiclink.sent`, `auth.magiclink.used`, `auth.magiclink.expired`
- [x] Escrever teste: token expirado (TTL ultrapassado) retorna 401
- [x] Escrever teste: apresentar o mesmo token duas vezes retorna 401 na segunda

### 4.2 OAuth — Google — closes #12 (parcial)

- [ ] Registrar aplicação no Google Cloud Console e obter `clientId` e `clientSecret`
- [ ] Armazenar credenciais OAuth no Convex (variáveis de ambiente da instância)
- [ ] Implementar `GET /v1/auth/oauth/google` — redireciona para URL de consent do Google com `state` anti-CSRF
- [ ] Implementar `GET /v1/auth/oauth/google/callback` — valida `state`, troca code por tokens Google, extrai email, encontra ou cria usuário, cria sessão, redireciona com tokens
- [ ] Verificar em `org_settings.loginMethods` que OAuth Google está habilitado antes de prosseguir
- [ ] Chamar `writeAuditEvent` com action `auth.oauth.google.success` ou `auth.oauth.google.failure`

### 4.3 OAuth — GitHub — closes #12 (parcial)

- [ ] Registrar aplicação no GitHub e obter `clientId` e `clientSecret`
- [ ] Armazenar credenciais OAuth no Convex
- [ ] Implementar `GET /v1/auth/oauth/github` — redireciona para URL de consent do GitHub com `state` anti-CSRF
- [ ] Implementar `GET /v1/auth/oauth/github/callback` — valida `state`, troca code por tokens GitHub, extrai email, encontra ou cria usuário, cria sessão, redireciona com tokens
- [ ] Verificar em `org_settings.loginMethods` que OAuth GitHub está habilitado antes de prosseguir
- [ ] Chamar `writeAuditEvent` com action `auth.oauth.github.success` ou `auth.oauth.github.failure`

### 4.4 Integração: Métodos de login ↔ Configuração da org — closes #12 (com 4.1–4.3)

- [x] Alterar `POST /v1/auth/login` para consultar `org_settings.loginMethods` do usuário e rejeitar com 403 se `email_password` não está habilitado
- [x] Alterar `POST /v1/auth/magic-link` para rejeitar com 403 se `magic_link` não está habilitado na org
- [ ] Alterar callback do Google para rejeitar com 403 se `oauth_google` não está habilitado na org
- [ ] Alterar callback do GitHub para rejeitar com 403 se `oauth_github` não está habilitado na org
- [x] Escrever teste: `POST /v1/auth/login` com `loginMethods` sem `email_password` retorna 403 com reason `method_disabled`
- [x] Escrever teste: magic link enviado, org admin desabilita magic link, token ainda válido → `verify` retorna 403

### 4.5 MFA TOTP — closes #13 (parcial)

- [x] Instalar biblioteca TOTP (ex: `otpauth`) para geração e verificação
- [x] Criar tabela `mfa_configs` com campos: userId, secret (criptografado), backupCodes[], activatedAt
- [x] Implementar `POST /v1/auth/mfa/setup` — gera segredo TOTP, retorna segredo em base32 e URL de QR code (não ativa ainda)
- [x] Implementar `POST /v1/auth/mfa/verify-setup` — valida código TOTP contra segredo pendente; se válido, ativa MFA e gera 10 backup codes
- [x] Implementar `POST /v1/auth/mfa/challenge` — recebe `{mfaToken, totpCode}`, valida código com janela ±1 intervalo, emite access + refresh token
- [x] Implementar verificação de backup code: aceitar qualquer código da lista, invalidar após uso
- [x] Implementar bloqueio de acesso ao Root se MFA não configurado — redirecionar para setup no primeiro login
- [x] Implementar verificação de `org_settings.mfaRequired` — usuário sem `mfa_configs` ativo é redirecionado para setup antes de receber token
- [x] Chamar `writeAuditEvent` com action `auth.mfa.setup`, `auth.mfa.success`, `auth.mfa.failure`, `auth.mfa.backup_used`

### 4.6 Integração: MFA ↔ Fluxo de login — closes #13 (com 4.5)

- [x] Alterar `POST /v1/auth/login` — quando MFA está ativo para o usuário, não emitir access token; retornar `{mfa_required: true, mfa_token: "<temporário 5min>"}`
- [x] Alterar `GET /v1/auth/magic-link/verify` — quando MFA está ativo, retornar `{mfa_required: true, mfa_token: "<temporário>"}` ao invés de tokens finais
- [ ] Alterar callbacks OAuth — mesma lógica: retornar `mfa_required` quando MFA está ativo
- [x] Alterar dashboard: detectar `mfa_required: true` na resposta de login e exibir tela de desafio TOTP
- [x] Alterar dashboard: tela de TOTP aceita código de 6 dígitos ou backup code
- [x] Escrever teste: `POST /v1/auth/login` com MFA ativo retorna `mfa_required: true` sem access token
- [x] Escrever teste: `POST /v1/auth/mfa/challenge` com código correto retorna access + refresh token
- [x] Escrever teste: `POST /v1/auth/mfa/challenge` com código errado retorna 401

### 4.7 SDK TypeScript — @gatekey/sdk — closes #14

- [x] Inicializar pacote em `/sdk` com `package.json`, tsconfig, tsup config (dual output ESM + CJS)
- [x] Implementar classe `GatekeyClient` com construtor `({baseUrl, apiKey?})`
- [x] Implementar `client.auth.login(email, password)` — chama `POST /v1/auth/login`, armazena tokens internamente
- [x] Implementar `client.auth.refresh()` — chama `POST /v1/auth/refresh`, atualiza tokens internamente
- [x] Implementar `client.auth.logout()` — chama `POST /v1/auth/logout`, limpa tokens
- [x] Implementar interceptor de requisições internas que chama `refresh()` automaticamente quando access token está a menos de 60s de expirar
- [x] Implementar `client.auth.mfa.challenge(mfaToken, totpCode)`, `client.auth.mfa.setup(token?)`, `client.auth.mfa.verifySetup(totpCode, token?)` — fluxo MFA pós-login
- [x] Implementar `client.permissions.check(capability, resourceType?, resourceId?)` — chama `POST /v1/check`
- [x] Implementar `client.users.create(data)`, `client.users.get(id)`, `client.users.update(id, data)`, `client.users.delete(id)`
- [x] Implementar `client.roles.list()`, `client.roles.create(data)`, `client.roles.delete(id)`
- [x] Implementar `client.bindings.list(filters?)`, `client.bindings.create(data)`, `client.bindings.delete(id)`
- [x] Implementar `client.apiKeys.list()`, `client.apiKeys.create(data)`, `client.apiKeys.revoke(id)`
- [x] Tipar parâmetros de capabilities e resourceTypes com generics para autocomplete
- [x] Escrever `README.md` do SDK com: instalação, inicialização, exemplos de uso dos métodos principais

### 4.8 SDK React — @gatekey/react — closes #14 (parcial)

- [x] Inicializar pacote em `/sdk-react` com tsup, peer dependencies em `react` e `@gatekey/sdk`
- [x] Implementar `GatekeyProvider` — `React.Context` com instância de `GatekeyClient`
- [x] Implementar `useGatekey()` — hook que retorna a instância do `GatekeyClient` do contexto
- [x] Implementar `usePermission(capability, resourceType?, resourceId?)` — chama `client.permissions.check`, retorna `{allowed: boolean, loading: boolean, error: Error | null}`
- [x] Implementar `useUser()` — retorna dados do usuário autenticado atual com estado de loading
- [x] Implementar `useWorkspace(workspaceId)` — retorna dados do workspace com estado de loading
- [x] Implementar revalidação automática de `usePermission` quando bindings podem ter mudado (polling ou evento)
- [x] Escrever `README.md` do pacote com: instalação, configuração do Provider, exemplos dos 3 hooks

### 4.9 Integração: SDK ↔ API — closes #14 (com 4.7–4.8)

- [x] Escrever teste de integração do SDK contra instância real do GateKey (não mocks)
- [x] Confirmar que `client.auth.login` + `client.permissions.check` funciona end-to-end
- [x] Confirmar que refresh automático ocorre sem erro quando access token expira
- [x] Confirmar que `usePermission` retorna `{allowed: true}` com binding correto e `{allowed: false}` sem binding
- [x] Publicar `@gatekey/sdk` e `@gatekey/react` no npm (ou registry privado para testes iniciais)

### 4.10 i18n completo — closes #15

- [x] Criar arquivos `/dashboard/locales/pt-BR/common.json`, `auth.json`, `users.json`, `roles.json`, `bindings.json`, `audit.json`, `playground.json`
- [x] Criar arquivos espelho em `/dashboard/locales/en/` com as mesmas chaves
- [x] Substituir todas as strings hardcoded no dashboard por chamadas a `t('chave')`
- [x] Implementar seletor de idioma na UI (dropdown ou toggle PT-BR / EN) sem reload de página
- [x] Adicionar regra de lint (ex: `eslint-plugin-i18next`) para bloquear strings hardcoded em JSX
- [x] Confirmar que emails de magic link são enviados no idioma de `org_settings.defaultLanguage`

---

## Fase 5 — DX, cold storage e CLI

### 5.1 Audit log cold tier — closes #16 (parcial)

- [x] Criar Convex Scheduled Function `exportAuditLogs` configurada para rodar diariamente
- [x] Implementar query que retorna todos os eventos de `audit_log` com `timestamp < now - 30 days`
- [x] Implementar serialização dos eventos em formato NDJSON (uma linha JSON por evento)
- [x] Implementar compressão gzip do NDJSON resultante
- [x] Implementar upload para Cloudflare R2 usando a SDK `@cloudflare/workers-types` — path: `{orgId}/{YYYY}/{MM}/{DD}/logs.ndjson.gz`
- [ ] Implementar upload alternativo para AWS S3 usando `@aws-sdk/client-s3` — mesmo particionamento
- [ ] Implementar lógica de escolha R2 vs S3 baseada na configuração `cold_storage_provider` da instância
- [x] Registrar cada exportação na tabela `audit_exports` com orgId, período e storagePath
- [x] Implementar alerta no dashboard quando `cold_storage_provider` não está configurado e existem logs com mais de 25 dias
- [x] Escrever teste: Scheduler exporta eventos com mais de 30 dias, eventos recentes permanecem no hot tier

### 5.2 Integração: Cold tier ↔ Dashboard — closes #16 (com 5.1)

- [x] Implementar `GET /v1/audit-exports?start=YYYY-MM-DD&end=YYYY-MM-DD` — localiza arquivo no cold tier, gera URL pré-assinada com TTL de 15 min, retorna link; PEP requer `audit:read`
- [x] Implementar tela no painel Org Admin: date pickers para selecionar período + botão "Gerar link de download"
- [ ] Implementar tela equivalente no painel Root para qualquer org
- [x] Implementar feedback visual quando link é gerado (copiar para clipboard + contador de expiração)
- [ ] Confirmar que URL pré-assinada retorna 403 após 15 minutos de expiração

### 5.3 CLI gatekey init — closes #17 (parcial)

- [ ] Inicializar projeto CLI em `/cli` com TypeScript e `@clack/prompts` (ou Inquirer)
- [ ] Implementar prompt interativo: nome da instância
- [ ] Implementar prompt: Convex deployment URL — validar com requisição de health check antes de aceitar
- [ ] Implementar prompt: Convex deploy key (input mascarado)
- [ ] Implementar prompt: tipo de cold storage com opções R2 / S3 / skip
- [ ] Implementar prompts condicionais de cold storage: bucket, região, credenciais (exibidos apenas se não skippado)
- [ ] Implementar prompt: email do Root
- [ ] Implementar prompt: senha do Root (input mascarado + confirmação)
- [ ] Implementar step `deploySchema` — executa deploy do schema Convex usando a deploy key fornecida
- [ ] Implementar step `generateKeyPair` — chama `initializeKeyPair` Convex Action
- [ ] Implementar step `createRootUser` — chama mutation de criação de Root com hash bcryptjs
- [ ] Implementar step `saveEnvConfig` — grava variáveis de ambiente da instância em `.env.gatekey`
- [ ] Implementar step `configureColdStorage` — salva configurações de bucket na instância (quando não skippado)
- [ ] Gravar credenciais root em `.gatekey-root` (formato JSON ou dotenv)
- [ ] Exibir mensagem de aviso explícita: "Adicione `.gatekey-root` ao seu `.gitignore` imediatamente"
- [ ] Implementar idempotência: se Root já existe, perguntar antes de sobrescrever
- [ ] Testar `npx gatekey init` do zero em ambiente limpo sem nenhuma configuração prévia

### 5.4 Integração: CLI ↔ Schema + JWT + Root — closes #17 (com 5.3)

- [ ] Confirmar que o schema deployado pelo CLI é idêntico ao usado em desenvolvimento (mesma fonte de verdade)
- [ ] Confirmar que o par RS256 gerado pelo CLI é o mesmo consultado por `signJwt` e `verifyJwt` em runtime
- [ ] Confirmar que o usuário Root criado pelo CLI consegue fazer login no dashboard com as credenciais salvas em `.gatekey-root`
- [ ] Escrever teste E2E de setup completo: `gatekey init` → login → criação de org → criação de workspace → criação de usuário → binding → `/check` retorna ALLOW

### 5.5 OpenAPI + testes de integração E2E — closes #18 (parcial)

- [ ] Configurar geração automática de OpenAPI a partir das anotações/schemas dos HTTP Actions (ex: `zod-openapi` ou similar)
- [ ] Servir documentação em `/v1/docs` como Swagger UI em ambiente de desenvolvimento
- [ ] Vincular URL de documentação ao Playground interativo do dashboard
- [ ] Escrever teste E2E: login com email+senha → criar binding → `POST /v1/check` retorna `{allowed: true}`
- [ ] Escrever teste E2E: criar binding → deletar binding → `POST /v1/check` retorna `{allowed: false}`
- [ ] Escrever teste E2E: atingir cota de usuários → próxima criação retorna `QuotaExceeded` com campos corretos
- [ ] Escrever teste E2E: atingir cota de workspaces → idem
- [ ] Escrever teste E2E: atingir cota de roles → idem
- [ ] Escrever teste E2E: atingir cota de capabilities → idem
- [ ] Escrever teste E2E: atingir cota de sessões → idem
- [ ] Escrever teste E2E: atingir cota de API Keys → idem
- [ ] Escrever teste E2E: API Key com escopo `bindings:write` pode criar binding mas não pode chamar `users:write`
- [ ] Escrever teste E2E: revogar sessão → requisição seguinte com o JWT daquela sessão retorna 401
- [ ] Configurar CI (GitHub Actions) para executar todos os testes em cada push para main

### 5.6 Integração final: GPL + README de self-hosting — closes #18 (com 5.5)

- [ ] Adicionar arquivo `LICENSE` com texto completo da GPL-3.0
- [ ] Adicionar header SPDX de licença GPL nos arquivos fonte principais do backend, dashboard, SDK e CLI
- [ ] Escrever `README.md` na raiz com seções: visão geral, pré-requisitos (Node, Convex CLI), `npx gatekey init`, primeiro login no dashboard, configuração de cold storage
- [ ] Documentar no README como integrar `@gatekey/sdk` em uma app cliente: instalação, inicialização, exemplo de `permissions.check`
- [ ] Documentar no README como usar `@gatekey/react`: Provider, `usePermission` com exemplo de guard de componente
- [ ] Documentar no README como usar o Playground para explorar e testar a API
- [ ] Revisar README para garantir que qualquer desenvolvedor consegue rodar uma instância do zero seguindo apenas o documento
