# Yield2Pay — Design System

> **O que é a Yield2Pay.** Fintech B2B: a empresa faz **um único aporte de capital**, a Yield2Pay
> coloca esse capital para render, e **os rendimentos pagam automaticamente os softwares** da
> empresa (ferramentas de IA e assinaturas SaaS). A empresa nunca gasta o próprio caixa nas
> ferramentas — só o rendimento trabalha — e o capital continua sendo da empresa, resgatável a
> qualquer momento.

A estética é **"banco privado, digital"**: sóbria, premium, monocromática **preto + prata polida**,
com **superfícies de metal escovado** como material assinatura. É reservada e confiante — mais
perto de um cartão de metal ou de um extrato de private bank do que de uma startup cripto barulhenta.

> **Temática e intenção da marca:** veja `BRIEFING.md` (o que a marca transmite e por quê) antes
> de aplicar os valores abaixo.

Este documento é a fonte de verdade do sistema **na forma como ele é realmente usado nos arquivos
`.dc.html`**: estilos inline, dois tipos de fonte, paleta monocromática e os efeitos de metal/luz.
Os valores abaixo são literais — copie-os diretamente para o `style="..."`.

---

## 1. Princípios inquebráveis

1. **Monocromático apenas** — preto-quase-puro + prata polida. **Sem cores vibrantes** (nada de
   roxo, azul neon, verde berrante). A elegância vem do contraste preto/prata e do espaço negativo.
2. **Metal escovado é o material assinatura** — cards, painéis e chips não são chapados: usam o
   gradiente de metal + grão diagonal + borda de 1px + brilho interno no topo.
3. **Duas fontes só** — **Hanken Grotesk** (display/corpo) e **Geist Mono** (todo dado, rótulo,
   eyebrow, saldo).
4. **Sentence case** na prosa. Maiúsculas só nos *kickers* mono (com letter-spacing). **Sem emoji.**
5. **Movimento contido** — entradas em *fade*; a vida vem do **light sweep** atravessando o metal e
   de um *float* lento. Fundo nunca anima. Respeite `prefers-reduced-motion`.
6. **Bilíngue EN + PT-BR** — inglês como padrão, ambos sempre em lockstep, mesmo tom.

---

## 2. Cores (valores literais)

Use os hex diretamente no `style`. Os nomes `--fx-*` existem em `tokens/colors.css` para referência.

### Tinta / página
| Uso | Hex |
|---|---|
| Fundo da página (preto-quase) | `#0c0d0f` |
| Superfície leve elevada | `#131417` |
| Poço de controle (toggle de idioma) | `#16181b` |
| Parada mais profunda do metal | `#1b1d21` |

### Metal escovado
- **Preenchimento canônico** (135°):
  `linear-gradient(135deg,#3c3f44 0%,#26282c 26%,#16181b 52%,#303338 74%,#1b1d21 100%)`
- **Grão** (overlay diagonal, aplicar em `::after` com `opacity:.5`):
  `repeating-linear-gradient(118deg,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 1px,transparent 4px)`
- **Sweep** (brilho que viaja):
  `linear-gradient(90deg,transparent,rgba(255,255,255,.26),transparent)`

### Prata / cromo
| Uso | Valor |
|---|---|
| Prata padrão (traço de ícone, acento) | `#C0C2C5` |
| Prata brilhante (realce, ponto ativo) | `#D4D6D9` |
| **Botão cromado** (ação primária) | `linear-gradient(180deg,#E6E8EA,#A8AAAD)` |
| Texto/ícone sobre cromo | `#0E0F11` |

### Bordas (hairline 1px)
| Uso | Hex |
|---|---|
| Padrão em controles | `#2A2D31` |
| Borda de card | `#3a3d42` |
| Borda de painel de metal | `#4a4d52` |
| Faint (rodapé/divisória) | `rgba(255,255,255,.06)` |

### Texto
| Uso | Hex |
|---|---|
| Primário sobre escuro | `#EDEFF1` |
| Numérico / ênfase | `#F2F3F4` |
| Secundário / corpo apagado | `#9A9DA1` |
| Rótulos terciários | `#8a8d91` |
| Copyright do rodapé | `#7E8186` |
| Desabilitado | `#5F6266` |

`::selection` → fundo `rgba(192,194,197,.25)`, texto `#fff`.

---

## 3. Tipografia

Duas famílias, servidas pelo Google Fonts (já incluídas no `<helmet>` de cada tela):

- **Hanken Grotesk** — display + corpo. Títulos peso **700**, tracking apertado **-0.025em**,
  com a **sombra de emboss** (parece prensado no metal):
  `text-shadow:0 1px 0 rgba(255,255,255,.13),0 -1px 1px rgba(0,0,0,.6)`. Hero fluido
  `clamp(38px,5.6vw,66px)`.
- **Geist Mono** — todos os dados, rótulos, eyebrows e saldos. Maiúsculo com letter-spacing nos
  kickers; natural nos números grandes.

### Escala
| Token | Tamanho | Uso |
|---|---|---|
| Hero h1 | `clamp(38px,5.6vw,66px)` | título principal |
| Section h2 | `clamp(30px,3.4vw,40px)` | título de seção |
| Card h3 | `20px` | título de card |
| Lead/subtítulo | `clamp(16px,1.4vw,19px)` | apoio |
| Corpo | `16px` | texto base |
| Pequeno | `14.5px` | nav, links |
| XS | `13px` | meta |
| Eyebrow mono | `12px` · tracking `0.16em`–`0.2em` · UPPERCASE | kicker |
| Mono meta | `11px` | meta em cards |
| Dado grande | `~33px` mono | saldo |

Pesos: 400 / 500 / 600 / 700 / 800. Line-heights: display `1.06`, snug `1.2`, corpo `1.6`.

---

## 4. Material: metal, sweep, emboss

Os efeitos vivem em classes CSS no `<helmet>` (copie o bloco — ver `GUIA-IA-TELAS.md` §3):

- **`.brushed`** — superfície de metal escovado (gradiente + grão via `::after`).
- **`.sweep`** — faixa de luz que cruza em loop lento (`sweepX 6.5s`), usada em hero/CTA.
- **`.msheen` + `.mcard:hover .msheen`** — brilho que **dispara uma vez no hover** dos cards.
- **`.btn-shine`** — varredura cromada que cruza o botão no hover.
- **Emboss** — `h1,h2` recebem a `text-shadow` de emboss automaticamente.

Toda superfície de metal leva: gradiente + grão + **borda 1px** (`#4a4d52`) + **brilho interno no
topo** (`0 1px 0 rgba(255,255,255,.12) inset` ou similar) + sombra externa profunda.

---

## 5. Movimento

Contido. As entradas são **fade** (só opacidade, sem grandes deslocamentos verticais), com leve
*stagger* em grades. Keyframes canônicos (no `<helmet>`):

- `sweepX` — loop da faixa de luz no metal.
- `sweepOnce` — sweep único no hover.
- `floaty` — flutuação suave de ±8px no card do hero.
- `revealIn` / `fadeUp` / `wordIn` / `ctaIn` — entradas em fade (palavra a palavra no título).
- `cardIn3D` — card do hero entra com leve tilt 3D.
- `btnGlow` — anel de brilho prata único no CTA primário.
- `marquee` — logos rolam em loop infinito (pausa no hover).

**Hover/press.** Botões: sobem `translateY(-1px) scale(1.02)`, filtro mais brilhante e anel de
brilho prata + sweep cromado. Cards: borda clareia para `#4a4d52`, sweep de luz e leve tilt 3D que
segue o cursor. Links: apagado → `#EDEFF1`.

Tudo dentro de `@media (prefers-reduced-motion:reduce)` é zerado.

---

## 6. Espaçamento, raios e layout

- **Raios:** `5px` chips engravados → `12px` icon tiles → `14px` superfícies pequenas → `18px`
  cards → `22–26px` painéis grandes → `999px` pílulas/botões. Cards generosamente arredondados,
  nunca em ponta viva.
- **Layout:** centralizado, max `1200px`, gutters `24px`. Padding de seção generoso
  `clamp(86px,11vw,128px)`. Grades com `repeat(auto-fit, minmax(...))` + `gap`.
- **Header:** fixo, transparente no topo, vira barra translúcida com `backdrop-filter:blur(16px)`
  ao rolar (classe `.header.scrolled`).
- **Bordas:** sempre hairline 1px. Divisórias muitas vezes são uma régua em gradiente que apaga no
  centro, não uma linha sólida.
- **Elevação:** sombras profundas e suaves sobre o preto, sempre pareadas com o brilho interno no
  topo. Mais alto = sombra maior/mais escura, nunca um glow colorido (exceto o anel prata de hover).

---

## 7. Iconografia

Ícones de **linha fina** (stroke), `1.4–1.6px`, pontas/juntas arredondadas, grade 24×24, em prata
(`#C0C2C5` / `#D4D6D9`). Ficam dentro de **icon tiles de metal** (quadrado arredondado 44–48px) ou
inline ao lado de pontos de confiança. Peso visual equivalente ao **Lucide** (lucide.dev) —
fonte recomendada por CDN para qualquer ícone que falte; mantenha stroke 1.4–1.6 e `currentColor`
numa cor prata.

- **Sem emoji. Sem ícones preenchidos/duotone** — só linha.
- Unicode é usado com parcimônia para marcas mínimas: `▲` (retorno positivo), `◆` (quadrado prata
  girado = marca Yield2Pay), `·` (separador).
- **Logo:** wordmark "Yield2Pay" (Hanken Grotesk 700, `-0.01em`) precedido de um diamante prata
  (quadrado 11px girado, radius 2, com glow suave). Arquivo: `assets/logo-mark.svg`.

---

## 8. Conteúdo e voz

- **Tom.** Calmo, direto, tranquilizador. Explica uma mecânica nova em palavras do dia a dia e
  promete sempre as mesmas três coisas: *você não gasta nada*, *seu dinheiro continua seu*,
  *resgate quando quiser*. Sem hype, sem exclamação, sem jargão além de "capital", "rendimento",
  "assinaturas".
- **Pessoa.** Segunda pessoa — "**você / seu**". A Yield2Pay é "nós", usado com parcimônia.
- **Forma da frase.** Curta. Muitas vezes dois tempos unidos por ponto ou travessão:
  *"Seu capital paga seus softwares. Você não gasta nada."*
- **Números.** Monoespaçados, concretos, plausíveis: `R$ 92.000,00`, `+8,4% / ano`, `R$ 1.074`.
  Localizados por idioma (BRL com vírgula decimal; USD com ponto).
- **Bilíngue.** EN padrão. PT-BR com o mesmo tom. Mantenha os dois dicionários sincronizados.
- **Emoji.** Nunca. O calor da marca vem da clareza e do material.

---

## 9. Inventário do projeto

### Telas (`.dc.html`, na raiz — abrem direto no navegador)
| Arquivo | Papel |
|---|---|
| `Yield2Pay.dc.html` | Landing de marketing (toggle EN/PT) |
| `Yield2Pay Auth.dc.html` | Login / cadastro (lê `?mode=signup`) |
| `Yield2Pay Dashboard Cliente.dc.html` | Visão geral do cliente logado |
| `Yield2Pay Directions.dc.html` | Explorações de direção de arte do hero |
| `Yield2Pay Hero Variations.dc.html` | Variações de hero |
| `Yield2Pay v1 (prata).dc.html` | Versão 1 (prata) |

**Fluxo interligado:** Landing → (Entrar / Começar) → Auth → (envio do form / Google) → Dashboard.
O logo volta à landing; o botão "Sair" volta ao Auth.

### Pastas de referência
| Pasta | Conteúdo |
|---|---|
| `tokens/` | CSS custom properties `--fx-*` (cores, tipografia, espaçamento, raios, sombras, motion) |
| `guidelines/` | Cartões-espécime das fundações (tipo, cores, espaçamento, marca) |
| `components/` | Primitivas React de referência (Button, Badge, MetalCard, StatPanel, forms, etc.) |
| `ui_kits/` | Recriações de alta fidelidade (landing, dashboard, deposit) |
| `assets/` | `logo-mark.svg` (diamante prata) |
| `styles.css` | Entry point que importa todos os tokens |

> ⚠️ As telas reais (`.dc.html`) **não importam** `styles.css` nem usam as primitivas React — elas
> usam **estilos inline** com os valores literais deste documento. Os tokens/components servem como
> fonte de verdade e referência. Veja `GUIA-IA-TELAS.md` para o padrão prático de construção.

---

## 10. Caveats

- Fontes vêm do **Google Fonts** (Hanken Grotesk, Geist Mono) — batem com o site real.
- Não há codebase externo nem Figma: este sistema foi derivado da landing. Props das primitivas são
  uma interpretação sensata, não uma API existente.
- Sinalize ao usuário qualquer substituição de ícone, fonte ou cor fora da paleta.
