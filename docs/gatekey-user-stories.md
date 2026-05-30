# GateKey — User Stories

> **Versão:** 0.1  
> **Formato:** Como [persona], quero [ação], para [objetivo]  
> **Status:** Em revisão — edge cases a confirmar

---

## Persona 1 — Root (superadmin global)

### Gestão de orgs

- [ ] **US-001** Como Root, quero criar uma nova org com nome, slug e admin inicial, para que o cliente possa começar a usar o sistema imediatamente após o setup.
- [ ] **US-002** Como Root, quero suspender uma org inteira, para que todos os logins e acessos daquela org sejam bloqueados instantaneamente sem deletar dados.
- [ ] **US-003** Como Root, quero reativar uma org suspensa, para que o acesso seja restaurado sem precisar reconfigurar nada.
- [ ] **US-004** Como Root, quero deletar permanentemente uma org, para que todos os dados (usuários, workspaces, bindings, logs) sejam removidos ou arquivados.
- [ ] **US-005** Como Root, quero ver um painel com todas as orgs ativas, suspensas e deletadas, com métricas de uso (usuários, workspaces, última atividade), para ter visibilidade global da instância.
- [ ] **US-006** Como Root, quero configurar cotas por org (usuários, workspaces, sessions ativas, API Keys), para controlar o uso de recursos por cliente.

### Impersonation (agir como outra entidade)

- [ ] **US-007** Como Root, quero entrar em qualquer org como se fosse seu admin, para diagnosticar problemas sem precisar das credenciais do cliente. ⚠️ *Edge case: isso precisa ser registrado no audit log com flag especial `impersonation: true`.*
- [ ] **US-008** Como Root, quero entrar em qualquer workspace como membro com permissão plena, para verificar configurações de roles e bindings diretamente.
- [ ] **US-009** Como Root, quando estiver em modo de impersonation, quero ver um banner persistente indicando que estou agindo como outra entidade, para não confundir ações reais com ações de diagnóstico. ⚠️ *Edge case: ações feitas em modo impersonation devem ser atribuídas ao Root no audit log, não ao usuário impersonado.*
- [ ] **US-010** Como Root, quero encerrar o modo de impersonation a qualquer momento e retornar à minha sessão original, sem perder contexto.

### Gestão global de usuários

- [ ] **US-011** Como Root, quero ver todos os usuários da instância com filtros por org, workspace, status e data de criação, para ter visibilidade completa.
- [ ] **US-012** Como Root, quero criar um usuário e já vinculá-lo a uma org e workspace com um role específico, para onboarding direto sem precisar trocar de painel.
- [ ] **US-013** Como Root, quero suspender um usuário globalmente, para que ele perca acesso a todas as orgs e workspaces simultaneamente.
- [ ] **US-014** Como Root, quero revogar todas as sessões ativas de um usuário específico, para forçar logout imediato em todos os dispositivos. ⚠️ *Edge case: sessões já expiradas não devem aparecer como ativas — o sistema precisa limpar a blacklist regularmente.*
- [ ] **US-015** Como Root, quero ver todas as sessões ativas de um usuário (dispositivo, IP, última atividade), para detectar acesso suspeito.
- [ ] **US-016** Como Root, quero resetar a senha de qualquer usuário gerando um token temporário, sem precisar conhecer a senha atual.
- [ ] **US-017** Como Root, quero transferir um usuário de uma org para outra, preservando ou descartando seus bindings anteriores.  ⚠️ *Edge case: o que acontece com bindings em workspaces que não existem na nova org?*

### Gestão de capabilities base

- [ ] **US-018** Como Root, quero adicionar novas capabilities ao catálogo base global, para que todas as orgs possam usá-las.
- [ ] **US-019** Como Root, quero deprecar uma capability base sem deletá-la, para que orgs que já a usam não quebrem mas novas orgs não possam atribuí-la.
- [ ] **US-020** Como Root, quero ver quais orgs e roles estão usando uma capability específica antes de removê-la, para avaliar o impacto.

### Sessões e segurança global

- [ ] **US-021** Como Root, quero revogar todas as sessões de uma org inteira de uma vez, para resposta a incidente de segurança.
- [ ] **US-022** Como Root, quero ver um feed global de eventos de segurança (falhas de autenticação, revogações, impersonations) em tempo real.
- [ ] **US-023** Como Root, quero configurar o número máximo de tentativas de login antes do bloqueio temporário, globalmente e por org.
- [ ] **US-024** Como Root, quero ver o audit log completo de qualquer org, filtrado por período, tipo de evento e usuário.

---

## Persona 2 — Org Admin

### Gestão de usuários da org

- [ ] **US-025** Como Org Admin, quero criar um novo usuário na minha org informando nome, email e senha temporária, para que ele possa fazer login sem self-service.
- [ ] **US-026** Como Org Admin, quero criar um usuário e já atribuir um role em um workspace específico, para onboarding em uma operação só.
- [ ] **US-027** Como Org Admin, quero listar todos os usuários da minha org com seus workspaces e roles, para ter visão completa de quem tem acesso a quê.
- [ ] **US-028** Como Org Admin, quero suspender um usuário da minha org, bloqueando acesso a todos os workspaces dela, sem afetar outros dados.
- [ ] **US-029** Como Org Admin, quero reativar um usuário suspenso, restaurando todos os bindings anteriores.  ⚠️ *Edge case: bindings criados depois da suspensão e antes da reativação devem ser preservados.*
- [ ] **US-030** Como Org Admin, quero remover um usuário da org completamente, para que todos os bindings e sessões sejam encerrados.  ⚠️ *Edge case: o que acontece com recursos criados pelo usuário? O sistema deve transferir ownership ou apenas revogar acesso?*
- [ ] **US-031** Como Org Admin, quero ver o histórico de acesso de um usuário específico (logins, ações, recursos acessados), para auditoria interna.
- [ ] **US-032** Como Org Admin, quero resetar a senha de um usuário da minha org gerando um link temporário.

### Gestão de workspaces

- [ ] **US-033** Como Org Admin, quero criar um novo workspace dentro da minha org, definindo nome e descrição.
- [ ] **US-034** Como Org Admin, quero suspender um workspace, bloqueando acesso de todos os membros sem deletar dados.
- [ ] **US-035** Como Org Admin, quero deletar um workspace, sabendo exatamente o que será removido (bindings, roles customizados, resource types).  ⚠️ *Edge case: o sistema deve exigir confirmação explícita listando o impacto.*
- [ ] **US-036** Como Org Admin, quero adicionar um usuário existente da org a um workspace com um role específico.
- [ ] **US-037** Como Org Admin, quero remover um usuário de um workspace sem removê-lo da org.
- [ ] **US-038** Como Org Admin, quero ver todos os workspaces da minha org com métricas (membros, roles customizados, última atividade).

### Capabilities customizadas

- [ ] **US-039** Como Org Admin, quero criar capabilities customizadas para minha org (ex: `pipeline:deploy`), para modelar permissões do meu domínio específico.
- [ ] **US-040** Como Org Admin, quero listar todas as capabilities disponíveis (base + customizadas da minha org), para saber o que posso atribuir a roles.
- [ ] **US-041** Como Org Admin, quero remover uma capability customizada.  ⚠️ *Edge case: o sistema deve bloquear remoção se a capability ainda está atribuída a algum role — e indicar quais roles precisam ser atualizados primeiro.*

### Configurações da org

- [ ] **US-042** Como Org Admin, quero configurar quais métodos de login são permitidos na minha org (email+senha, magic link, OAuth).
- [ ] **US-043** Como Org Admin, quero exigir MFA para todos os usuários da minha org.
- [ ] **US-044** Como Org Admin, quero configurar o tempo de expiração do access token e do refresh token, dentro dos limites definidos pelo Root.
- [ ] **US-045** Como Org Admin, quero criar API Keys para a minha org com escopos específicos, para integrar minha aplicação com o GateKey.
- [ ] **US-046** Como Org Admin, quero revogar uma API Key imediatamente, para resposta a vazamento de credencial.
- [ ] **US-047** Como Org Admin, quero ver a última data e IP de uso de cada API Key, para detectar uso não autorizado.

### Impersonation (agir dentro da org)

- [ ] **US-048** Como Org Admin, quero entrar em qualquer workspace da minha org com permissão plena (herança automática de admin), sem precisar de binding explícito.  ⚠️ *Edge case: isso já está no modelo de herança do PRD — mas precisa estar visível no painel. O admin precisa saber que está vendo como "org admin" e não como membro do workspace.*
- [ ] **US-049** Como Org Admin, quero ver quais workspaces eu estou acessando via herança automática versus bindings explícitos, para entender meu próprio nível de acesso.

---

## Persona 3 — Workspace Admin

### Gestão de membros

- [ ] **US-050** Como Workspace Admin, quero adicionar um usuário da org ao meu workspace com um role específico.  ⚠️ *Edge case: o que acontece se o usuário não pertence à org? O sistema deve impedir ou sugerir que o Org Admin o adicione primeiro à org?*
- [ ] **US-051** Como Workspace Admin, quero remover um membro do workspace sem afetá-lo na org ou em outros workspaces.
- [ ] **US-052** Como Workspace Admin, quero alterar o role de um membro no meu workspace.
- [ ] **US-053** Como Workspace Admin, quero ver todos os membros do workspace com seus roles e bindings de recursos específicos.

### Gestão de roles customizados

- [ ] **US-054** Como Workspace Admin, quero criar um role customizado (ex: `reviewer`) e definir quais capabilities ele inclui.
- [ ] **US-055** Como Workspace Admin, quero editar as capabilities de um role customizado existente.  ⚠️ *Edge case: alterar capabilities de um role já atribuído a usuários tem efeito imediato — o sistema deve alertar quantos usuários serão afetados.*
- [ ] **US-056** Como Workspace Admin, quero deletar um role customizado.  ⚠️ *Edge case: deve bloquear se o role ainda está atribuído a usuários — e listar quais usuários precisam ser migrados para outro role primeiro.*
- [ ] **US-057** Como Workspace Admin, quero duplicar um role existente como base para um novo, para acelerar a criação de variações.

### Gestão de bindings (permissões granulares)

- [ ] **US-058** Como Workspace Admin, quero atribuir um role a um usuário sobre um recurso específico (ex: user X é `editor` do documento Y).
- [ ] **US-059** Como Workspace Admin, quero ver todos os bindings de um usuário no meu workspace (workspace-level + resource-level), para entender exatamente o que ele pode fazer.
- [ ] **US-060** Como Workspace Admin, quero ver todos os usuários com acesso a um recurso específico e seus roles, para auditar permissões de um item sensível.
- [ ] **US-061** Como Workspace Admin, quero revogar um binding específico de um usuário sobre um recurso, sem afetar outros bindings dele.
- [ ] **US-062** Como Workspace Admin, quero revogar todos os bindings de um usuário no workspace de uma vez (ex: antes de removê-lo).

### Gestão de tipos de recurso e herança

- [ ] **US-063** Como Workspace Admin, quero registrar um novo tipo de recurso (ex: `pipeline`) que minha app vai usar, para que o IAM reconheça permissões sobre ele.
- [ ] **US-064** Como Workspace Admin, quero configurar herança two-level para um tipo de recurso (ex: `document` herda de `folder`), para que o PDP resolva permissões automaticamente.
- [ ] **US-065** Como Workspace Admin, quero desativar a herança de um tipo de recurso, para exigir bindings explícitos em cada instância.  ⚠️ *Edge case: desativar herança não revoga bindings existentes — mas usuários que dependiam da herança perdem acesso. O sistema deve alertar.*

---

## Persona 4 — Member (usuário comum)

### Autenticação

- [ ] **US-066** Como Member, quero fazer login com email e senha, para acessar os workspaces da minha org.
- [ ] **US-067** Como Member, quero fazer login via magic link enviado ao meu email, sem precisar lembrar senha.
- [ ] **US-068** Como Member, quero fazer login via OAuth (Google ou GitHub), se minha org permitir.
- [ ] **US-069** Como Member, quero configurar MFA na minha conta, se minha org exigir ou recomendar.
- [ ] **US-070** Como Member, quero fazer logout de uma sessão específica (ex: dispositivo perdido), sem encerrar outras sessões ativas.
- [ ] **US-071** Como Member, quero ver quais dispositivos/sessões estão ativos na minha conta e revogar os que eu não reconheço.

### Perfil e senha

- [ ] **US-072** Como Member, quero alterar minha senha informando a senha atual, para manter minha conta segura.
- [ ] **US-073** Como Member, quero solicitar reset de senha via email caso tenha esquecido.
- [ ] **US-074** Como Member, quero atualizar meu nome e informações de perfil.

---

## Persona 5 — App cliente (integração via SDK/API)

### Verificação de permissão

- [ ] **US-075** Como app cliente, quero verificar se um usuário tem uma capability específica sobre um recurso via `POST /v1/check`, para decidir o que exibir ou bloquear na interface.
- [ ] **US-076** Como app cliente, quero receber uma resposta clara de `POST /v1/check` com `{allowed: false, reason: "no binding found"}`, para exibir mensagens de erro úteis ao usuário.
- [ ] **US-077** Como app cliente, quero verificar múltiplas permissões de um usuário em batch, para não fazer N chamadas individuais ao carregar uma página.  ⚠️ *Edge case não coberto no PRD — endpoint `POST /v1/check/batch` está faltando.*

### Gestão de usuários via API

- [ ] **US-078** Como app cliente, quero criar um usuário na org via `POST /v1/users` usando minha API Key, para onboarding programático sem acessar o dashboard.
- [ ] **US-079** Como app cliente, quero listar todos os usuários de um workspace via `GET /v1/users?workspaceId=...`, para exibir membros na minha interface.
- [ ] **US-080** Como app cliente, quero atribuir um role a um usuário sobre um recurso via `POST /v1/bindings`, para controlar acesso diretamente da minha app ao criar um novo recurso.
- [ ] **US-081** Como app cliente, quero que a API retorne erro 429 com `Retry-After` quando eu exceder o rate limit, para que meu SDK possa fazer retry com backoff automático.  ⚠️ *Edge case — comportamento de rate limit não especificado no PRD.*

### Tokens e JWKS

- [ ] **US-082** Como app cliente, quero verificar a assinatura de um JWT localmente usando o JWKS público, para não precisar chamar o IAM a cada request.
- [ ] **US-083** Como app cliente, quero que o JWKS endpoint retorne a chave pública atual e a anterior durante rotação de chaves, para que tokens antigos ainda sejam válidos durante o período de transição.  ⚠️ *Edge case de rotação de chave RS256 não coberto no PRD.*

---

## Persona 6 — Gestão granular de acesso (todas as personas admin)

> Estas stories cobrem o núcleo do ReBAC: desvios intencionais do padrão — conceder acesso que o role não daria, revogar acesso que o role daria, e criar profiles customizados.

### Criação de profiles (roles com capabilities customizadas)

- [ ] **US-084** Como Org Admin, quero criar um profile (role) que agrupa capabilities de forma customizada para toda a org (ex: `auditor` com `audit:read` + `billing:view` mas sem `user:write`), para modelar perfis de acesso que o catálogo base não cobre.
- [ ] **US-085** Como Org Admin, quero criar um profile que mistura capabilities base e capabilities customizadas da minha org, para atender casos de uso específicos do meu domínio.
- [ ] **US-086** Como Workspace Admin, quero criar um profile (role customizado) válido apenas dentro do meu workspace (ex: `reviewer` com `document:read` + `comment:write`), para granularidade sem afetar outros workspaces.
- [ ] **US-087** Como Workspace Admin, quero criar um profile a partir de um role base existente, adicionando ou removendo capabilities específicas, para não partir do zero. ⚠️ *Edge case: remover capabilities de um role base não altera o role base — cria um novo role derivado scoped ao workspace.*
- [ ] **US-088** Como Workspace Admin, quero ver quais capabilities estão disponíveis para incluir num profile (base global + customizadas da minha org), para não precisar adivinhar os slugs.
- [ ] **US-089** Como Workspace Admin, quero nomear e descrever cada profile que crio, para que outros admins entendam a intenção do role sem precisar inspecionar suas capabilities.
- [ ] **US-090** Como Org Admin, quero ver todos os profiles criados na org e em cada workspace, com quantos usuários cada um tem atribuído, para ter visão de uso.

### Concessão de acesso acima do padrão (grant granular)

- [ ] **US-091** Como Workspace Admin, quero conceder a um usuário acesso a um resource ID específico com um role mais permissivo do que o role padrão dele no workspace, para casos excepcionais sem alterar o perfil global do usuário. *(Ex: user tem role `viewer` no workspace, mas recebe `editor` no documento X.)*
- [ ] **US-092** Como Workspace Admin, ao tentar conceder acesso com capabilities que eu mesmo não tenho, quero ver um erro claro (`Cannot grant 'billing:view': you don't have this capability`), para entender o limite do meu escopo. ⚠️ *Regra: no privilege escalation — admin nunca pode conceder mais do que possui.*
- [ ] **US-093** Como Workspace Admin, quero conceder acesso a um resource ID específico a um usuário que não tem nenhum binding no workspace, para dar acesso pontual sem adicionar o usuário ao workspace inteiro. ⚠️ *Edge case crítico: usuário com binding só em resource-level — sem binding de workspace — deve conseguir acessar apenas aquele recurso, sem herdar nada do workspace.*
- [ ] **US-094** Como Workspace Admin, quero conceder acesso temporário a um resource ID com data de expiração automática, para acesso pontual sem precisar lembrar de revogar manualmente. ⚠️ *Edge case: esta feature não está no PRD — requer campo `expiresAt` no binding e Scheduler para revogação automática.*
- [ ] **US-095** Como Org Admin, quero conceder a um usuário um role de org-level que ele normalmente não teria (ex: promover temporariamente a `admin` de um workspace específico), registrando o motivo no audit log.
- [ ] **US-096** Como Workspace Admin, quero conceder acesso a um container inteiro (ex: uma pasta) com um role específico, sabendo que todos os itens dentro da pasta herdarão esse acesso automaticamente (via two-level inheritance configurado), para não precisar fazer binding item a item.

### Revogação de acesso abaixo do padrão (deny granular)

- [ ] **US-097** Como Workspace Admin, quero revogar o acesso de um usuário a um resource ID específico mesmo que ele tenha um binding de workspace que normalmente daria esse acesso, para exceções de segurança granulares. ⚠️ *Edge case arquitetural crítico: isso requer um mecanismo de "deny explícito" — o PRD atual só tem ALLOW. Um deny binding precisa ter precedência sobre qualquer herança ou binding de workspace.*
- [ ] **US-098** Como Workspace Admin, ao criar um deny explícito, quero ver claramente no painel que aquele usuário tem acesso negado a aquele recurso específico (visualmente diferente de "sem binding"), para que outros admins não fiquem confusos achando que é falta de configuração.
- [ ] **US-099** Como Workspace Admin, quero revogar o acesso de um usuário a um container inteiro (ex: pasta), para que ele perca acesso a todos os itens dentro, mesmo que tenha binding de workspace. ⚠️ *Edge case: se o usuário tem binding direto em algum item dentro da pasta, o deny do container deve ter precedência ou não? Precisa de política explícita.*
- [ ] **US-100** Como Workspace Admin, quero ver uma lista dos deny bindings ativos no workspace, para auditar exceções de segurança sem precisar inspecionar usuário a usuário.
- [ ] **US-101** Como Workspace Admin, quero remover um deny binding (restaurar o acesso padrão), para desfazer uma exceção quando ela não for mais necessária.
- [ ] **US-102** Como Org Admin, quero revogar um binding granular criado por um Workspace Admin, quando ele representa um risco de segurança, mesmo não tendo sido eu quem criou. ⚠️ *Regra confirmada: qualquer admin acima do usuário pode revogar qualquer binding no seu escopo.*

### Visibilidade do acesso efetivo (access review)

- [ ] **US-103** Como Workspace Admin, quero ver o "acesso efetivo" de um usuário — não só os bindings que ele tem, mas o resultado real: quais recursos ele pode acessar e com quais capabilities, considerando herança, deny bindings e role do workspace — em uma única tela. ⚠️ *Edge case de UX crítico: sem essa visão, o admin não sabe o que o usuário realmente pode fazer.*
- [ ] **US-104** Como Workspace Admin, ao ver o acesso efetivo de um usuário, quero ver de onde vem cada permissão (binding direto no recurso, herdado do container, ou do workspace), para entender a cadeia de acesso.
- [ ] **US-105** Como Org Admin, quero ver o acesso efetivo de um usuário em todos os workspaces da org de uma vez, para revisão de acesso periódica.
- [ ] **US-106** Como Workspace Admin, quero ver todos os usuários que têm acesso efetivo a um resource ID específico, incluindo os que chegaram via herança e não via binding direto, para saber exatamente quem pode acessar um recurso sensível.
- [ ] **US-107** Como qualquer admin, quero simular: "se eu criasse este binding, o que mudaria no acesso efetivo deste usuário?" antes de confirmar, para evitar concessões acidentais. ⚠️ *Feature de "dry-run" de binding — não está no PRD.*

### Audit trail de decisões granulares

- [ ] **US-108** Como Org Admin, quero ver no audit log todos os bindings criados e revogados nas últimas 24h, com o admin responsável por cada ação, para revisão de segurança diária.
- [ ] **US-109** Como Root, quero ver no audit log quando um admin tentou conceder uma capability que não tinha (privilege escalation bloqueado), para detectar tentativas de abuso.
- [ ] **US-110** Como Workspace Admin, quero adicionar um comentário/motivo ao criar ou revogar um binding granular, para que o audit log explique o contexto da decisão.

---

## Edge cases identificados — resumo

| # | Situação | Status no PRD |
|---|---|---|
| EC-01 | Impersonation registrada no audit log com flag especial | ❌ Não coberto |
| EC-02 | Banner de impersonation ativo no dashboard | ❌ Não coberto |
| EC-03 | Transferência de usuário entre orgs (o que acontece com bindings?) | ❌ Não coberto |
| EC-04 | Remoção de usuário (o que acontece com ownership de recursos?) | ❌ Não coberto |
| EC-05 | Bloqueio de remoção de capability em uso por roles | ❌ Não coberto |
| EC-06 | Bloqueio de remoção de role em uso por usuários | ❌ Não coberto |
| EC-07 | Alerta ao editar capabilities de role com usuários ativos | ❌ Não coberto |
| EC-08 | Alerta ao desativar herança de recurso (usuários perdem acesso) | ❌ Não coberto |
| EC-09 | Adição de usuário a workspace que não pertence à org | ❌ Não coberto |
| EC-10 | Endpoint `POST /v1/check/batch` para verificação em lote | ❌ Faltando na API |
| EC-11 | Comportamento de rate limit (429 + Retry-After) | ❌ Não especificado |
| EC-12 | Rotação de chave RS256 (JWKS com chave antiga + nova) | ❌ Não coberto |
| EC-13 | Bindings criados durante suspensão de usuário — o que acontece na reativação? | ❌ Não coberto |
| EC-14 | Org Admin vendo no painel se acessa workspace via herança vs binding explícito | ❌ Não coberto |
| EC-15 | Limpeza periódica de sessões expiradas na blacklist | ❌ Não coberto (detalhe de infra) |
| EC-16 | Suspensão de org — o que acontece com refresh tokens ativos? | ❌ Não coberto |

---

*GateKey User Stories v0.1 — revisão inicial*
| EC-17 | Deny binding explícito — mecanismo de negar acesso a resource específico | ❌ **Não existe no PRD — feature nova** |
| EC-18 | Precedência de deny vs allow (deny de container vs binding direto em item) | ❌ **Requer política explícita** |
| EC-19 | Usuário com binding só em resource-level, sem binding de workspace | ❌ Não especificado no PRD |
| EC-20 | Binding com expiração automática (`expiresAt`) | ❌ **Feature nova — requer Scheduler** |
| EC-21 | Tela de "acesso efetivo" — resultado real considerando herança + deny | ❌ Não coberto no PRD |
| EC-22 | Simulação de binding ("dry-run") antes de confirmar | ❌ **Feature nova** |
| EC-23 | Campo `reason` no binding para contexto no audit log | ❌ Não coberto |
| EC-24 | No privilege escalation — admin não pode conceder o que não tem | ❌ **Regra de negócio não documentada no PRD** |
| EC-25 | Role derivado de role base (herança de role sem alterar o original) | ❌ Não coberto |

---

## Decisões de design confirmadas nesta revisão

| # | Decisão |
|---|---|
| D-01 | Workspace Admin cria roles scoped ao workspace; Org Admin cria para toda a org |
| D-02 | No privilege escalation: admin só pode conceder capabilities que ele mesmo possui |
| D-03 | Qualquer admin acima do usuário pode revogar qualquer binding no seu escopo |
| D-04 | Deny binding explícito é necessário (feature nova, não estava no PRD v0.2) |
| D-05 | Binding com `expiresAt` é desejável (feature nova, requer Scheduler Convex) |

---

*GateKey User Stories v0.2 — expandido com gestão granular de acesso*
