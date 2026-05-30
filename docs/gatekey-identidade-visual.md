# IDENTIDADE VISUAL — GateKey
> Fonte de verdade extraída do código real (Claude Design, maio 2026).
> Não descreve intenções — documenta o que já existe e funciona.

---

## Stack & Setup

- **CSS:** arquivo `styles.css` separado com custom properties no `:root`. Sem Tailwind — CSS puro e classes semânticas.
- **Fonts (carregar via Google Fonts ou self-hosted):**
  - `Space Grotesk` — display, títulos de página, valores grandes nos stats
  - `Inter` — interface geral
  - `JetBrains Mono` — qualquer dado técnico: IDs, IPs, timestamps, tokens, labels de filtro, badges de nav
- **Ícones:** SVG inline custom (definidos no componente `Icon`). Sem lib externa.
- **Logo:** SVG inline `LogoMark` — octógono `10 3 h12 l7 7 v12 l-7 7 H10 l-7-7 V10z` + ponteiro interno em `L` + círculo central. Stroke `#F0A500`, strokeWidth 1.6, strokeLinejoin miter.

---

## Tokens de Cor

```css
:root {
  /* Fundos — do mais escuro ao mais claro */
  --bg:            #0d1117;   /* página */
  --sidebar:       #0a0e14;   /* sidebar (mais escuro que bg) */
  --card:          #141b26;   /* cards, tabela, panels */
  --card-elev:     #1c2333;   /* inputs, kv-blocks, superfície elevada */
  --border:        #232a36;   /* bordas default */
  --border-strong: #30363d;   /* bordas com mais peso */
  --border-soft:   #1a212c;   /* separadores sutis entre linhas */

  /* Texto */
  --text:        #c9d1d9;   /* texto principal */
  --text-strong: #e6edf3;   /* títulos, valores em destaque */
  --muted:       #8b949e;   /* labels, metadados secundários */
  --muted-2:     #6e7681;   /* deltas, sub-labels */
  --muted-3:     #4d5560;   /* placeholders, numeração, decoração */

  /* Accent — UMA cor. Âmbar. */
  --accent:        #f0a500;
  --accent-dim:    #b07a00;                   /* hover do accent */
  --accent-soft:   rgba(240, 165, 0, 0.08);  /* bg de nav ativo, chip ativo */
  --accent-soft-2: rgba(240, 165, 0, 0.14);  /* hover mais forte */

  /* Status — apenas para feedback funcional */
  --green: #3fb950;   /* ativo, live, ok */
  --red:   #f85149;   /* revogado, erro, danger */

  /* Interação */
  --row-hover: rgba(255, 255, 255, 0.025);  /* hover em linhas de tabela */
  --row-focus: rgba(240, 165, 0, 0.04);     /* linha selecionada */

  /* Tipografia */
  --mono:    "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --display: "Space Grotesk", "Inter", system-ui, sans-serif;
  --sans:    "Inter", system-ui, -apple-system, sans-serif;
}
```

---

## Tipografia

| Uso | Família | Tamanho | Peso | Letter-spacing |
|---|---|---|---|---|
| Título de página (`.page-title`) | `--display` | 26px | 500 | -0.02em |
| Número decorativo no título (`.num`) | `--mono` | 20px | 400 | 0 |
| Subtítulo de página | `--sans` | 12.5px | 400 | — |
| Header de seção de nav | `--mono` | 9px | 400 | 0.18em, uppercase |
| Item de nav | `--sans` | 12.5px | 400/500 | — |
| Header de tabela (`thead`) | `--mono` | 9.5px | 400 | 0.14em, uppercase |
| Dado técnico na tabela | `--mono` | 11.5–12px | 500 | -0.005em |
| Sub-info na tabela | `--mono` | 10px | 400 | 0.02em |
| Labels de filtro | `--mono` | 9.5px | 400 | 0.06–0.16em |
| Stat value | `--display` | 28px | 500 | -0.02em |
| Stat label | `--mono` | 9.5px | 400 | 0.16em, uppercase |
| Pills / badges | `--mono` | 8.5px | 600 | 0.14em |
| Botões | `--mono` | 11px | 400/600 | 0.06em, uppercase |
| Status bar | `--mono` | 9.5px | 400 | 0.1em, uppercase |
| Metadados `page-coords` | `--mono` | 9.5px | 400 | 0.08em |
| Versão / breadcrumb | `--mono` | 9.5–11px | 400 | 0.04–0.16em |

**Regra:** Interface em `--sans`. Dados técnicos (IDs, IPs, tokens, timestamps, counters, versões, labels de nav numerados, filtros) em `--mono`. Títulos de página em `--display`.

---

## Geometria & Bordas

**Sem border-radius.** Toda a interface usa ângulos retos — cards, inputs, modais, botões, pills, chips, avatares. A sensação de precisão vem da ausência de arredondamento.

**Cantos cortados (corner brackets):** o elemento de identidade mais característico do GateKey. Implementado com `::before`/`::after` em `position: absolute`, criando uma marca de 5–10px nos cantos opostos com borda âmbar. Aparece em: tabela, modais, inputs em foco, context pill da sidebar, avatares, toasts, empty state.

```css
/* Padrão de canto cortado — aplicado em .table, .modal, .empty, .toast */
.elemento::before,
.elemento::after {
  content: "";
  position: absolute;
  width: 6px;      /* varia: 5px (small), 6px (default), 10px (modal) */
  height: 6px;
  border-color: var(--accent);
  border-style: solid;
  z-index: 2;
  pointer-events: none;
}
.elemento::before {
  top: -1px; left: -1px;
  border-width: 1px 0 0 1px;  /* canto superior esquerdo */
}
.elemento::after {
  bottom: -1px; right: -1px;
  border-width: 0 1px 1px 0;  /* canto inferior direito */
}
```

**Inputs em foco** têm o mesmo efeito de canto cortado + `border-color: var(--accent)` — sem outline, sem box-shadow.

---

## Layout do App

```
┌──────────────────────────────────────────────────┐
│ sidebar (220px fixo) │ main (flex: 1)            │
│                      │ ┌──────────────────────┐  │
│  sidebar-meta        │ │ topbar (52px)         │  │
│  sidebar-head        │ ├──────────────────────┤  │
│    brand             │ │ content (overflow)    │  │
│    context-pill      │ │   page-head           │  │
│  nav-section         │ │   stats-strip         │  │
│    nav-items         │ │   filters             │  │
│  sidebar-foot        │ │   table / empty       │  │
│    settings          │ ├──────────────────────┤  │
│    user-chip         │ │ status-bar (22px)     │  │
└──────────────────────┴─┴──────────────────────┴──┘
```

- `grid-template-columns: 220px 1fr`
- `height: 100vh`, `overflow: hidden` no `.app`
- `.content` tem `overflow: auto`, `padding: 22px 24px 64px`

---

## Componentes

### Sidebar

```
sidebar-meta     → "// gatekey.iam" + versão em mono 9.5px, --muted-3, uppercase
sidebar-head     → brand + context-pill
  brand          → LogoMark (22px) + "GateKey" em --display 16px bold + "CTRL" pill
  context-pill   → border 1px --border + cantos cortados âmbar 5px
                   ctx-tag: "scope context" em mono 8.5px uppercase --muted-3
                   ctx-row: "root :: acme-prod" + dot pulsante âmbar
nav-section      → "/ administração" em mono 9px uppercase --muted-3
  nav-item       → padding 9px 14px, border-left 2px transparent
    [ativo]      → border-left 2px --accent + bg --accent-soft + cor --text-strong
    numeração    → mono 9.5px --muted-3 (fica âmbar quando ativo)
    ícone SVG    → 14px, cor herdada
    label        → flex:1, weight 400 (500 quando ativo)
    count        → mono 10px --muted-2 (âmbar quando ativo)
sidebar-foot     → settings + user-chip
  avatar         → 28×28px, border 1px --border-strong, sem radius
                   iniciais em mono 10px --accent, cantos cortados âmbar 3px
  user-name      → mono 11.5px --text
  user-sub       → mono 9.5px --muted-3 uppercase
```

**Dot pulsante** (`.ctx-dot`, `.live-clock-dot`):
```css
animation: pulse 2.4s ease-in-out infinite;
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(240, 165, 0, 0.12); }
  50%       { box-shadow: 0 0 0 3px rgba(240, 165, 0, 0.22); }
}
```

---

### Topbar

- 52px de altura, `border-bottom: 1px solid var(--border-strong)`
- **Efeito scan:** linha âmbar de 80px percorre toda a largura em 6s na borda inferior:

```css
.topbar::after {
  content: "";
  position: absolute;
  left: 0; bottom: -1px;
  height: 1px; width: 80px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  animation: scan 6s linear infinite;
}
@keyframes scan {
  0%   { left: 0; }
  100% { left: calc(100% - 80px); }
}
```

- Breadcrumb em mono: `scope` (--muted-3 uppercase 9.5px) → `root` (--muted) → `›` → `sessions.active` (--text)
- Live clock com dot verde pulsante + timestamp UTC
- Search bar: border 1px --border, mono 10.5px, atalho `⌘K` em kbd pill
- Icon buttons: 28×28px, border 1px --border, hover vira âmbar

---

### Page Head

```
page-prefix  → "// · module · sessions.active · scope · root"
               slash em âmbar, resto em --muted-3
page-title   → .num ("01") em mono --muted-3 + texto em --display 26px
page-sub     → --sans 12.5px --muted, max-width 580px
page-coords  → spans mono 9.5px: node / ts / tenant / caller
               key em --muted, valor em --text
page-actions → btn-ghost + btn-primary
```

Separador: `border-bottom: 1px dashed --border-soft` + linha âmbar sólida de 32px à esquerda via `::after { bottom: -1px; left: 0; width: 32px; height: 1px; background: var(--accent) }`.

---

### Stats Strip

5 células em `grid-template-columns: repeat(5, 1fr)`, separadas por `gap: 1px` sobre fundo `--border`.

```
stat          → bg --card, padding 14px 16px
stat::before  → linha de 24px no topo: --muted-3 (danger → --red, warn → --accent)
stat-label    → mono 9.5px uppercase --muted + tick "[24h]" à direita
stat-value    → --display 28px weight 500 + delta em mono 10.5px --muted-2
stat-bar      → 2px height, --border como track, fill colorido
```

`data-kind="danger"` → valor e fill em `--red`
`data-kind="warn"` → valor e fill em `--accent`

---

### Filtros

```
filters-head → label com ::before { content: "//" } em --accent
filters-row  → dois fields lado a lado, max-width 380px cada
field-label  → mono 9.5px --muted lowercase + "›" âmbar via ::before
input        → height 34px, border 1px --border, bg transparent
               foco: border --accent + cantos cortados 4px âmbar
               inner: mono 12px --text, placeholder --muted-3
chip-row     → chips de filtro agrupados por "device" e "urgency"
chip         → mono 10.5px, border 1px --border, bg transparent, --muted
               [active]: âmbar text + --accent-soft bg + --accent border
chip-sep     → 1px × 14px --border-strong entre grupos
```

---

### Tabela

Grid de colunas: `28px minmax(260px, 2fr) 1.1fr 1fr 0.85fr 1fr 0.9fr`

```
table-meta   → mono 9.5px uppercase: contagem + sort + poll status ("● live" em --green)
thead        → height 32px, bg rgba(255,255,255,0.012), border-bottom --border-strong
trow         → min-height 46px, border-bottom 1px --border-soft
               hover: bg --row-hover + índice vira âmbar
               [focused]: bg --row-focus + border-left 2px --accent
               [revoked]: opacity 0.5
```

**Colunas:**
- `c-idx` — mono 9.5px --muted-3 (âmbar no hover/foco)
- `c-user` — userId em mono 12px weight 500 --text-strong + sub (location · ua) em mono 10px --muted-2
- `c-ip` — IP em mono 11.5px + sufixo "/32" em --muted-3 9.5px
- `c-device` — ícone 13px + texto uppercase 0.08em + "mfa · tipo" em --muted abaixo
- `c-created` — relPast() em mono --text
- `c-expires` — relFuture() com cor por urgência: verde (>24h), âmbar (<24h), vermelho (<1h). Wrapped em `[valor]` com colchetes em --muted-3
- `c-actions` — btn-revoke com `opacity: 0; transform: translateX(4px)` → aparece no hover da row. Hover do botão: --red

**Pills de status:**
```css
.pill-active  → color: --green; bg: rgba(63,185,80,0.07); border: rgba(63,185,80,0.32)
                dot 4px verde + texto "ATIVA"
.pill-revoked → color: --red; bg: rgba(248,81,73,0.06); border: rgba(248,81,73,0.32)
```

**Empty state (sem matches):**
```
grid 3 colunas: barra âmbar 3px | título + query params | btn "reset"
título: mono 11px --text uppercase "// no matches"
sub: mono 10.5px --muted com os params ativos interpolados
```
Cantos cortados âmbar 6px no container. Sem ícone, sem ilustração.

---

### Botões

```css
.btn-ghost, .btn-primary {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  height: 30px;
  padding: 7px 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  /* SEM border-radius */
}

.btn-ghost {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
}
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

.btn-primary {
  background: var(--accent);
  color: #0a0700;   /* preto quente, não puro */
  font-weight: 600;
  border: 1px solid var(--accent);
}
.btn-primary:hover { background: #ffb71a; border-color: #ffb71a; }
```

Botão destrutivo (modal): bg --red, border --red, color #fff.

---

### Modal

- Width 480px, bg --card, **border 1px --accent** (não --border)
- Cantos cortados âmbar 10px (maior que o padrão de 6px)
- `modal-head` → mono 11px uppercase âmbar + ícone warn + label-right em --muted-3
- `modal-body` → --sans 12px --muted, kv-block em --sidebar com border --border-soft
  - `kv` → grid 88px 1fr, key --muted lowercase, value --text, tudo mono 11px
- `modal-foot` → btn-ghost + btn-primary destrutivo
- Scrim: `rgba(5, 8, 12, 0.7)` + `backdrop-filter: blur(3px)`

---

### Status Bar

22px, fixo no bottom, bg --sidebar, border-top 1px --border-strong.
Mono 9.5px uppercase --muted-3. Itens: `● api · 142ms` (dot verde) · region · build · ts · tenant.

---

### Toast

Fixed bottom-right 22px. bg --card, border 1px --accent, cantos cortados 5px âmbar.
Mono 11px. Prefix `[ok]` em âmbar.
```css
@keyframes toast-in {
  from { transform: translateY(8px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}
```

---

## Os 8 Padrões que fazem o GateKey parecer GateKey

1. **Cantos cortados âmbar** — sem border-radius, marcas diagonais com `::before`/`::after`. Em tudo que é container relevante.

2. **Monospace em tudo técnico** — IDs, IPs, timestamps, versões, labels de nav numerados, filtros, contadores. A alternância Inter/JetBrains dentro do mesmo componente é intencional.

3. **Scan animado no topbar** — gradiente âmbar de 80px atravessando a borda inferior em 6s.

4. **Numeração sequencial** — itens de nav com `01`, `02`..., linhas de tabela com índice, stats com código `001`–`005`. Linguagem de sistema.

5. **Slash como pontuação** — `//` antes de seções, `·` como separador, `::` no context pill. Âmbar nos slashes, --muted-3 no resto.

6. **Urgência como cor de dado** — expiração muda de cor (verde/âmbar/vermelho) sem pill ou badge. A cor do valor em si é o indicador.

7. **Dot pulsante** — dot verde (live clock) e dot âmbar (context pill). Animação lenta 2–2.4s via box-shadow, não scale.

8. **Hover revela ação** — "Revogar" não existe visualmente até o hover da linha. Fade + translateX(4px→0).

---

## O que NUNCA fazer

- `border-radius` em qualquer componente estrutural
- Gradientes decorativos (o scan do topbar é o único, e é animado/funcional)
- Sombras coloridas ou glow
- Ícones de libs externas — SVGs são custom inline
- Textura de fundo (X, losango, dot grid, noise) — fundo liso `--bg`
- Mais de uma cor accent — `--accent` é âmbar e só âmbar
- Inter para dados técnicos
- Full-width em botões primários de formulário
- Empty state com ícone grande centralizado solto — o padrão é barra âmbar lateral + texto mono + params interpolados
