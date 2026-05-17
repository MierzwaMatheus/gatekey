# GateKey — Product Requirements Document

> **Versão:** 0.2 — Questões em aberto resolvidas  
> **Status:** Em definição  
> **Stack:** React + Convex (fullstack)  
> **Modelo:** Open source, self-hosted pelo desenvolvedor para clientes

---

## 1. Visão geral

### 1.1 O que é o GateKey

GateKey é um sistema de Identity & Access Management (IAM) baseado em **ReBAC** (Relationship-Based Access Control), construído sobre React e Convex. Ele resolve o problema central de qualquer aplicação multi-tenant: *quem pode fazer o quê, sobre qual recurso específico, dentro de qual contexto organizacional.*

A metáfora central do nome é o **portão** — você só atravessa se tiver a chave certa. Não é sobre quem você é globalmente, mas sobre qual relação você tem com aquele recurso específico naquele momento.

O sistema é **open source e self-hosted**: o desenvolvedor (você) instala e opera uma instância para cada cliente via CLI de setup (`gatekey init`), mantendo controle total via acesso root. Os clientes gerenciam suas organizações e workspaces via dashboard próprio ou via SDK/API integrada nas suas aplicações finais.

### 1.2 Proposta de valor

| Para quem | Problema resolvido |
|---|---|
| Desenvolvedor (você) | Nunca mais reimplementar auth/IAM do zero em cada projeto |
| Clientes (orgs) | Controle granular de acesso sem depender de você para cada ajuste |
| Apps que consomem o IAM | SDK simples + REST API com API Keys escopadas — integração em horas, não dias |

### 1.3 Princípios de design

1. **Segurança e corretude acima de tudo** — nenhuma feature é lançada com decisão de autorização ambígua
2. **A permissão mora no grafo, não no código** — toda decisão de acesso é uma consulta ao banco, não uma condição hardcoded
3. **Agnóstico de domínio com suporte a hierarquia opt-in** — o IAM não impõe estrutura de recursos, mas suporta herança quando a app declara
4. **Fail closed** — em caso de dúvida, nega. Nunca o contrário.

---

## 2. Nome e identidade visual

### 2.1 Nome: GateKey

**Conceito:** A fusão de *gate* (portão, barreira, controle de passagem) com *key* (chave, credencial, acesso). Quem tem a chave certa passa pelo portão — quem não tem, não passa, independente de quem seja globalmente.

**Tagline sugerida:** *"You only pass if you have the right key."*

### 2.2 Identidade visual

**Paleta de cores:**

| Token | Hex | Uso |
|---|---|---|
| `--gate-midnight` | `#0D1117` | Background principal, superfícies escuras |
| `--gate-iron` | `#1C2333` | Cards, painéis secundários |
| `--gate-steel` | `#30363D` | Bordas, divisores |
| `--gate-key` | `#F0A500` | Cor de acento principal — âmbar/dourado (a chave) |
| `--gate-key-dim` | `#7D5500` | Acento em hover/estados secundários |
| `--gate-safe` | `#3FB950` | Estados de sucesso, acesso concedido |
| `--gate-danger` | `#F85149` | Erros, acesso negado, revogações |
| `--gate-text` | `#C9D1D9` | Texto primário |
| `--gate-muted` | `#8B949E` | Texto secundário, labels |

**Tipografia:**
- Interface: **Inter** (sistema, legível em densidades altas)
- Código e tokens: **JetBrains Mono**
- Tom: técnico, preciso, sem ornamentos

**Conceito de ícone/logo:**
Um octógono (forma de sinal de STOP/portão) com um vazado em forma de chave no centro — minimalista, monocromático, funciona em qualquer tamanho. A chave no centro do portão é a metáfora em forma visual.

**Tom de voz:**
- Mensagens de erro: diretos e informativos (`Permission denied: user lacks document:write on resource doc_abc`)
- Documentação: técnica mas acessível
- Dashboard: profissional, sem marketing interno

---

## 3. Hierarquia de entidades

### 3.1 Mapa completo

```
Root (superadmin global)
└── Org (cliente/empresa)
    ├── Org Admin (gerencia a org)
    └── Workspace (projeto/ambiente)
        ├── Workspace Admin
        └── Member (usuário com role no workspace)
```

### 3.2 Definições

**Root**
- Existe fora de qualquer org
- Acesso irrestrito a todo o sistema
- Pode criar/suspender/deletar orgs
- Pode revogar qualquer sessão de qualquer usuário
- Pode impersonar qualquer usuário para debugging
- Acessa apenas via dashboard interno do GateKey (nunca exposto via API pública)
- MFA obrigatório e não configurável

**Org**
- Representa um cliente/empresa
- Criada apenas pelo Root
- Possui configurações próprias: métodos de login permitidos, expiração de JWT, MFA obrigatório ou não, cotas de usuários e workspaces
- Tem pelo menos um Org Admin designado pelo Root na criação

**Workspace**
- Unidade de isolamento dentro de uma Org
- Representa um projeto, ambiente, produto ou contexto operacional
- Criado pelo Org Admin ou Root
- Possui roles customizáveis além dos roles base do sistema
- Usuários têm roles específicos por workspace — não existe role "global de workspace"

**Usuário**
- Existe globalmente no sistema (não pertence a uma org específica)
- Pode pertencer a múltiplos workspaces de múltiplas orgs
- Criado pelo Org Admin ou Workspace Admin (sem self-service, sem convites por email)
- Tem um conjunto de sessões ativas rastreadas

---

## 4. Modelo de autorização (ReBAC)

### 4.1 Conceito central

Permissão no GateKey não é "o usuário tem o role X". É:

> **"O usuário U tem a capability C sobre o recurso R se existe um caminho válido no grafo de relações que conecta U a R com semântica C."**

A mesma pessoa pode ser `editor` de um documento específico e `viewer` de outro — mesmo estando no mesmo workspace com o mesmo role.

### 4.2 Entidades do modelo

**Capability**
- Permissão atômica: `document:read`, `user:invite`, `billing:view`
- O sistema fornece um **catálogo base** de capabilities (definido pelo Root)
- Cada Org pode **estender** o catálogo com capabilities customizadas (`pipeline:deploy`, `report:export`)
- Capabilities customizadas de uma org são invisíveis para outras orgs

**Role**
- Agrupamento nomeado de capabilities
- Roles base: `owner`, `admin`, `editor`, `viewer` (definidos pelo sistema, não removíveis)
- Cada workspace pode criar roles customizados (`reviewer`, `devops`, `readonly-finance`)
- Roles customizados são scoped ao workspace — não existem em outros workspaces

**Resource**
- Qualquer entidade da app cliente que precisa de controle de acesso
- O IAM é **agnóstico de domínio por padrão**: armazena `resourceType` + `resourceId` (externo)
- A app cliente registra os tipos de recurso que usa, declarando opcionalmente se suportam herança
- Hierarquia suportada: **dois níveis** — `workspace → container → item` (ex: `folder → document`)
- Permissões podem ser sobre o workspace inteiro ou sobre instâncias específicas de recursos

**Binding**
- A relação entre Usuário + Role + Recurso (ou Workspace)
- Exemplo: `{userId: "u1", roleId: "editor", resourceType: "document", resourceId: "doc_abc"}`
- Um usuário pode ter múltiplos bindings — cada um sobre um recurso diferente

### 4.3 Herança de permissões

| Nível | Comportamento |
|---|---|
| Root → Org | Root acessa tudo, sem binding |
| Org Admin → Workspaces | Herança automática: org admin é admin de todos os workspaces da org |
| Workspace → Recursos | Configurável por tipo de recurso |
| Container → Item (two-level) | Opt-in: declarado na hora de registrar o tipo de recurso |

**Como a herança two-level funciona:**

A app registra o tipo de recurso com `inheritsFrom` e `inheritanceMode`:

```json
{
  "resourceType": "document",
  "inheritsFrom": "folder",
  "inheritanceMode": "auto"
}
```

Quando o PDP avalia uma permissão sobre `doc_abc`, ele:
1. Busca binding direto: `userId → role → doc_abc`
2. Se não encontrar, busca o container pai: `userId → role → folder_xyz` (pai de `doc_abc`)
3. Se não encontrar, busca no workspace: `userId → role → workspace`
4. Se não encontrar em nenhum nível: **DENY**

O PDP faz no máximo **3 lookups** por decisão. Sem custo adicional para tipos sem herança configurada.

### 4.4 Fluxo de decisão (PDP)

```
Request chega com JWT ou API Key
        ↓
PEP extrai: userId (ou serviceId), orgId, capability, resourceType, resourceId
        ↓
PDP verifica em ordem:
  1. Usuário/serviço está ativo? (não suspenso, não deletado)
  2. Sessão/API Key é válida e não revogada?
  3. API Key tem o escopo necessário? (se autenticação por API Key)
  4. Usuário pertence ao workspace do recurso?
  5. Binding direto: userId → role → resourceId?
  6. Binding no container pai? (se tipo tem inheritanceMode configurado)
  7. Binding no workspace?
  8. O role encontrado possui a capability solicitada?
        ↓
Decisão: ALLOW ou DENY (com motivo específico)
        ↓
Evento registrado no audit log
```

---

## 5. Autenticação e JWT

### 5.1 Métodos de login suportados

- Email + senha
- Magic link (email sem senha)
- OAuth: Google, GitHub (extensível)

Cada Org configura quais métodos são permitidos para seus usuários.

### 5.2 JWT customizado

O token emitido pelo GateKey carrega:

```json
{
  "sub": "user_abc123",
  "orgId": "org_xyz",
  "workspaceIds": ["ws_1", "ws_2"],
  "roles": {
    "ws_1": ["editor"],
    "ws_2": ["viewer"]
  },
  "capabilities": ["document:read", "document:write"],
  "sessionId": "sess_abc",
  "iat": 1700000000,
  "exp": 1700003600
}
```

> `capabilities` no JWT é um cache para checks simples e rápidos. A fonte de verdade é sempre o grafo no banco — o PDP consulta o banco para decisões envolvendo recursos específicos ou herança.

Tokens assinados com **RS256** (chave assimétrica). A chave privada nunca sai do backend. JWKS endpoint público disponível para apps clientes verificarem tokens localmente sem roundtrip ao IAM.

### 5.3 Expiração e refresh

- Configurável por Org (o Root define os limites máximos; a org escolhe dentro deles)
- Modelo padrão recomendado: access token 60 min + refresh token 30 dias
- Refresh token é **rotacionado a cada uso** (rotation strategy — token antigo é invalidado imediatamente após refresh)

### 5.4 Revogação

- Root pode revogar qualquer sessão imediatamente
- Org Admin pode revogar sessões de usuários da própria org
- Implementação: blacklist de `sessionId` no Convex com TTL = expiração original do access token
- O PDP verifica a blacklist em toda decisão de autorização

### 5.5 MFA

- Root: MFA obrigatório, não configurável (TOTP)
- Orgs: Org Admin decide se exige MFA para seus usuários
- Suporte inicial: TOTP (Google Authenticator, Authy)
- Suporte futuro: WebAuthn/Passkeys

---

## 6. Integração — API Keys, SDK e REST API

### 6.1 API Keys com escopos (autenticação server-side)

Apps clientes se autenticam com o IAM via **API Keys escopadas** para operações server-side. Cada chave possui:

- Identificador público (`gk_live_pk_...`) e secret exibido apenas uma vez na criação
- Conjunto de escopos declarados na criação: `["users:write", "bindings:write", "audit:read"]`
- Descrição, data de criação e registro de última utilização (timestamp + IP)
- Status: ativa / revogada

O backend armazena apenas o **hash bcryptjs** da chave — nunca o valor em plaintext. Na validação, o PEP faz hash do valor recebido e compara.

**Escopos disponíveis:**

| Escopo | Permite |
|---|---|
| `users:read` | Listar e consultar usuários |
| `users:write` | Criar, atualizar, suspender usuários |
| `roles:read` | Listar roles e capabilities |
| `roles:write` | Criar e remover roles customizados |
| `bindings:read` | Consultar bindings existentes |
| `bindings:write` | Criar e revogar bindings |
| `check` | Verificar permissões (endpoint `/check`) |
| `audit:read` | Ler audit log |
| `sessions:write` | Revogar sessões |

O Org Admin cria e gerencia as API Keys da org pelo dashboard. O Root gerencia API Keys de qualquer org.

### 6.2 JWT do usuário (autenticação client-side)

Para operações que partem do frontend da app cliente (usuário logado), a app passa o JWT do usuário no header `Authorization: Bearer <token>`. O PEP valida o token e extrai o contexto do usuário.

### 6.3 Dois modos de integração para apps clientes

**SDK (TypeScript/JavaScript)**
- Importado pela app cliente (`npm install @gatekey/sdk`)
- Abstrai chamadas à REST API, gerencia refresh token automaticamente
- Pacote React separado (`@gatekey/react`) com hooks: `usePermission`, `useUser`, `useWorkspace`
- Tipagem completa — autocomplete de capabilities e resource types registrados

**REST API**
- Endpoints HTTP expostos via Convex HTTP Actions
- Documentada via OpenAPI/Swagger gerado automaticamente
- Testável via playground interativo no dashboard
- Versionada (`/v1/...`) desde o início

### 6.4 Endpoints principais da Management API

```
Auth
  POST /v1/auth/login              → credenciais → access + refresh token
  POST /v1/auth/refresh            → refresh token → novo access token
  POST /v1/auth/logout             → invalida sessão atual
  GET  /v1/auth/.well-known/jwks   → JWKS público para verificação de tokens

Usuários
  POST   /v1/users                 → cria usuário na org
  GET    /v1/users/:id             → dados do usuário
  PATCH  /v1/users/:id             → atualiza dados
  DELETE /v1/users/:id             → suspende/remove usuário
  GET    /v1/users/:id/permissions → lista tudo que o usuário pode fazer

Roles & Capabilities
  POST   /v1/roles                 → cria role customizado no workspace
  GET    /v1/roles                 → lista roles do workspace
  DELETE /v1/roles/:id             → remove role (se sem usuários vinculados)
  GET    /v1/capabilities          → lista catálogo de capabilities disponíveis
  POST   /v1/capabilities          → adiciona capability customizada (org admin)

Bindings
  POST   /v1/bindings              → atribui role a user sobre recurso ou workspace
  GET    /v1/bindings              → lista bindings (filtráveis por userId, resourceType)
  DELETE /v1/bindings/:id          → revoga binding

Verificação de permissão
  POST   /v1/check                 → {userId, capability, resourceType, resourceId} → {allowed, reason}

Tipos de recurso
  POST   /v1/resource-types        → registra tipo com configuração de herança
  GET    /v1/resource-types        → lista tipos registrados na org

API Keys
  POST   /v1/api-keys              → cria nova API Key com escopos
  GET    /v1/api-keys              → lista API Keys da org (sem revelar o secret)
  DELETE /v1/api-keys/:id          → revoga API Key imediatamente

Sessões (Org Admin / Root)
  GET    /v1/sessions              → lista sessões ativas (filtráveis por userId)
  DELETE /v1/sessions/:id          → revoga sessão imediatamente
```

---

## 7. Cotas e limites

Configurados pelo Root por org:

| Quota | Padrão | Configurável pelo Root |
|---|---|---|
| Usuários por org | 50 | Sim |
| Workspaces por org | 10 | Sim |
| Usuários por workspace | 30 | Sim |
| Capabilities customizadas por org | 50 | Sim |
| Roles customizados por workspace | 20 | Sim |
| Sessões ativas por usuário | 5 | Sim |
| API Keys ativas por org | 10 | Sim |

O sistema bloqueia operações que ultrapassem as cotas e retorna erro estruturado:

```json
{
  "error": "QuotaExceeded",
  "message": "Org has reached the maximum of 50 users.",
  "quota": "users_per_org",
  "limit": 50,
  "current": 50
}
```

---

## 8. Audit log

### 8.1 O que é registrado

- Login / logout / falha de autenticação
- Criação / suspensão / remoção de usuário
- Atribuição / revogação de role ou binding
- Criação / remoção de role ou capability
- Verificação de permissão (`/check`) — com resultado ALLOW/DENY e motivo
- Criação / revogação de API Key
- Revogação de sessão
- Mudança de configuração de org ou workspace
- Ação de Root (impersonation, criação de org, etc.)

### 8.2 Estrutura de cada evento

```json
{
  "id": "log_abc",
  "timestamp": "2025-01-01T12:00:00Z",
  "actor": {
    "type": "user",
    "userId": "u1",
    "role": "org_admin"
  },
  "action": "binding.create",
  "target": {
    "userId": "u2",
    "roleId": "editor",
    "resourceType": "document",
    "resourceId": "doc_xyz"
  },
  "orgId": "org_abc",
  "workspaceId": "ws_1",
  "ip": "192.168.1.1",
  "userAgent": "GateKey-SDK/1.0",
  "result": "success",
  "reason": null
}
```

### 8.3 Retenção — Tiered Storage

**Hot tier (Convex DB):** últimos 30 dias — consulta em tempo real no dashboard com filtros.

**Cold tier (R2 ou S3):** logs além de 30 dias exportados automaticamente por um Convex Scheduler diário. Formato: NDJSON comprimido (`.ndjson.gz`), particionado por `orgId/YYYY/MM/DD/`.

**Acesso ao cold tier:** disponível via download no dashboard. O usuário seleciona o período, o sistema gera um link temporário (15 min de validade).

**Configuração:** o Root define bucket e credenciais de storage no `gatekey init`. Sem storage configurado, o sistema retém apenas o hot tier e emite alerta quando logs estão próximos de serem descartados.

### 8.4 Visibilidade

| Quem | Acesso |
|---|---|
| Root | Todos os logs de todas as orgs (hot + cold) |
| Org Admin | Logs da própria org (hot + cold) |
| Workspace Admin | Logs do próprio workspace (hot apenas) |
| Member | Nenhum acesso |

Logs são **append-only** — nunca editáveis, nunca deletáveis (nem pelo Root).

---

## 9. Dashboard de administração

### 9.1 Visões por nível de acesso

**Painel Root**
- Visão global de todas as orgs (status, uso de cotas, última atividade)
- Criar / suspender / deletar orgs
- Configurar cotas por org
- Gerenciar API Keys de qualquer org
- Revogar qualquer sessão
- Audit log global + acesso ao cold tier
- Gerenciar catálogo base de capabilities
- Configurar storage para cold tier

**Painel Org Admin**
- Gerenciar usuários da org (criar, suspender, resetar senha)
- Criar e configurar workspaces
- Definir capabilities customizadas da org
- Gerenciar API Keys da org (criar com escopos, revogar)
- Ver audit log da org (hot + cold)
- Configurar métodos de login e MFA da org
- Configurar expiração de JWT (dentro dos limites definidos pelo Root)

**Painel Workspace Admin**
- Gerenciar membros do workspace
- Criar roles customizados e atribuir capabilities
- Criar e revogar bindings (usuário → role → recurso)
- Configurar tipos de recurso e herança two-level
- Ver audit log do workspace (hot tier)

### 9.2 Playground interativo

- Construtor visual de chamadas (método, endpoint, body JSON)
- Autenticação por API Key selecionada da org atual
- Resposta em tempo real com syntax highlight e status HTTP
- Histórico de chamadas da sessão atual
- Botão "copy as cURL" e "copy as SDK call"
- Documentação inline de cada endpoint com exemplos

---

## 10. CLI de setup (`gatekey init`)

Distribuído junto ao repositório em `/cli`. Executado pelo desenvolvedor uma vez por instância:

```bash
npx gatekey init
```

**Fluxo interativo:**

```
? Instance name: MinhaApp IAM
? Convex deployment URL: https://xxx.convex.cloud
? Convex deploy key: [hidden]
? Object storage for audit cold tier? (R2 / S3 / skip)
? Root email: admin@roxus.studio
? Root password: [hidden]

✓ Schema deployed to Convex
✓ RS256 key pair generated and stored
✓ Root user created
✓ Instance configured

Dashboard: https://xxx.convex.cloud/dashboard
Root credentials saved to .gatekey-root (add to .gitignore!)
```

**O que o CLI faz internamente:**
1. Valida conexão com o Convex deployment
2. Executa migrations do schema (todas as tabelas e índices)
3. Gera o par de chaves RS256 e armazena no Convex (privada nunca sai)
4. Cria o usuário root com hash bcryptjs da senha
5. Configura variáveis de ambiente da instância
6. Opcionalmente configura o bucket de cold storage

---

## 11. Internacionalização (i18n)

- Dashboard: português (BR) e inglês desde o início
- Mensagens de erro da API: sempre em inglês (padrão técnico)
- Emails transacionais (magic link): localizados por org
- Biblioteca: `i18next` com detecção automática de idioma do browser
- Strings externalizadas em arquivos JSON desde o primeiro commit — nunca hardcoded

---

## 12. Stack técnica

### 12.1 Backend

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Runtime / DB | Convex | Reatividade nativa, functions tipadas, sem ORM separado |
| Auth flow | Convex HTTP Actions | Endpoints HTTP sem servidor separado |
| JWT | `jose` (JOSE padrão) | RS256, JWKS, padrão da indústria |
| Email | Resend | Magic link, notificações transacionais |
| Hashing (senha e API Key) | `bcryptjs` (cost factor 10) | argon2id desejável mas incompatível com o runtime V8 do Convex; bcryptjs roda no runtime Node via Convex Actions e é suficientemente seguro para o modelo de ameaça |
| Cold storage | Cloudflare R2 ou AWS S3 | Configurável na instalação |

### 12.2 Frontend (dashboard)

| Camada | Tecnologia |
|---|---|
| Framework | React + Vite |
| Roteamento | TanStack Router |
| Estado servidor | Convex React hooks |
| UI base | shadcn/ui + Tailwind |
| Formulários | React Hook Form + Zod |
| i18n | i18next |

### 12.3 SDK (para apps clientes)

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript |
| Build | tsup (ESM + CJS dual output) |
| Distribuição | npm (open source) |
| React hooks | pacote separado `@gatekey/react` |

---

## 13. Modelo de dados — visão macro

### 13.1 Tabelas principais (Convex)

```
users                    → usuários globais do sistema
orgs                     → organizações
org_settings             → config por org (login methods, MFA, JWT expiry, quotas)
workspaces               → workspaces por org
org_members              → relação user ↔ org (status: active/suspended)
workspace_members        → relação user ↔ workspace
roles                    → roles por workspace (base + custom)
capabilities             → catálogo de capabilities (base global + custom por org)
role_capabilities        → capabilities atribuídas a cada role
resource_types           → tipos registrados por app cliente (com config de herança)
bindings                 → user + role + resourceType + resourceId + parentResourceId?
api_keys                 → API Keys por org (hash bcryptjs, escopos, metadata)
sessions                 → sessões ativas (sessionId, expiração, device info)
session_blacklist        → sessões revogadas (TTL automático)
audit_log                → eventos append-only (hot tier — 30 dias)
audit_exports            → registro de exportações para cold tier
```

### 13.2 Índices críticos

| Tabela | Índice | Uso |
|---|---|---|
| `bindings` | `(workspaceId, userId)` | Listagem de permissões do usuário |
| `bindings` | `(resourceType, resourceId)` | Quem tem acesso a este recurso? |
| `bindings` | `(userId, resourceType, resourceId)` | Check direto no PDP |
| `audit_log` | `(orgId, timestamp)` | Paginação do log por org |
| `audit_log` | `(workspaceId, timestamp)` | Paginação por workspace |
| `session_blacklist` | `sessionId` | Lookup O(1) na verificação de revogação |
| `sessions` | `userId` | Sessões ativas de um usuário |
| `api_keys` | `(orgId, status)` | Keys ativas por org |

---

## 14. Segurança — requisitos não negociáveis

- Todas as Convex mutations e queries com dados sensíveis passam pelo PEP antes de executar
- Nenhuma decisão de autorização acontece no frontend
- Rate limiting em endpoints de auth (login, refresh, `/check`) via Convex Scheduler
- Senhas e API Key secrets hasheados com **bcryptjs** (cost factor 10) via Convex Action (Node runtime) — argon2id seria preferível mas é incompatível com o runtime V8 do Convex; nunca MD5, nunca SHA-1, nunca hashing sem salt
- JWT assinados com **RS256** — chave privada nunca sai do backend
- JWKS endpoint público para verificação local de tokens pelas apps clientes
- Toda comunicação por HTTPS (Convex gerencia TLS)
- 5 falhas consecutivas de autenticação = bloqueio temporário (15 min) com log de evento
- API Keys armazenadas apenas como hash — o valor plaintext é exibido apenas uma vez na criação
- Todas as decisões do PDP (ALLOW e DENY) são registradas no audit log com motivo

---

## 15. Fases de desenvolvimento (MVP completo)

### Fase 1 — Core de autorização
- Schema Convex completo (todas as tabelas e índices)
- PEP/PDP funcionais com traversal two-level
- JWT sign/verify com RS256 + JWKS endpoint
- Login por email + senha
- Hierarquia Root → Org → Workspace → Member
- Herança de permissões opt-in por tipo de recurso

### Fase 2 — Management API
- REST API completa (`/v1/...`) com todos os endpoints
- API Keys com escopos (criação, hash bcryptjs, validação de escopo no PEP)
- Audit log hot tier com todos os eventos
- Revogação de sessão em tempo real
- Cotas com validação e erros estruturados

### Fase 3 — Dashboard
- Painel Root (orgs, cotas, sessões globais, audit global)
- Painel Org Admin (usuários, workspaces, API Keys, audit da org)
- Painel Workspace Admin (membros, roles, bindings, tipos de recurso)
- Playground interativo com documentação inline

### Fase 4 — Auth avançado e SDK
- Magic link (Resend)
- OAuth (Google, GitHub)
- MFA TOTP (root obrigatório, orgs opt-in)
- SDK TypeScript (`@gatekey/sdk`) + pacote React (`@gatekey/react`)
- i18n completo (PT-BR + EN)

### Fase 5 — DX, cold storage e CLI
- CLI `gatekey init` (setup interativo completo)
- Integração de cold storage (R2/S3) com Convex Scheduler de exportação diária
- Acesso ao cold tier no dashboard com download por período
- Testes de integração automatizados
- Documentação OpenAPI/Swagger gerada automaticamente
- README de self-hosting completo

---

*GateKey PRD v0.2 — todas as questões em aberto resolvidas*
