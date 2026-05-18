# GateKey — Tasks (issues #19–#37)

> Continuação de TASKS.md. Ordenadas por dependência. Seções marcadas com **"Integração:"** são pontos de conexão entre subsistemas — devem ser revisadas sempre que os dois lados estiverem prontos.

---

## Fase 6 — Batch check, Effective Access e Simulate

### 6.1 POST /v1/check/batch — closes #19

- [x] Escrever teste unitário: `checkBatch([])` com array vazio retorna array vazio
- [x] Escrever teste unitário: `checkBatch` com item cujo usuário está suspenso retorna `{allowed: false, reason: "user_inactive"}` naquele índice
- [x] Escrever teste unitário: `checkBatch` com item sem binding retorna `{allowed: false, reason: "no_binding_found"}` naquele índice
- [x] Escrever teste unitário: `checkBatch` com item com binding válido retorna `{allowed: true}` naquele índice
- [x] Escrever teste unitário: falha em um item não interrompe o processamento dos demais
- [x] Criar função `checkBatch(items: CheckRequest[])` em `convex/checkBatch.ts` — itera sobre o array chamando `pdpDecide` para cada item, retorna array de `{allowed, reason, source}` na mesma ordem
- [x] Garantir que `checkBatch` retorna resultados **na mesma ordem** do array de entrada mesmo com processamento paralelo
- [x] Chamar `writeAuditEvent` para cada item do batch com o resultado individual (action: `permission.check`, result: allow/deny, reason)
- [x] Registrar rota `POST /v1/check/batch` em `convex/http.ts` apontando para handler que chama `checkBatch`
- [x] Aplicar PEP na rota `POST /v1/check/batch` exigindo escopo `check` (mesma regra do `/check` singular)
- [x] Adicionar preflight CORS para `POST /v1/check/batch` em `convex/http.ts`
- [x] Adicionar schema Zod de validação do body: array de objetos `{userId, capability, resourceType, resourceId?}` com no mínimo 1 item e no máximo 100
- [x] Retornar 422 com mensagem clara quando body não passa na validação Zod (array vazio, excede 100 itens, campo obrigatório ausente)
- [x] Atualizar spec OpenAPI em `convex/openapi.ts` com documentação do endpoint `/check/batch`: descrição, body schema, response schema, exemplos
- [x] Escrever teste de integração: batch com 3 itens — primeiro ALLOW, segundo DENY por falta de binding, terceiro DENY por usuário suspenso — verificar cada resultado individualmente
- [x] Escrever teste de integração: API Key com escopo `["users:read"]` (sem `check`) recebe 403 ao chamar `POST /v1/check/batch`
- [x] Escrever teste de integração: batch de 1 item com binding de herança de container — retorna `{allowed: true, source: "container-binding"}`
- [x] Escrever teste de integração: 3 chamadas ao audit log são registradas para um batch de 3 itens

### 6.2 GET /v1/users/:id/effective-access — closes #20

- [x] Escrever teste unitário: `computeEffectiveAccess(userId, workspaceId)` para usuário sem nenhum binding retorna `{workspaceAccess: null, resourceAccess: []}`
- [x] Escrever teste unitário: binding de workspace-level resulta em `{workspaceAccess: {role, source: "workspace-binding"}, resourceAccess: []}`
- [x] Escrever teste unitário: binding direto em resource retorna entrada em `resourceAccess` com `source: "direct-binding"`
- [x] Escrever teste unitário: binding em container com `inheritanceMode: "auto"` resulta em entrada de item filho com `source: "inherited-from-folder:<containerId>"`
- [x] Escrever teste unitário: deny binding em resource retorna entrada com `effectiveRole: null, source: "explicit-deny", deniedBy: <adminId>`
- [x] Escrever teste unitário: binding com `expiresAt` no passado é excluído dos resultados
- [x] Escrever teste unitário: deny em container-level aparece em `resourceAccess` de cada item filho do container
- [x] Escrever teste unitário: usuário com binding exclusivamente em resource-level (sem workspace binding) — `workspaceAccess: null` e apenas o recurso específico em `resourceAccess`
- [x] Criar função `computeEffectiveAccess({userId, workspaceId})` em `convex/effectiveAccess.ts` — passo 1: coleta binding de workspace-level do usuário, se existir inclui em `workspaceAccess`
- [x] Implementar passo 2 em `computeEffectiveAccess`: coleta todos os allow bindings do usuário no workspace (resource-level e container-level) via índice `bindings_by_workspace_user`
- [x] Implementar passo 3 em `computeEffectiveAccess`: coleta todos os deny bindings do usuário no workspace (todos os níveis) via índice `bindings_by_workspace_user` com filtro `type: "deny"`
- [x] Implementar passo 4 em `computeEffectiveAccess`: para cada allow binding com `expiresAt` não-nulo, descarta se `expiresAt < Date.now()`
- [x] Implementar passo 5 em `computeEffectiveAccess`: para cada allow binding em container-level, busca todos os recursos filhos via `resource_types.inheritsFrom` e gera entradas com `source: "inherited-from-<type>:<containerId>"`
- [x] Implementar passo 6 em `computeEffectiveAccess`: aplica deny-first — para cada recurso na lista, se existe deny binding ativo que cobre aquele recurso (resource-level, container-level ou workspace-level), sobrescreve com `{effectiveRole: null, source: "explicit-deny", deniedBy}`
- [x] Implementar resolução de `source` para cada entrada: `"direct-binding"`, `"inherited-from-<type>:<parentId>"`, `"workspace-binding"`, `"explicit-deny"`
- [x] Registrar rota `GET /v1/users/:id/effective-access` em `convex/http.ts` no handler do pathPrefix `/v1/users/` — detectar segmento `effective-access` no pathname
- [x] Aplicar PEP na rota: acessível por Workspace Admin (do workspace no query param), Org Admin da org, e Root; bloquear Members
- [x] Validar query param `workspaceId` obrigatório — retornar 400 se ausente
- [x] Adicionar preflight CORS para o novo path
- [x] Atualizar spec OpenAPI com documentação de `GET /v1/users/:id/effective-access`: descrição, query params, response schema com todos os campos incluindo `source` e `deniedBy`
- [x] Escrever teste de integração: usuário com binding de workspace `editor` + deny explícito em `doc_xyz` — retorna `workspaceAccess.role = "editor"` e `resourceAccess` contendo entry para `doc_xyz` com `effectiveRole: null`
- [x] Escrever teste de integração: usuário com binding de folder + inheritanceMode ativo — retorna entradas de documentos filhos com `source: "inherited-from-folder:<folderId>"`
- [x] Escrever teste de integração: binding expirado há 1 segundo não aparece no resultado
- [x] Escrever teste de integração: usuário sem workspace binding mas com allow em `doc_abc` — `workspaceAccess: null` e `resourceAccess` contém apenas `doc_abc`
- [x] Escrever teste de integração: Org Admin de org_A não consegue chamar endpoint para usuário de org_B
- [x] Escrever teste de integração: Member chamando endpoint recebe 403

### 6.3 POST /v1/bindings/simulate — closes #25

> **Depende de:** #20 (seção 6.2 deve estar completa)

- [x] Escrever teste unitário: `simulateBinding(binding, {userId, workspaceId})` retorna `{before, after, delta}` onde `before` e `after` são snapshots de effective-access
- [x] Escrever teste unitário: simular allow binding para usuário sem acesso — delta mostra novo recurso em `gained`
- [x] Escrever teste unitário: simular deny binding para usuário com allow — delta mostra recurso em `lost`
- [x] Escrever teste unitário: simular binding com role que o admin não possui retorna erro 403 (`no_privilege_escalation`)
- [x] Escrever teste unitário: nenhum binding é persistido após chamada — verificar que `bindings` table permanece inalterada
- [x] Criar função `simulateBinding(proposedBinding, context)` em `convex/bindingsSimulate.ts` — passo 1: aplica regra de no-privilege-escalation (mesmo check do `POST /v1/bindings`); retorna 403 se admin não possui todas as capabilities do role proposto
- [x] Implementar passo 2 em `simulateBinding`: chama `computeEffectiveAccess` para obter estado `before`
- [x] Implementar passo 3 em `simulateBinding`: cria binding **em memória** (sem persistir) e recalcula effective-access com o binding hipotético incluído
- [x] Implementar passo 4 em `simulateBinding`: calcula `delta.gained` — recursos/capabilities presentes em `after` mas não em `before`
- [x] Implementar passo 5 em `simulateBinding`: calcula `delta.lost` — recursos/capabilities presentes em `before` mas não em `after` (relevante para deny simulation)
- [x] Garantir que `simulateBinding` **não chama** `writeAuditEvent` — simulações não geram eventos de audit
- [x] Retornar `{simulated: true, before: EffectiveAccess, after: EffectiveAccess, delta: {gained: [], lost: []}}` no response
- [ ] Registrar rota `POST /v1/bindings/simulate` em `convex/http.ts`
- [ ] Aplicar PEP na rota: mesmos requisitos de autorização do `POST /v1/bindings` (bindings:write scope)
- [ ] Adicionar preflight CORS para `/v1/bindings/simulate`
- [ ] Atualizar spec OpenAPI com documentação de `POST /v1/bindings/simulate`: nota de "dry-run — nenhum dado é persistido", body schema idêntico ao `POST /v1/bindings`, response schema com `simulated`, `before`, `after`, `delta`
- [ ] Escrever teste de integração: simular allow binding → verificar `delta.gained` contém o recurso → verificar que nenhum binding existe na tabela após a chamada
- [ ] Escrever teste de integração: simular deny binding sobre recurso que usuário tinha allow → verificar `delta.lost` contém o recurso
- [ ] Escrever teste de integração: admin tenta simular binding com capability que não possui → recebe 403 com reason `cannot_grant_capability`

---

## Fase 7 — Root impersonation

### 7.1 Backend — impersonation token e endpoints — closes #21 (parcial)

- [ ] Escrever teste unitário: `createImpersonationToken(rootUserId, targetUserId)` retorna JWT com claims `sub: rootUserId`, `impersonating: targetUserId`, `exp: now + 1h`
- [ ] Escrever teste unitário: impersonation token contém claim `actor.type: "root_impersonating"`
- [ ] Escrever teste unitário: `verifyImpersonationToken(token)` retorna o contexto de impersonation correto
- [ ] Escrever teste unitário: impersonation token expirado (exp no passado) é rejeitado por `verifyImpersonationToken`
- [ ] Adicionar tabela `impersonation_sessions` ao schema Convex com campos: id, rootUserId, targetUserId, tokenHash, createdAt, expiresAt, endedAt
- [ ] Criar índice em `impersonation_sessions` por `rootUserId` e por `targetUserId`
- [ ] Implementar função `createImpersonationToken({rootUserId, targetUserId})` em `convex/impersonation.ts` — gera JWT de impersonation com TTL de 1h, armazena hash na tabela, retorna o token plaintext
- [ ] Implementar função `endImpersonationSession(impersonationSessionId)` — marca `endedAt` na tabela, invalida o token
- [ ] Implementar verificação no PEP: quando `Authorization` contém token de impersonation (detectar pelo claim `actor.type`), extrair `targetUserId` como `userId` efetivo e `rootUserId` como actor para audit
- [ ] Implementar `POST /v1/impersonation/start` em `convex/http.ts` — aceita `{targetUserId}`, verifica que caller é Root, chama `createImpersonationToken`, retorna `{impersonationToken, expiresAt}`
- [ ] Implementar `POST /v1/impersonation/end` em `convex/http.ts` — aceita `{impersonationSessionId}`, verifica que caller é Root, chama `endImpersonationSession`, retorna 200
- [ ] Aplicar PEP em ambos os endpoints acima exigindo role Root
- [ ] Adicionar preflight CORS para `/v1/impersonation/start` e `/v1/impersonation/end`
- [ ] Implementar `writeAuditEvent` com `actor.type: "root_impersonating"` e campo `actor.impersonating: targetUserId` em **toda** action executada com token de impersonation — garantir que o `actorId` no audit log é sempre o rootUserId, nunca o targetUserId
- [ ] Garantir que o audit log do targetUserId **não** mostra ações feitas pelo Root em modo de impersonation
- [ ] Escrever teste de integração: Root inicia impersonation → executa ação → audit log mostra `actor.type: "root_impersonating"` com `actor.impersonating: targetUserId`
- [ ] Escrever teste de integração: após `POST /v1/impersonation/end`, o token de impersonation retorna 401
- [ ] Escrever teste de integração: usuário não-Root tentando chamar `POST /v1/impersonation/start` recebe 403
- [ ] Escrever teste de integração: token de impersonation expirado (TTL 1h vencido) retorna 401

### 7.2 Dashboard — banner de impersonation — closes #21 (com 7.1)

- [ ] Escrever teste de componente: `ImpersonationBanner` renderiza com nome do usuário impersonado quando `impersonating` prop é fornecida
- [ ] Escrever teste de componente: `ImpersonationBanner` não renderiza quando `impersonating` prop é nula
- [ ] Escrever teste de componente: clicar em "Encerrar impersonation" no banner chama `onEnd` callback
- [ ] Criar componente `ImpersonationBanner` em `dashboard/src/components/root/impersonation-banner.tsx` — exibe "Você está agindo como [nome do usuário] — [Encerrar]" usando `--gate-danger` como cor de fundo
- [ ] Garantir que `ImpersonationBanner` é não-dismissível (sem botão de fechar; apenas o botão "Encerrar" encerra a sessão)
- [ ] Adicionar estado `impersonationSession: {token, targetUser, expiresAt} | null` ao contexto de autenticação do dashboard (`dashboard/src/lib/auth-context.tsx` ou equivalente)
- [ ] Implementar função `startImpersonation(targetUserId)` no contexto de auth — chama `POST /v1/impersonation/start`, armazena token e dados no contexto
- [ ] Implementar função `endImpersonation()` no contexto de auth — chama `POST /v1/impersonation/end`, limpa estado de impersonation, restaura sessão original do Root
- [ ] Renderizar `ImpersonationBanner` no layout raiz (`dashboard/src/routes/__root.tsx`) quando `impersonationSession !== null` — visível em todas as rotas
- [ ] Adicionar botão "Entrar como" na listagem de usuários do painel Root — chama `startImpersonation(userId)`
- [ ] Escrever teste de integração no dashboard: Root clica "Entrar como" → banner aparece com nome do usuário → Root clica "Encerrar" → banner desaparece e sessão Root é restaurada
- [ ] Escrever teste: navegação entre rotas diferentes mantém o banner visível sem remontagem

### Integração: Impersonation backend ↔ dashboard — closes #21 (com 7.1 e 7.2)

- [ ] Confirmar que o token de impersonation é usado nos headers de todas as requisições do dashboard enquanto impersonation está ativo
- [ ] Confirmar que ao expirar o token de impersonation (1h), o dashboard exibe alerta e encerra a sessão automaticamente
- [ ] Confirmar que ações feitas via dashboard em modo impersonation aparecem no audit log com `actor.type: "root_impersonating"`

---

## Fase 8 — Rate limiting

### 8.1 Rate limiting — closes #22

- [ ] Escrever teste unitário: `getRateLimitKey("login", ip)` retorna string determinística `"rl:login:<ip>"`
- [ ] Escrever teste unitário: `checkRateLimit({key, limit, windowMs})` retorna `{allowed: true, remaining: N}` dentro do limite
- [ ] Escrever teste unitário: `checkRateLimit` retorna `{allowed: false, retryAfterMs: N}` quando limite atingido
- [ ] Escrever teste unitário: após `windowMs` expirar, contador é zerado e `checkRateLimit` volta a retornar `allowed: true`
- [ ] Adicionar tabela `rate_limit_counters` ao schema Convex com campos: key, count, windowStart, windowMs — com índice por `key`
- [ ] Criar função `checkRateLimit({key, limit, windowMs})` em `convex/rateLimit.ts` — lê contador atual por `key`; se `Date.now() - windowStart > windowMs`, reseta contador; se `count >= limit`, retorna `{allowed: false, retryAfterMs: windowStart + windowMs - Date.now()}`; caso contrário incrementa contador e retorna `{allowed: true, remaining: limit - count - 1}`
- [ ] Implementar `getRateLimitKey(endpoint, identifier)` — `identifier` é IP para endpoints públicos, `orgId` para endpoints autenticados
- [ ] Aplicar `checkRateLimit` no handler de `POST /v1/auth/login`: limite de 10 req/min por IP; retornar 429 com header `Retry-After: <segundos>` e body `{"error": "RateLimitExceeded", "retryAfter": <segundos>}` quando excedido
- [ ] Aplicar `checkRateLimit` no handler de `POST /v1/auth/refresh`: limite de 20 req/min por IP
- [ ] Aplicar `checkRateLimit` no handler de `POST /v1/check`: limite configurável por org (padrão: 100 req/min por orgId)
- [ ] Aplicar `checkRateLimit` no handler de `POST /v1/check/batch`: limite configurável por org (padrão: 20 req/min por orgId, batch conta como 1 requisição)
- [ ] Ler limite customizado de `org_settings.rateLimits` (novo campo) antes de aplicar — se ausente, usar limite padrão global
- [ ] Adicionar campo `rateLimits: {checkPerMin?, checkBatchPerMin?}` à tabela `org_settings` no schema — campos opcionais, null significa usar padrão global
- [ ] Registrar evento de rate-limit excedido no audit log: action `ratelimit.exceeded`, com `endpoint`, `identifier`, `limit`
- [ ] Adicionar campos de configuração de rate limit no painel Org Admin: campos numéricos para `checkPerMin` e `checkBatchPerMin` dentro da tela de org settings (`dashboard/src/components/org/org-settings.tsx`)
- [ ] Adicionar configuração de limites globais padrão no painel Root
- [ ] Escrever teste de integração: 11 chamadas consecutivas a `POST /v1/auth/login` do mesmo IP — a 11ª retorna 429 com header `Retry-After`
- [ ] Escrever teste de integração: header `Retry-After` contém valor numérico positivo (segundos até reset)
- [ ] Escrever teste de integração: org com `checkPerMin: 5` atinge limite em 5 chamadas ao `/check`; org diferente não é afetada
- [ ] Escrever teste de integração: audit log registra evento `ratelimit.exceeded` com campos corretos

---

## Fase 9 — RS256 key rotation

### 9.1 Rotação de chave RS256 — closes #23

- [ ] Escrever teste unitário: após `rotateKeyPair()`, a função `getJwks()` retorna dois objetos `keys[]` — a nova chave e a anterior
- [ ] Escrever teste unitário: `verifyJwt(token)` aceita token assinado com a chave anterior (durante período de overlap)
- [ ] Escrever teste unitário: `verifyJwt(token)` rejeita token assinado com chave mais antiga (anterior à última rotação)
- [ ] Escrever teste unitário: `verifyJwt(token)` aceita token assinado com a chave atual
- [ ] Adicionar campos `previousPrivateKey`, `previousPublicKey`, `previousKeyId`, `previousKeyCreatedAt` à tabela de key pairs em `convex/jwtStore.ts` — para armazenar a chave anterior durante o período de overlap
- [ ] Implementar função `rotateKeyPair()` em `convex/jwtStore.ts` — passo 1: lê par de chaves atual e armazena em `previousKey`; passo 2: gera novo par RS256 com `jose`; passo 3: persiste novo par como `currentKey` mantendo o par anterior em `previousKey`
- [ ] Implementar campo `keyRotationOverlapMs` na configuração (padrão: 86400000 = 24h) — após esse período, a chave anterior é removida do JWKS
- [ ] Alterar `getJwks()` em `convex/jwtStore.ts` — retornar `[currentPublicKey, previousPublicKey]` quando `previousPublicKey` existe E `Date.now() - previousKeyCreatedAt < keyRotationOverlapMs`; retornar apenas `[currentPublicKey]` quando previousKey expirou ou não existe
- [ ] Alterar `verifyJwt(token)` — tentar verificar com `currentPrivateKey` primeiro; se falhar, tentar com `previousPrivateKey` (quando existir e ainda válida); se ambas falharem, rejeitar
- [ ] Implementar endpoint `POST /v1/auth/rotate-key` em `convex/http.ts` — acessível apenas pelo Root; chama `rotateKeyPair()`; retorna `{rotatedAt, previousKeyExpiresAt, newKeyId}`
- [ ] Aplicar PEP em `POST /v1/auth/rotate-key` exigindo role Root
- [ ] Registrar evento no audit log: action `auth.key_rotated`, actor Root, campos `newKeyId` e `previousKeyId`
- [ ] Adicionar preflight CORS para `/v1/auth/rotate-key`
- [ ] Implementar Convex Scheduler que remove `previousKey` do storage após `keyRotationOverlapMs` (limpeza automática pós-overlap)
- [ ] Adicionar botão "Rotacionar chave RS256" no painel Root com modal de confirmação — exibe `newKeyId` após sucesso e aviso sobre o período de overlap de 24h
- [ ] Escrever teste de integração: Root chama `POST /v1/auth/rotate-key` → JWKS retorna 2 chaves → token antigo ainda é válido → aguardar overlap → token antigo é rejeitado
- [ ] Escrever teste de integração: usuário não-Root chama `POST /v1/auth/rotate-key` → recebe 403
- [ ] Escrever teste de integração: após rotação, novos tokens são assinados com a chave nova; `verifyJwt` os aceita
- [ ] Escrever teste de integração: JWKS retorna apenas 1 chave após `keyRotationOverlapMs` ter decorrido

---

## Fase 10 — User transfer

### 10.1 Transferência de usuário entre orgs — closes #24

- [ ] Escrever teste unitário: `transferUser({userId, targetOrgId})` retorna `{preservedBindings: N, revokedBindings: M}` onde N + M = total de bindings antes da transferência
- [ ] Escrever teste unitário: binding em workspace pertencente à `targetOrgId` é preservado após transferência
- [ ] Escrever teste unitário: binding em workspace pertencente à org original (não à `targetOrgId`) é revogado após transferência
- [ ] Escrever teste unitário: `transferUser` chamado por não-Root retorna erro de autorização
- [ ] Escrever teste unitário: `transferUser` com `targetOrgId` igual ao orgId atual do usuário retorna erro 422 com reason `already_in_org`
- [ ] Escrever teste unitário: `transferUser` com `targetOrgId` inexistente retorna 404
- [ ] Implementar função `transferUser({userId, targetOrgId, actorId})` em `convex/users.ts` — passo 1: valida que `targetOrgId` existe e está ativa
- [ ] Implementar passo 2 em `transferUser`: valida que `targetOrgId !== currentOrgId`
- [ ] Implementar passo 3 em `transferUser`: busca todos os bindings ativos do usuário via índice `bindings_by_workspace_user`
- [ ] Implementar passo 4 em `transferUser`: para cada binding, verifica se o workspace pertence à `targetOrgId` — usando lookup em `workspaces.orgId`
- [ ] Implementar passo 5 em `transferUser`: preserva bindings em workspaces da `targetOrgId`; revoga (soft-delete) bindings em workspaces que não pertencem à `targetOrgId`
- [ ] Implementar passo 6 em `transferUser`: para cada binding revogado, chama `writeAuditEvent` com action `binding.revoke`, reason `"user_transfer_cleanup"`, actorId = Root que iniciou a transferência
- [ ] Implementar passo 7 em `transferUser`: atualiza `org_members` — remove entrada antiga (orgId anterior), cria nova entrada com `targetOrgId`
- [ ] Implementar passo 8 em `transferUser`: revoga todas as sessões ativas do usuário inserindo cada `sessionId` na `session_blacklist`
- [ ] Implementar passo 9 em `transferUser`: chama `writeAuditEvent` com action `user.transfer`, target `{userId, fromOrgId, toOrgId, preservedBindings: N, revokedBindings: M}`
- [ ] Implementar `POST /v1/users/:id/transfer` em `convex/http.ts` no handler do pathPrefix `/v1/users/` — detectar segmento `transfer` no pathname
- [ ] Validar body: `{targetOrgId}` obrigatório — retornar 400 se ausente
- [ ] Aplicar PEP na rota: apenas Root pode executar transferência
- [ ] Retornar no response: `{userId, fromOrgId, toOrgId, preservedBindings: N, revokedBindings: M, sessionsRevoked: K}`
- [ ] Adicionar preflight CORS para o path de transfer
- [ ] Atualizar spec OpenAPI com documentação de `POST /v1/users/:id/transfer`
- [ ] Escrever teste de integração: usuário em org_A com 3 bindings — 2 em workspaces de org_B, 1 em workspace de org_A — transferir para org_B → 2 bindings preservados, 1 revogado, sessões revogadas
- [ ] Escrever teste de integração: após transferência, usuário consegue fazer login na org_B mas não na org_A
- [ ] Escrever teste de integração: audit log contém evento `user.transfer` + eventos individuais `binding.revoke` com reason `"user_transfer_cleanup"`
- [ ] Escrever teste de integração: Org Admin tentando chamar `POST /v1/users/:id/transfer` recebe 403

---

## Fase 11 — Dashboard: adições ao painel Root

### 11.1 Gestão global de usuários — closes #26

- [ ] Escrever teste unitário do componente `GlobalUsersList`: renderiza tabela com colunas nome, email, org, status, criado em
- [ ] Escrever teste unitário: filtro por org filtra os itens exibidos
- [ ] Escrever teste unitário: filtro por status (`active` / `suspended`) filtra os itens exibidos
- [ ] Escrever teste unitário: clicar em "Suspender" abre modal de confirmação com nome do usuário
- [ ] Escrever teste unitário: clicar em "Ver sessões" navega para view de sessões daquele usuário
- [ ] Implementar endpoint `GET /v1/users` (global, sem filtro de org obrigatório) em `convex/http.ts` — acessível apenas pelo Root; aceita query params `?orgId=&status=&from=&to=&cursor=`; retorna lista paginada com cursor
- [ ] Aplicar PEP em `GET /v1/users` exigindo role Root
- [ ] Implementar endpoint `POST /v1/users/:id/suspend-global` em `convex/http.ts` — Root suspende usuário globalmente (todos os orgs/workspaces); retorna 200
- [ ] Implementar endpoint `DELETE /v1/users/:id/sessions` em `convex/http.ts` — Root revoga todas as sessões de um usuário; insere todos os sessionIds na blacklist; retorna contagem de sessões revogadas
- [ ] Aplicar PEP nos dois endpoints acima exigindo role Root
- [ ] Adicionar preflight CORS para os novos paths
- [ ] Criar componente `GlobalUsersList` em `dashboard/src/components/root/global-users-list.tsx` — tabela paginada com colunas: nome, email, org, status (badge colorido), criado em
- [ ] Implementar filtros no componente: seletor de org, seletor de status, date pickers para data de criação
- [ ] Implementar paginação por cursor consumindo `GET /v1/users` com os filtros ativos
- [ ] Implementar ação "Suspender globalmente" por linha — abre `ConfirmDialog` com nome do usuário, ao confirmar chama `POST /v1/users/:id/suspend-global`
- [ ] Implementar ação "Revogar todas as sessões" por linha — abre `ConfirmDialog` mostrando quantas sessões serão revogadas, ao confirmar chama `DELETE /v1/users/:id/sessions`
- [ ] Implementar ação "Resetar senha" por linha — abre modal com campo de nova senha, ao confirmar chama `POST /v1/users/:id/reset-password` (endpoint já existente) e exibe a nova senha temporária
- [ ] Implementar ação "Ver sessões ativas" por linha — navega para a tela de sessões do painel Root filtrando por aquele `userId`
- [ ] Criar rota `/root/users` em `dashboard/src/routes/root/` e adicionar link de navegação no menu lateral do painel Root
- [ ] Atualizar `dashboard/src/lib/root-api.ts` com as funções: `listAllUsers(filters)`, `suspendUserGlobal(userId)`, `revokeAllUserSessions(userId)`
- [ ] Escrever teste de integração do componente: lista carrega com dados via mock da API, filtro de org atualiza resultados, ação de suspender chama endpoint correto

### 11.2 Reativar org + revogar sessões da org — closes #27

- [ ] Escrever teste unitário do componente `OrgActions`: botão "Reativar" é exibido quando `org.status === "suspended"`
- [ ] Escrever teste unitário: botão "Suspender" é exibido quando `org.status === "active"`
- [ ] Escrever teste unitário: clicar em "Revogar todas as sessões" abre modal exibindo contagem de sessões ativas
- [ ] Implementar endpoint `POST /v1/orgs/:id/reactivate` em `convex/http.ts` — Root reativa org suspensa; muda status para `active`; retorna 200
- [ ] Implementar endpoint `DELETE /v1/orgs/:id/sessions` em `convex/http.ts` — Root revoga todas as sessões de todos os usuários da org; retorna `{sessionsRevoked: N}`
- [ ] Aplicar PEP em ambos os endpoints exigindo role Root
- [ ] Registrar `writeAuditEvent` com action `org.reactivate` e `org.sessions_revoked` respectivamente
- [ ] Adicionar preflight CORS para os novos paths
- [ ] Alterar componente `OrgActions` em `dashboard/src/components/root/org-actions.tsx` — exibir botão "Reativar" quando `org.status === "suspended"` e "Suspender" quando `org.status === "active"`
- [ ] Implementar confirmação de reativação: `ConfirmDialog` com mensagem "Reativar a org [nome]? Todos os usuários recuperarão acesso imediatamente."
- [ ] Adicionar botão "Revogar todas as sessões" no menu de ações da org — abre `ConfirmDialog` mostrando "Isso encerrará N sessões ativas de todos os membros desta org."
- [ ] Atualizar `dashboard/src/lib/root-api.ts` com funções `reactivateOrg(orgId)` e `revokeOrgSessions(orgId)`
- [ ] Escrever teste de integração: suspender org → botão "Reativar" aparece → clicar → org fica ativa → botão "Suspender" aparece novamente
- [ ] Escrever teste de integração: clicar em "Revogar todas as sessões" → sessões são revogadas → usuários com sessão ativa recebem 401 na próxima request

---

## Fase 12 — Dashboard: adições ao painel Org Admin

### 12.1 Reativar usuário suspenso + remover da org — closes #28

- [ ] Escrever teste unitário do componente `UsersList` (Org Admin): botão "Reativar" visível para usuário com `status === "suspended"`
- [ ] Escrever teste unitário: botão "Suspender" visível para usuário com `status === "active"`
- [ ] Escrever teste unitário: ação "Remover da org" exibe modal com contagem de workspaces e bindings afetados
- [ ] Escrever teste unitário: ação "Remover da org" é diferente da ação "Suspender" — exibidas separadamente na UI
- [ ] Implementar endpoint `POST /v1/users/:id/reactivate` em `convex/http.ts` — Org Admin reativa usuário suspenso da própria org; muda status para `active`; preserva todos os bindings existentes (inclusive criados durante a suspensão — EC-13)
- [ ] Implementar endpoint `DELETE /v1/users/:id/org-membership` em `convex/http.ts` — Org Admin remove usuário completamente da org; revoga todos os bindings e sessões; retorna `{workspacesAffected: N, bindingsRevoked: M}`
- [ ] Aplicar PEP em ambos os endpoints: Org Admin da própria org ou Root
- [ ] Registrar `writeAuditEvent` com action `user.reactivate` e `user.removed_from_org`
- [ ] Adicionar preflight CORS para os novos paths
- [ ] Alterar componente `users-list.tsx` no painel Org Admin — adicionar botão "Reativar" condicional ao status do usuário (em paralelo ao "Suspender")
- [ ] Implementar modal de reativação: `ConfirmDialog` com "Reativar [nome]? O usuário recuperará acesso a todos os workspaces."
- [ ] Adicionar ação "Remover da org" no menu de ações por usuário (separada de "Suspender") — abre `ConfirmDialog` mostrando: N workspaces afetados, M bindings a serem revogados
- [ ] Atualizar `dashboard/src/lib/org-api.ts` com funções `reactivateUser(userId)` e `removeUserFromOrg(userId)`
- [ ] Escrever teste de integração: suspender usuário → criar binding para esse usuário durante a suspensão → reativar → verificar que os bindings (incluindo o criado durante suspensão) estão presentes
- [ ] Escrever teste de integração: remover usuário da org → usuário perde acesso a todos os workspaces → sessões são revogadas

### 12.2 Histórico de acesso por usuário — closes #29

- [ ] Escrever teste unitário do componente `UserAccessHistory`: renderiza lista de eventos de audit filtrados por userId
- [ ] Escrever teste unitário: cada linha mostra timestamp, action, resultado (ALLOW/DENY), IP
- [ ] Escrever teste unitário: filtro de data range filtra os eventos exibidos
- [ ] Escrever teste unitário: filtro de action type filtra os eventos exibidos
- [ ] Criar componente `UserAccessHistory` em `dashboard/src/components/org/user-access-history.tsx` — drawer ou modal que recebe `userId` e `orgId` como props; exibe audit log filtrado por `userId` com paginação
- [ ] Implementar colunas da tabela: data/hora, ação (badge), recurso acessado (resourceType + resourceId quando disponível), resultado (ALLOW badge verde / DENY badge vermelho), IP
- [ ] Implementar filtros dentro do componente: date pickers (início e fim), seletor de tipo de ação
- [ ] Implementar paginação via cursor reutilizando a função `listAuditLog` existente com parâmetro `userId`
- [ ] Confirmar que `GET /v1/audit-log` já suporta filtro `?userId=` — se não, adicionar suporte ao filtro na query
- [ ] Adicionar botão "Ver histórico" por linha na tabela de usuários do painel Org Admin — abre drawer `UserAccessHistory` com o userId da linha
- [ ] Atualizar `dashboard/src/lib/org-api.ts` com função `getUserAccessHistory(userId, filters)`
- [ ] Escrever teste de integração do componente: mock retorna 5 eventos, tabela renderiza 5 linhas, filtro de data atualiza dados

---

## Fase 13 — Dashboard: adições ao painel Workspace Admin

### 13.1 Deny bindings UI — closes #30

- [ ] Escrever teste unitário do componente `CreateBindingForm`: seletor de tipo exibe opções "Permitir" e "Negar"
- [ ] Escrever teste unitário: selecionar tipo "Negar" altera a cor do formulário para `--gate-danger`
- [ ] Escrever teste unitário: selecionar tipo "Negar" exibe aviso "Deny bindings têm precedência absoluta sobre qualquer allow."
- [ ] Escrever teste unitário do componente `BindingsList`: deny bindings são renderizados com badge vermelho "DENY" e em seção separada ou com estilo visual distinto dos allow bindings
- [ ] Escrever teste unitário: deny bindings nunca aparecem como "sem binding" — sempre com badge explícito
- [ ] Escrever teste unitário do componente `DenyBindingRow`: botão "Revogar deny" chama callback correto com o bindingId
- [ ] Alterar componente `create-binding-form.tsx` em `dashboard/src/components/workspace/` — adicionar campo `tipo` com RadioGroup/Select contendo opções "Permitir (allow)" e "Negar (deny)"; padrão: "Permitir"
- [ ] Aplicar estilo visual de perigo (`border-red`, `bg-gate-danger/10`) ao formulário quando tipo "Negar" está selecionado
- [ ] Exibir texto de aviso de precedência quando tipo "Negar" está selecionado
- [ ] Alterar componente `bindings-list.tsx` — separar listagem em duas seções: "Permissões (allow)" e "Exceções de acesso negado (deny)"; cada seção com seu próprio título e estilo
- [ ] Aplicar estilo de danger na linha/row de deny bindings: fundo vermelho suave, badge "DENY" em vermelho
- [ ] Garantir que deny bindings exibem o campo `reason` quando preenchido
- [ ] Garantir que deny bindings exibem `createdBy` (nome do admin) e data de criação
- [ ] Implementar botão "Revogar deny" nas linhas de deny bindings — abre `ConfirmDialog`; ao confirmar chama `DELETE /v1/bindings/:id`
- [ ] Confirmar que o endpoint `POST /v1/bindings` já aceita `type: "deny"` — se não, adicionar ao schema de validação Zod
- [ ] Confirmar que `GET /v1/bindings` já suporta filtro `?type=deny` — se não, adicionar suporte
- [ ] Atualizar `dashboard/src/lib/workspace-api.ts` com funções: `createDenyBinding(data)`, `listDenyBindings(filters)`, `revokeDenyBinding(id)`
- [ ] Escrever teste de integração: criar deny binding via formulário → aparece na seção "Exceções" com estilo vermelho → revogar → desaparece

### 13.2 Tela de acesso efetivo — closes #31

> **Depende de:** #20 (seção 6.2 deve estar completa)

- [ ] Escrever teste unitário do componente `EffectiveAccessView`: renderiza seção de workspace access quando `workspaceAccess !== null`
- [ ] Escrever teste unitário: renderiza mensagem "Sem acesso ao workspace" quando `workspaceAccess === null`
- [ ] Escrever teste unitário: recursos com `effectiveRole: null` são renderizados com badge vermelho "Acesso negado"
- [ ] Escrever teste unitário: recursos com `source: "inherited-from-folder:<id>"` exibem badge "Herdado" com link/tooltip mostrando o container pai
- [ ] Escrever teste unitário: seletor de usuário exibe apenas membros do workspace atual
- [ ] Escrever teste unitário: clicar em "Atualizar" recarrega os dados do endpoint
- [ ] Criar componente `EffectiveAccessView` em `dashboard/src/components/workspace/effective-access-view.tsx` — recebe `workspaceId` como prop; exibe seletor de usuário no topo
- [ ] Implementar seção "Acesso ao workspace inteiro": exibe role e source quando `workspaceAccess !== null`, ou "Sem binding de workspace" quando null
- [ ] Implementar tabela de recursos com colunas: tipo de recurso, ID do recurso, role efetivo, fonte da permissão, expira em
- [ ] Implementar badge de fonte: "Direto" (cinza), "Herdado de [container]" (azul), "Do workspace" (verde), "Negado explicitamente" (vermelho)
- [ ] Implementar filtro de `resourceType` acima da tabela
- [ ] Implementar tooltip/expandir ao clicar em "Herdado de [container]" mostrando a cadeia de herança
- [ ] Criar rota ou aba "Acesso Efetivo" dentro do painel Workspace Admin
- [ ] Consumir `GET /v1/users/:id/effective-access?workspaceId=...` ao selecionar um usuário
- [ ] Atualizar `dashboard/src/lib/workspace-api.ts` com função `getEffectiveAccess(userId, workspaceId)`
- [ ] Escrever teste de integração do componente: mock retorna dados com allow direto + deny + herdado → tabela exibe as 3 linhas com estilos corretos

### 13.3 Duplicar role — closes #32

- [ ] Escrever teste unitário do componente `RolesList`: botão "Duplicar" visível apenas em roles customizados (não nos roles base: owner, admin, editor, viewer)
- [ ] Escrever teste unitário: clicar em "Duplicar" chama `onDuplicate(roleId)` com o id correto
- [ ] Escrever teste unitário: após duplicação bem-sucedida, o novo role aparece na lista com nome "Cópia de [original]"
- [ ] Escrever teste unitário: duplicação respeitando cota — quando workspace está no limite de roles, exibe erro de quota
- [ ] Implementar função `duplicateRole({sourceRoleId, workspaceId})` em `convex/roles.ts` — lê capabilities do role fonte, cria novo role com nome `"Cópia de [originalName]"` e as mesmas capabilities; verifica cota `roles_per_workspace` antes de criar
- [ ] Registrar novo role com `isBase: false` e `scope: "workspace"`
- [ ] Chamar `writeAuditEvent` com action `role.duplicate`, target `{sourceRoleId, newRoleId}`, reason `"duplicated_from: <sourceRoleId>"`
- [ ] Implementar endpoint `POST /v1/roles/:id/duplicate` em `convex/http.ts` — chama `duplicateRole`; retorna o novo role criado
- [ ] Aplicar PEP exigindo role workspace_admin
- [ ] Adicionar preflight CORS para `/v1/roles/:id/duplicate`
- [ ] Adicionar botão "Duplicar" no componente `roles-list.tsx` — visível apenas para roles com `isBase: false`; ao clicar chama `POST /v1/roles/:id/duplicate`
- [ ] Após duplicação bem-sucedida, o novo role aparece na lista; nome editável inline imediatamente
- [ ] Atualizar `dashboard/src/lib/workspace-api.ts` com função `duplicateRole(roleId)`
- [ ] Escrever teste de integração: duplicar role com 3 capabilities → novo role criado com as 3 mesmas capabilities e nome "Cópia de [original]" → renomear inline
- [ ] Escrever teste de integração: tentativa de duplicar role em workspace com cota máxima retorna QuotaExceeded

---

## Fase 14 — Dashboard: UX guards

### 14.1 Guard: bloquear remoção de capability em uso — closes #33

- [ ] Escrever teste unitário: `getCapabilityUsage(capabilityId)` retorna lista de roles que usam a capability
- [ ] Escrever teste unitário: `getCapabilityUsage` retorna array vazio se capability não está em uso
- [ ] Escrever teste unitário do componente `CapabilityRow`: botão "Remover" está desabilitado quando `usedByRoles.length > 0`
- [ ] Escrever teste unitário: tooltip no botão desabilitado exibe "Usada pelos roles: [lista]"
- [ ] Escrever teste unitário: quando `usedByRoles.length === 0`, clique em "Remover" abre `ConfirmDialog` normalmente
- [ ] Implementar query Convex `getCapabilityUsage(capabilityId)` em `convex/capabilities.ts` — retorna `{roles: [{roleId, roleName, workspaceId}]}` via join `role_capabilities → roles`
- [ ] Alterar `DELETE /v1/capabilities/:id` em `convex/http.ts` — verificar `getCapabilityUsage` antes de deletar; se `roles.length > 0`, retornar 409 `{"error": "CapabilityInUse", "usedBy": [{roleId, roleName}]}`
- [ ] Alterar componente `capabilities-list-org.tsx` em `dashboard/src/components/org/` — ao carregar lista, buscar usage de cada capability e exibir contador "Usada por N roles" na linha
- [ ] Desabilitar botão "Remover" quando capability está em uso — exibir tooltip com lista dos roles
- [ ] Exibir links para os roles na tooltip para facilitar navegação e atualização
- [ ] Atualizar `dashboard/src/lib/org-api.ts` com função `getCapabilityUsage(capabilityId)`
- [ ] Escrever teste de integração: criar capability → atribuir a role → tentar deletar capability → recebe 409 com lista dos roles → remover de todos os roles → tentar deletar novamente → sucesso

### 14.2 Guard: bloquear remoção de role em uso — closes #34

- [ ] Escrever teste unitário: `getRoleUsage(roleId)` retorna lista de usuários que têm o role atribuído
- [ ] Escrever teste unitário: `getRoleUsage` retorna array vazio se role não está atribuído a nenhum usuário
- [ ] Escrever teste unitário do componente `RoleRow`: botão "Deletar" está desabilitado quando `usedByUsers.length > 0`
- [ ] Escrever teste unitário: tooltip exibe lista de usuários que precisam ser migrados
- [ ] Implementar query Convex `getRoleUsage(roleId)` em `convex/roles.ts` — retorna `{users: [{userId, userName, email}]}` via join `bindings → users` (onde binding.roleId = roleId)
- [ ] Confirmar que `DELETE /v1/roles/:id` já retorna 409 quando há bindings ativos — se sim, garantir que o body do 409 inclui `{error: "RoleInUse", usedBy: [{userId, userName}]}`; se não, implementar
- [ ] Alterar componente `roles-list.tsx` em `dashboard/src/components/workspace/` — ao carregar lista, buscar usage de cada role customizado e exibir contador "Atribuído a N usuários"
- [ ] Desabilitar botão "Deletar" quando role está em uso — exibir tooltip com lista dos usuários afetados e instrução para reatribuí-los primeiro
- [ ] Atualizar `dashboard/src/lib/workspace-api.ts` com função `getRoleUsage(roleId)`
- [ ] Escrever teste de integração: criar role customizado → atribuir a 2 usuários → tentar deletar → recebe 409 com lista dos usuários → reatribuir ambos a outro role → deletar → sucesso

### 14.3 Guard: alertar ao editar capabilities de role com usuários ativos — closes #35

- [ ] Escrever teste unitário: `getRoleUsageCount(roleId)` retorna número de usuários com o role atribuído
- [ ] Escrever teste unitário: `getRoleUsageCount` retorna 0 se nenhum usuário tem o role
- [ ] Escrever teste unitário do componente `EditRoleForm`: submeter o formulário quando `usageCount > 0` exibe `ConfirmDialog` antes de salvar
- [ ] Escrever teste unitário: `ConfirmDialog` exibe mensagem com o count correto: "Esta alteração afeta 3 usuário(s) imediatamente."
- [ ] Escrever teste unitário: submeter o formulário quando `usageCount === 0` salva diretamente sem dialog
- [ ] Implementar query Convex `getRoleUsageCount(roleId)` em `convex/roles.ts` — retorna apenas o número (count) de bindings ativos para aquele role
- [ ] Alterar componente `create-role-form.tsx` em modo de edição em `dashboard/src/components/workspace/` — antes de submeter o `PATCH /v1/roles/:id`, chamar `getRoleUsageCount`
- [ ] Se count > 0: exibir `ConfirmDialog` com mensagem "Esta alteração afeta [N] usuário(s) imediatamente. As novas capabilities entram em vigor assim que confirmar. Deseja continuar?"; opções: "Cancelar" e "Confirmar alteração"
- [ ] Se count === 0: submeter diretamente sem dialog
- [ ] Garantir que o `ConfirmDialog` é exibido apenas quando **capabilities** são alteradas (não apenas nome/descrição do role)
- [ ] Atualizar `dashboard/src/lib/workspace-api.ts` com função `getRoleUsageCount(roleId)`
- [ ] Escrever teste de integração do componente: role com 2 usuários → editar capabilities → dialog aparece com "2 usuário(s)" → confirmar → role é salvo

### 14.4 Guard: alertar ao desativar herança de resource type — closes #36

- [ ] Escrever teste unitário: `getInheritanceDependencyCount({resourceType, workspaceId})` retorna número de usuários que dependem da herança para acessar itens daquele tipo
- [ ] Escrever teste unitário: retorna 0 quando inheritanceMode já está desativado ou nenhum usuário depende de herança
- [ ] Escrever teste unitário do componente `ResourceTypeRow`: toggle/botão de desativar herança quando `dependencyCount > 0` exibe `ConfirmDialog` antes de salvar
- [ ] Escrever teste unitário: `ConfirmDialog` exibe "X usuário(s) perderão acesso a itens herdados do container"
- [ ] Implementar query Convex `getInheritanceDependencyCount({resourceType, workspaceId})` em `convex/resourceTypes.ts` — conta bindings de container-level para aquele resourceType nos quais não existe binding direto equivalente no item filho (ou seja, usuários que dependem exclusivamente da herança)
- [ ] Alterar componente `resource-types-list.tsx` em `dashboard/src/components/workspace/` — ao clicar em "Desativar herança" ou alterar `inheritanceMode` para `null`, chamar `getInheritanceDependencyCount`
- [ ] Se count > 0: exibir `ConfirmDialog` com mensagem "Desativar herança fará [N] usuário(s) perderem acesso a itens que só acessavam via container. Bindings diretos não são afetados. Confirmar?" — opções: "Cancelar" e "Desativar herança"
- [ ] Se count === 0: aplicar a alteração diretamente sem dialog
- [ ] Atualizar `dashboard/src/lib/workspace-api.ts` com função `getInheritanceDependencyCount(resourceType, workspaceId)`
- [ ] Escrever teste de integração: registrar resource type com herança → criar binding de container para usuário → desativar herança → dialog aparece → confirmar → usuário perde acesso ao item filho

### 14.5 Guard: impedir adicionar usuário de fora da org ao workspace — closes #37

- [ ] Escrever teste unitário: `isUserInOrg(userId, orgId)` retorna true se usuário pertence à org
- [ ] Escrever teste unitário: `isUserInOrg` retorna false se usuário não pertence à org
- [ ] Escrever teste unitário do componente `AddMemberForm`: campo de seleção de usuário exibe apenas usuários da mesma org do workspace
- [ ] Escrever teste unitário: se um `userId` de fora da org for passado diretamente (ex: via URL tampering), o formulário exibe erro antes de submeter
- [ ] Confirmar que endpoint de adição de membro ao workspace já verifica se o usuário pertence à org — se não, adicionar validação: buscar `workspace.orgId`, verificar se `userId` tem entrada em `org_members` daquela org; se não, retornar 400 `{"error": "UserNotInOrg", "message": "User does not belong to this organization. Ask the Org Admin to add them first."}`
- [ ] Alterar a query de busca de usuários no componente `add-member-form.tsx` em `dashboard/src/components/workspace/` — garantir que a API chamada para popular o seletor de usuários filtra por `orgId` do workspace
- [ ] Adicionar validação client-side antes de submeter o formulário: verificar que `selectedUserId` pertence à org; se não (inconsistência), exibir erro inline "Este usuário não pertence a esta organização. Peça ao Org Admin que o adicione à org primeiro antes de adicioná-lo ao workspace."
- [ ] Garantir que a mensagem de erro do backend (400 `UserNotInOrg`) é tratada e exibida adequadamente no componente quando retornada
- [ ] Escrever teste de integração: tentar adicionar membro com userId de outra org → recebe 400 com reason `UserNotInOrg` e mensagem orientando o passo correto
- [ ] Escrever teste de integração: seletor de usuários no formulário não lista usuários de outras orgs — apenas usuários da org do workspace aparecem nas opções
