# IDENTIDADE VISUAL — GateKey

## Stack Técnica
- Tailwind CSS para toda estilização — NUNCA criar arquivos `.css` separados
- shadcn/ui como base de componentes, customizados via `className`
- Todos os valores visuais definidos como **tokens semânticos** no `tailwind.config`
- NUNCA usar valores hardcoded no código — sempre tokens semânticos
- NUNCA usar cores, radius ou sombras padrão do Tailwind — apenas tokens deste documento
- A IA que implementa é RESPONSÁVEL por criar SVGs originais baseados nas descrições abaixo — NÃO use blobs, dot grids ou partículas como substituto de conceito
- A paleta usa UMA cor accent forte (`--gate-key` âmbar/dourado) + neutros escuros. Nenhuma outra cor vibrante fora do status funcional.
- Dark mode é o **padrão e modo principal**. Light mode existe mas é secundário.

## Setup Necessário

### Libs adicionais
| Lib | Pra quê | Instalação |
|---|---|---|
| `framer-motion` | Micro-interações de entrada em listas, tabelas e modais | `npm i framer-motion` |
| `@radix-ui/react-tooltip` | Tooltips para badges de permissão e ícones de status | já incluso no shadcn |

### Assets externos
Nenhum. Todos os conceitos visuais são implementáveis em SVG inline + CSS puro.

---

## A Alma do App

GateKey não pede permissão — ele **define** quem passa e quem não passa, com precisão cirúrgica. A interface deve comunicar controle, precisão e confiabilidade silenciosa: um sistema que nunca vacila, nunca improvisa, nunca deixa dúvida. Como o cofre de um banco — não é intimidador, é simplesmente **definitivo**.

---

## Referências e Princípios

**Supabase:** dark profundo como base, verde como único acento vibrante, tipografia monospace nos códigos e tokens, cards que são cenas conceituais (o card de Realtime tem cursores; o de Storage tem thumbnails organizados). A cor accent aparece no logo, botões primários, ícones ativos, badges de status, destaques de syntax highlighting. Zero gradientes no design estrutural — a profundidade vem de camadas de cinza escuro (midnight → iron → steel), não de efeitos visuais.
→ Princípio: **profundidade por camadas de neutros, não por gradientes. A cor accent é o único sinal de vida na interface.**
→ Aplicação no GateKey: `--gate-midnight`, `--gate-iron`, `--gate-steel` criam a hierarquia. `--gate-key` (âmbar) é o único elemento cromático vibrante. Tudo que está ativo, permitido, ou requer atenção usa âmbar.

**Linear:** navegação por atalhos de teclado como cidadão de primeira classe, interface de alta densidade que não parece lotada, tipografia com peso preciso (nunca bold demais, nunca light demais). Dados em tabela sem parecer planilha.
→ Princípio: **densidade de informação com espaçamento intencional — cada pixel de margem conta uma história de hierarquia.**
→ Aplicação no GateKey: tabelas de bindings, sessões e API Keys precisam de alta densidade sem sensação de peso. Atingido com line-height apertado (1.4), padding vertical reduzido nas células (8px), e separadores sutis (1px, 8% opacidade).

**Vercel:** hierarquia visual só com peso tipográfico e escala — nenhuma cor é necessária para entender o que é título, subtítulo e dado. Ícones de status (check, x, dot pulsante) como linguagem primária de feedback.
→ Princípio: **tipografia como sistema de hierarquia autossuficiente. Cor é intensificador, não estrutura.**
→ Aplicação no GateKey: headings de seção em `--gate-text` peso 500, labels em `--gate-muted`, valores em `--gate-text` peso 400. O âmbar aparece apenas onde há ação disponível ou estado notável.

---

## Decisões de Identidade

### ESTRUTURA

#### Navegação
**O que:** Sidebar vertical fixa, estreita (220px), sem ícones decorativos soltos — cada item de navegação tem ícone + label em linha, com indicador de estado ativo em barra lateral âmbar (2px, altura 60% do item).

**Por que:** O sistema tem três painéis hierárquicos distintos (Root, Org Admin, Workspace Admin). A sidebar precisa comunicar em qual contexto o usuário está — não apenas qual página.

**Como:** O header da sidebar exibe o contexto atual (nome da org + workspace selecionado) com um switcher de contexto. Abaixo, os itens de nav agrupados por seção. O item ativo tem background `surface-card` + borda esquerda `accent-primary`. Sem submenu expansível — navegação flat por tabs quando necessário dentro de uma seção.

**Nunca:** hamburger menu em desktop, ícones sem label, submenu aninhado com mais de 1 nível.

#### Layout de conteúdo
**O que:** Layout de duas colunas em páginas de detalhe (lista à esquerda, detalhe à direita), layout de coluna única em dashboards com cards. Sem hero sections — o GateKey é uma ferramenta, não um produto de marketing.

**Por que:** A interface gerencia entidades (usuários, roles, bindings, API Keys) — o padrão de lista + detalhe é o mais adequado para operações CRUD frequentes.

**Como:** Coluna esquerda: 360px fixo, lista com filtro e busca no topo. Coluna direita: flex-1, painel de detalhe com seções colapsáveis. Em mobile: stack vertical, detalhe substitui lista (com botão de voltar).

**Nunca:** tabs aninhadas com mais de 2 níveis, modais para fluxos de mais de 3 passos (usar página dedicada).

#### Hierarquia de atenção
**O que:** Em qualquer tela, o olho deve ir em sequência: (1) contexto atual (org/workspace no header), (2) título da seção, (3) dado ou ação principal, (4) metadados secundários.

**Como:** Tamanho de fonte decrescente (18 → 14 → 13 → 12px), peso decrescente (500 → 400), cor decrescente (`--gate-text` → `--gate-muted`). Ações primárias em botão âmbar, ações secundárias em outline neutro, ações destrutivas em vermelho apenas no estado hover/confirmação.

---

### LINGUAGEM

#### Tipografia
**O que:** Interface em **Inter** (weights 400 e 500 apenas). Tokens, IDs, hashes, API Keys, código inline e mensagens de erro técnicas em **JetBrains Mono**.

**Por que:** Inter é legível em densidades altas — o GateKey exibe muita informação por tela (bindings, sessões, audit log). JetBrains Mono no código distingue visualmente dados técnicos de labels de interface, como o Supabase faz com o SQL Editor.

**Como:** Todo `userId`, `roleId`, `resourceId`, `sessionId`, chave de API Key (com mascaramento parcial `gk_live_pk_...••••`) e qualquer capability (`document:read`) é renderizado em monospace. Nunca Inter para dados técnicos — eles precisam ser escaneáveis e copy-pastáveis.

**Nunca:** font-weight 600 ou 700, tamanhos abaixo de 12px, combinações de mais de duas famílias tipográficas.

#### Geometria
**O que:** Bordas altamente arredondadas para cards e painéis (`radius-card`: 12px), moderadamente arredondadas para botões (`radius-button`: 8px) e inputs (`radius-input`: 8px), levemente arredondadas para badges e chips (`radius-badge`: 6px).

**Por que:** O GateKey tem identidade técnica mas não deve parecer "corporativo angular". O arredondamento suaviza sem perder a precisão.

**Como:** Cards de painel usam 12px. Botões e inputs usam 8px. Células de tabela sem radius (bordas apenas com linha separadora). Pills de status (ALLOW/DENY) usam full radius (9999px).

**Nunca:** border-radius 0 em cards ou painéis, radius inconsistente por componente.

#### Cor como sistema
**O que:** Base dark (`--gate-midnight` #0D1117 como superfície de página, `--gate-iron` #1C2333 para cards e painéis, `--gate-steel` #30363D para bordas e divisores). Uma cor accent: `--gate-key` #F0A500 (âmbar/dourado). Cores de status apenas para feedback funcional.

**Como:** O âmbar aparece em: logo, botões primários, ícones ativos na sidebar, badges de roles/capabilities, indicadores de sessão ativa, cursor do playground interativo, acentos de syntax highlighting de API Keys. Tudo mais é escala de cinza escuro + texto em `--gate-text` / `--gate-muted`.

**Nunca:** gradientes como identidade visual, múltiplas cores de acento por categoria, glassmorphism em componentes estruturais.

#### Profundidade
**O que:** Profundidade criada exclusivamente por camadas de superfície (midnight → iron → steel) e box-shadow etérea. Sem gradientes decorativos.

**Como:** `shadow-card`: `0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)` — a sombra é escura (sistema dark) e a borda interna em branco a 6% cria a separação do fundo. `shadow-hover`: adiciona `0 4px 16px rgba(0,0,0,0.5)`. O `shadow-float` para modais e dropdowns usa `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)`.

**Nunca:** sombras coloridas/âmbar, drop-shadow em ícones, glow borders como estado padrão.

#### Iconografia
**O que:** Ícones Lucide outline, 16px inline e 18px em headers de seção. Nunca filled, nunca com background colorido padrão — exceto quando há estado de alerta ativo (então `--gate-danger` no ícone de revogação).

**Por que:** Consistência com a linguagem do shadcn/ui. Ícones outline são menos agressivos em interfaces de alta densidade.

**Nunca:** ícones emoji, ícones duotone sem uma razão muito específica, mix de estilos (alguns outline, alguns filled) na mesma tela.

---

### RIQUEZA VISUAL

#### Textura Ambiente
**O que:** Um pattern de linhas de circuito extremamente sutil no fundo da página (`surface-page`). Evoca a metáfora de grafo de relações — o coração do ReBAC.

**Temática:** O GateKey é um sistema de grafos. Um fundo com nós conectados por linhas finas (como um PCB simplificado ou um mapa de relações) comunica visualmente o que o sistema faz: rastrear conexões entre usuários, roles e recursos.

**Tratamento:** SVG inline como background-image, com `opacity: 0.035`. Monocromático em `--gate-text` (#C9D1D9). O pattern é composto de pontos (círculos de 2px) conectados por linhas de 1px, em grid irregular de 48px × 48px com variação de 30%. Fixo (não scroll). Aparece apenas na `surface-page` — nunca dentro de cards ou painéis.

#### Conceitos Visuais por Componente

##### Card de verificação de permissão (endpoint `/check` / Playground)
**Representa:** A decisão binária do PDP — o momento em que o sistema declara ALLOW ou DENY com motivo. Não é uma tabela de dados; é um **veredito**.

**Metáfora visual:** Um portão (a metáfora central do GateKey) em estado aberto ou fechado. À esquerda, o pedido entra (usuário + capability + recurso). À direita, o resultado sai com o caminho percorrido no grafo (binding direto → container pai → workspace).

**Cena detalhada:** No topo do card, três pills em linha: `userId`, `capability` e `resourceId` — cada um em monospace com fundo `surface-elevated`. Uma linha fina âmbar conecta os três pills a um ponto central. Desse ponto, uma seta larga desce para o resultado. O resultado ocupa 60% do card: se ALLOW, uma pill grande verde (`--gate-safe`) com ícone de check e o path de decisão embaixo em texto muted (`binding direto: role "editor" → doc_abc`). Se DENY, pill vermelho (`--gate-danger`) com ícone de cadeado fechado e o motivo específico (`capability "document:write" not in role "viewer"`). O portão — um octógono outline simplificado em 32px — fica centralizado entre o input e o output, como o árbitro da decisão. Em estado ALLOW, o octógono tem a borda âmbar. Em DENY, vermelho.

**Viabilidade:** CÓDIGO PURO — SVG inline + Tailwind.

##### Card de binding (user → role → resource)
**Representa:** A relação tripartite que é o átomo do ReBAC — a conexão entre uma identidade, um papel e um recurso específico. É a "chave no portão" em forma de dado.

**Metáfora visual:** Um grafo de três nós conectados. Não é uma linha de tabela — é um diagrama de relação vivo.

**Cena detalhada:** O card é horizontal (full-width em lista). À esquerda, um nó circular (40px) com o avatar/iniciais do usuário sobre fundo `surface-elevated`, abaixo o `userId` em monospace 11px. Uma linha fina (1px, cor `--gate-steel`) conecta ao nó central: um hexágono (representando o role) com o nome do role em 12px bold e âmbar. Uma segunda linha conecta ao nó direito: um retângulo arredondado (representando o recurso) com o `resourceType` em maiúsculas 10px muted e o `resourceId` em monospace abaixo. A linha inteira de usuário → role → recurso é a cena visual. Ao hover, as linhas pulsam suavemente para âmbar (transition 200ms). Botão de revogar (ícone de x) aparece no hover alinhado à direita, fundo `--gate-danger` em 10% opacidade.

**Viabilidade:** CÓDIGO PURO — SVG inline para os nós e conectores, Tailwind para o container.

##### Painel de Audit Log
**Representa:** O registro imutável de tudo que aconteceu — a memória permanente do sistema. Não é uma tabela qualquer; é uma **linha do tempo com peso histórico**.

**Metáfora visual:** Timeline vertical com eventos que têm intensidade visual proporcional ao impacto da ação. Um `binding.create` é discreto. Uma `session.revoke` é mais destacada. Uma `org.suspend` (ação Root) tem tratamento visual diferenciado.

**Cena detalhada:** À esquerda de cada linha do audit log, uma coluna de 24px com um ícone de evento (12px, Lucide outline) sobre um círculo de 20px. O círculo tem cor baseada no tipo de evento: ações de criação em `--gate-steel` sutil, ações de revogação em `--gate-danger` a 20% de opacidade, ações de Root (impersonation, criação de org) em `--gate-key` a 20% de opacidade. Uma linha vertical fina (1px, `--gate-steel`) conecta os círculos de cima a baixo — é o "fio da linha do tempo". O conteúdo de cada evento: ator (nome + role em pill) + ação em monospace bold (`binding.create`) + target em monospace muted. Timestamp em monospace 11px no canto direito, sempre no formato relativo (`2m ago`) com full timestamp em tooltip. Eventos de DENY no audit têm um subtle left border âmbar (2px) — são os momentos em que o sistema exerceu seu poder de negar.

**Viabilidade:** CÓDIGO PURO — linha do tempo com div + border-left para o fio, ícones Lucide.

##### Card de API Key
**Representa:** Uma credencial de acesso server-side com escopos declarados — uma chave real com poderes específicos. O momento de criação é único: o secret é exibido apenas uma vez.

**Metáfora visual:** Uma chave física estilizada em SVG, onde os "dentes" da chave representam os escopos ativados. Mais escopos = mais dentes = mais poder.

**Cena detalhada:** No header do card, o identificador público da key em monospace (`gk_live_pk_...••••`) com um botão de copy. Abaixo, uma representação SVG inline de uma chave horizontal simplificada (40px de altura, 160px de largura): o cabo é um retângulo arredondado, e os dentes são retângulos verticais de 8px × 12px espaçados de 10 em 10px. Cada dente corresponde a um escopo ativo (`users:write`, `bindings:write`, etc.) e tem um tooltip com o nome do escopo. Dentes presentes = escopo ativo (cor `--gate-key`). Dentes ausentes (espaço vazio) = escopo não concedido. Abaixo da chave visual: a lista de escopos em pills de 11px monospace. Ao fundo do card (extremidade direita): o status `ACTIVE` em pill verde ou `REVOKED` em pill vermelho. Data de criação e último uso em texto muted.

**Viabilidade:** CÓDIGO PURO — chave em SVG inline, dentes como `<rect>` elementos.

##### Dashboard de Org Admin — card de uso de cotas
**Representa:** Os limites que definem o espaço de atuação da org — não como restrições punitivas, mas como a definição do território.

**Metáfora visual:** Barras de progresso, mas não retangulares genéricas. Barras segmentadas onde cada segmento representa uma unidade (usuário, workspace, etc.) — como uma régua graduada.

**Cena detalhada:** Para cada quota (usuários, workspaces, API Keys, sessões), uma linha composta de: label à esquerda (12px, muted), seguida de uma barra segmentada de 200px de largura. A barra é composta de N quadrinhos de 12px × 12px com gap de 2px, onde N é o limite máximo da quota. Quadrinhos preenchidos = entidades existentes (cor `--gate-key` em 80% opacidade). Quadrinhos vazios = capacidade disponível (cor `--gate-steel`). Ao hover sobre a barra, um tooltip mostra `X de Y usados`. Se a quota atingir 80%, os quadrinhos mudam para âmbar mais saturado. A 100%, para `--gate-danger`. À direita da barra, a contagem em monospace (`23/50`). O card inteiro tem um conceito visual: uma grade de quadrinhos que "preenche" visualmente o espaço disponível — como um inventário físico.

**Viabilidade:** CÓDIGO PURO — grid de divs com Tailwind + dinâmica via dados reais.

##### Empty State (lista vazia de bindings / roles / usuários)
**Representa:** Um sistema pronto mas ainda não configurado — o portão existe, mas nenhuma chave foi criada. Não é uma falha; é um estado inicial neutro.

**Metáfora visual:** O octógono/logo do GateKey em wireframe, com uma chave ausente (apenas o contorno pontilhado onde a chave deveria estar). A mensagem comunica o próximo passo, não o vazio.

**Cena detalhada:** Centralizado na área de conteúdo, um SVG de 120px × 120px: o octógono em outline fino (1.5px, `--gate-steel`), com um espaço interno em forma de chave em outline pontilhado (dash array 4 2, `--gate-muted`). A ausência da chave sólida é o conceito — o portão está aqui, a chave ainda não. Abaixo do ícone, título em 15px `--gate-text` sem peso excessivo, subtítulo em 13px `--gate-muted` com instrução direta. Botão âmbar de ação primária (`+ Criar binding`, `+ Criar role`, etc.). Sem ilustrações de pessoas, sem "parece que está vazio aqui!", sem emojis.

**Viabilidade:** CÓDIGO PURO — SVG inline com octógono e chave pontilhada.

---

## Tokens de Design

### Cores — Fundos
| Token | Valor | Uso |
|---|---|---|
| `surface-page` | `#0D1117` | Fundo principal da aplicação |
| `surface-card` | `#1C2333` | Cards, painéis, sidebar |
| `surface-elevated` | `#30363D` | Inputs, dropdowns, tooltips, código inline |
| `surface-hover` | `rgba(255,255,255,0.04)` | Hover em linhas de tabela, itens de lista |

### Cores — Texto
| Token | Valor | Uso |
|---|---|---|
| `text-primary` | `#C9D1D9` | Títulos, valores, texto principal |
| `text-secondary` | `#8B949E` | Labels, subtítulos, metadados |
| `text-muted` | `rgba(139,148,158,0.6)` | Placeholders, texto desabilitado |

### Cores — Accent (âmbar/dourado — UMA COR)
| Token | Valor | Uso |
|---|---|---|
| `accent-primary` | `#F0A500` | Botões primários, ícones ativos, badges de role, indicator de nav ativo |
| `accent-hover` | `#7D5500` | Hover state do accent |
| `accent-subtle` | `rgba(240,165,0,0.12)` | Fundos translúcidos de badges, hover tints, pills de capability |

### Cores — Status (APENAS para feedback funcional)
| Token | Valor | Uso |
|---|---|---|
| `status-allow` | `#3FB950` | Resultado ALLOW no PDP, sessão ativa, API Key ativa |
| `status-deny` | `#F85149` | Resultado DENY no PDP, sessão revogada, key revogada |
| `status-warning` | `#E3B341` | Quota acima de 80%, sessão próxima de expirar |

### Bordas
| Token | Valor | Uso |
|---|---|---|
| `border-default` | `rgba(48,54,61,1)` | Contornos de cards, divisores de seção |
| `border-subtle` | `rgba(255,255,255,0.06)` | Borda interna de cards (efeito de profundidade) |
| `border-accent` | `rgba(240,165,0,0.3)` | Borda de elemento com foco ou em estado ativo |

### Geometria
| Token | Valor | Uso |
|---|---|---|
| `radius-card` | `12px` | Cards, painéis, modais |
| `radius-button` | `8px` | Botões primários e secundários |
| `radius-input` | `8px` | Inputs, selects, textareas |
| `radius-badge` | `6px` | Badges de role, pills de capability |
| `radius-pill` | `9999px` | Status pills (ALLOW/DENY/ACTIVE) |

### Sombras
| Token | Valor | Uso |
|---|---|---|
| `shadow-card` | `0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)` | Cards e painéis padrão |
| `shadow-hover` | `0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)` | Cards em hover |
| `shadow-float` | `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)` | Dropdowns, modais, tooltips |
| `shadow-accent` | `0 0 0 1px rgba(240,165,0,0.4)` | Focus ring de inputs e botões |

---

## Componentes Shadcn — Overrides

| Componente | Override (tokens semânticos) |
|---|---|
| `<Card>` | `bg-surface-card border border-border-default rounded-card shadow-card` |
| `<Button variant="default">` | `bg-accent-primary text-black hover:bg-accent-hover rounded-button font-medium` |
| `<Button variant="outline">` | `border-border-default text-text-primary hover:bg-surface-hover rounded-button` |
| `<Button variant="destructive">` | `bg-transparent border border-status-deny text-status-deny hover:bg-status-deny hover:text-black rounded-button` |
| `<Badge>` | `bg-accent-subtle text-accent-primary border-0 rounded-badge font-mono text-[11px]` |
| `<Input>` | `bg-surface-elevated border-border-default text-text-primary placeholder:text-text-muted rounded-input focus-visible:ring-0 focus-visible:border-border-accent` |
| `<Table>` | `text-text-primary border-border-default` com `<TableRow>` em `hover:bg-surface-hover transition-colors` |
| `<Avatar>` | `bg-surface-elevated text-text-secondary rounded-full` |
| `<Tooltip>` | `bg-surface-elevated text-text-primary border border-border-default shadow-float rounded-badge text-[12px] font-mono` |
| `<Dialog>` | `bg-surface-card border border-border-default shadow-float rounded-card` |
| `<Select>` | `bg-surface-elevated border-border-default text-text-primary rounded-input` |

---

## Regra de Ouro

Ao criar qualquer tela ou componente no GateKey:

1. Siga as decisões de identidade em todas as três camadas — estrutura, linguagem e riqueza visual
2. shadcn/ui é a base — customize sempre via `className` com tokens semânticos
3. NUNCA valores crus — sempre os tokens definidos neste documento
4. UMA cor accent: âmbar (`accent-primary`) para tudo que é ativo, permitido ou requer ação. Nenhuma outra cor vibrante fora de status funcional (allow/deny/warning)
5. Componentes de entidade (binding, API Key, audit event, sessão) DEVEM ter um conceito visual — não são linhas de tabela genéricas
6. Código, IDs e tokens técnicos SEMPRE em JetBrains Mono — nunca Inter para dados que precisam ser escaneáveis
7. A textura de fundo de circuito é sutil demais para o usuário notar conscientemente — ela trabalha abaixo do limiar de percepção, criando profundidade sem ruído
8. **GateKey é definitivo: a interface nunca hesita, nunca decora sem propósito, nunca confunde ação com status.**

## Teste Final

Coloque o GateKey ao lado de um dashboard shadcn padrão com dark mode ativado. As diferenças devem ser óbvias em três níveis:

- **ESTRUTURA:** sidebar com contexto de hierarquia (org/workspace), layout lista + detalhe, ausência total de hero sections ou marketing interno
- **LINGUAGEM:** JetBrains Mono para todos os dados técnicos, âmbar como único elemento vibrante em um mar de cinza escuro, geometria consistente com tokens semânticos, sombras com borda interna translúcida
- **RIQUEZA:** card de binding como grafo de três nós, audit log como timeline com intensidade por tipo de evento, API Key com chave SVG de dentes = escopos, empty state com octógono + chave ausente, quotas como grade de segmentos — nenhum desses seria possível em outro app porque cada um conta a história específica do que o componente representa no GateKey

Se os cards forem caixas com texto e ícone Lucide solto, está incompleto.
Se aparecer qualquer cor vibrante além do âmbar (exceto status funcional), está errado.
Se dados técnicos estiverem em Inter, está errado.
