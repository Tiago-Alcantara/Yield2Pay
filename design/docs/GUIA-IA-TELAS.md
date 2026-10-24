# Guia da IA — Como montar novas telas Yield2Pay

Este guia é para uma IA (ou pessoa) criar **novas telas no exato padrão já usado neste projeto**.
Leia junto com `DESIGN-SYSTEM.md` (a fonte de verdade visual). Aqui está o **como**: estrutura de
arquivo, esqueleto para copiar, padrão da lógica, navegação entre telas e checklist.

> **Regra de ouro:** toda tela é um **Design Component** — um único arquivo `Nome.dc.html` que abre
> direto no navegador. Estilo é **inline** (valores literais do design system). Não use `styles.css`,
> não use as primitivas React de `components/`, não crie stylesheets com classes (exceto o bloco fixo
> do `<helmet>` que carrega fontes, efeitos de metal e keyframes).

---

## 1. Estrutura do projeto (o que olhar antes de criar)

```
/                              ← raiz: as telas .dc.html vivem aqui
├─ Yield2Pay.dc.html             ← landing  (referência de hero, header, footer, sweep)
├─ Yield2Pay Auth.dc.html        ← login/cadastro (referência de form, inputs, validação)
├─ Yield2Pay Dashboard Cliente.dc.html  ← app logado (referência de sidebar, cards, tabs)
├─ DESIGN-SYSTEM.md            ← cores, tipo, material, motion (LEIA PRIMEIRO)
├─ GUIA-IA-TELAS.md            ← este arquivo
├─ tokens/                     ← --fx-* (referência de valores)
├─ components/                 ← primitivas React (referência de anatomia, NÃO importar)
├─ guidelines/                 ← cartões-espécime das fundações
├─ ui_kits/                    ← recriações completas (referência de composição)
└─ assets/logo-mark.svg
```

**Antes de construir qualquer tela nova:**
0. Leia `docs/INVENTARIO.md` (gerado por `pnpm design:sync`): lista os tokens, componentes e telas
   que o app tem **hoje**. Reaproveite o que existe; não invente token, cor ou componente novo.
   Ao terminar uma tela/campo, rode `pnpm design:sync` para manter o inventário atualizado.
1. Leia `DESIGN-SYSTEM.md` para os valores literais.
2. Abra a tela existente mais parecida (landing, auth ou dashboard) e **copie o padrão dela** —
   header, espaçamentos, cards, o dicionário EN/PT, os handlers.
3. Reuse os mesmos hex, as mesmas classes de `<helmet>`, o mesmo formato de logo.

---

## 2. Anatomia de um arquivo `.dc.html`

Todo arquivo segue esta ordem (gerada pela ferramenta `dc_write` — você fornece só as 3 partes):

```
<!DOCTYPE html> … <head><script src="./support.js"></script></head>   ← scaffolding (automático)
<x-dc>
  <helmet> … fontes + <style> com resets, classes de metal, keyframes … </helmet>
  … TEMPLATE: markup com estilos inline e furos {{ valor }} …
</x-dc>
<script data-dc-script>
  class Component extends DCLogic { … }      ← LÓGICA: estado, i18n, handlers
</script>
```

As 3 partes que você escreve:
- **Template** (`b_dc_html`): o markup entre `<x-dc>` e `</x-dc>`. Estilos **inline**. Furos são
  só caminhos pontilhados: `{{ login }}`, `{{ item.label }}` — nunca expressões.
- **Lógica** (`c_dc_js`): `class Component extends DCLogic { … }`, sem `<script>`.
- **Props** (`d_props_json`, opcional): metadados de tweaks.

---

## 3. Bloco `<helmet>` — copie este boilerplate

Este é o cabeçalho-padrão de toda tela Yield2Pay. Carrega as duas fontes, reseta o body para o preto
da marca, e define as classes de metal/sweep/shine + os keyframes. **Cole no início do template.**

```html
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:#0c0d0f;color:#EDEFF1;font-family:'Hanken Grotesk',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
::selection{background:rgba(192,194,197,.25);color:#fff}
h1,h2{text-shadow:0 1px 0 rgba(255,255,255,.13),0 -1px 1px rgba(0,0,0,.6)}
:focus-visible{outline:2px solid #C0C2C5;outline-offset:3px;border-radius:4px}
/* metal escovado */
.brushed{position:relative;background:linear-gradient(135deg,#3c3f44 0%,#26282c 26%,#16181b 52%,#303338 74%,#1b1d21 100%)}
.brushed::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(118deg,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 1px,transparent 4px);opacity:.5;pointer-events:none}
/* light sweep (loop em hero/CTA) */
.sweep{position:absolute;top:0;bottom:0;left:0;width:42%;z-index:1;background:linear-gradient(90deg,transparent,rgba(255,255,255,.26),transparent);transform:translateX(-130%) skewX(-12deg);animation:sweepX 6.5s ease-in-out infinite;pointer-events:none}
/* sheen único no hover de cards */
.msheen{position:absolute;top:0;bottom:0;left:0;width:55%;z-index:1;background:linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent);transform:translateX(-130%) skewX(-12deg);opacity:0;pointer-events:none}
.mcard:hover .msheen{animation:sweepOnce .9s ease;opacity:1}
/* varredura cromada no botão */
.btn-shine{position:relative;overflow:hidden}
.btn-shine::before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 26%,rgba(255,255,255,.5) 48%,transparent 68%);transform:translateX(-135%);transition:transform .6s ease;pointer-events:none}
.btn-shine:hover::before{transform:translateX(135%)}
@keyframes sweepX{0%{transform:translateX(-130%) skewX(-12deg)}55%,100%{transform:translateX(130%) skewX(-12deg)}}
@keyframes sweepOnce{0%{transform:translateX(-130%) skewX(-12deg)}100%{transform:translateX(170%) skewX(-12deg)}}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes revealIn{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.sweep,.msheen,.btn-shine::before{animation:none}html{scroll-behavior:auto}}
</style>
</helmet>
```

Só vão no `<style>` do helmet coisas que **não dá** para fazer inline: `@font-face`/`@keyframes`,
resets do body, e as classes de efeito acima. Todo o resto é `style="..."` inline.

---

## 4. Padrão da lógica (estado + bilíngue + handlers)

Toda tela Yield2Pay usa o mesmo esqueleto de lógica: estado com `lang`, um dicionário `en`/`pt`
dentro de `renderVals()`, e os handlers expostos por nome.

```js
class Component extends DCLogic {
  state = { lang: 'en' /* + estado da tela: mode, tab, nav, values… */ };

  setLang(lang) { if (lang !== this.state.lang) this.setState({ lang }); }

  renderVals() {
    const dict = {
      en: { /* TODAS as strings em inglês */ login: 'Log in', cta: 'Get started' },
      pt: { /* mesmas chaves em PT-BR */     login: 'Entrar', cta: 'Começar' },
    };
    const lang = this.state.lang;
    const t = dict[lang];
    const isEn = lang === 'en';

    // estilos do toggle de idioma (padrão repetido em todas as telas)
    const tabBase = { fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, padding: '5px 11px', borderRadius: '999px', border: 'none', cursor: 'pointer' };

    return {
      ...t,                                   // expõe cada string por nome → {{ login }}
      isEn, isPt: !isEn,
      enTabStyle: { ...tabBase, background: isEn ? '#2E3136' : 'transparent', color: isEn ? '#F2F3F4' : '#9A9DA1' },
      ptTabStyle: { ...tabBase, background: !isEn ? '#2E3136' : 'transparent', color: !isEn ? '#F2F3F4' : '#9A9DA1' },
      setEn: () => this.setLang('en'),
      setPt: () => this.setLang('pt'),
      // … outros handlers de navegação/estado …
    };
  }
}
```

Regras importantes da lógica:
- **Nada de lógica nos furos do template.** `{{ a + b }}`, `{{ !x }}`, `{{ fn() }}` falham em
  silêncio. Calcule em `renderVals()` e exponha por nome.
- **Toda string de UI passa pelo dicionário EN/PT.** Sem texto cru hardcoded no template.
- **`React.createElement` só para ícones SVG** (como nas telas existentes), nunca para layout —
  layout é markup no template, senão o editor não consegue clicar dentro.

---

## 5. Navegação entre telas

As telas são arquivos `.dc.html` na mesma pasta. Para ligar uma à outra:

- **Link simples** (logo, "Entrar"): `<a href="Yield2Pay%20Auth.dc.html">` — espaços viram `%20`.
- **Botão / ação** (CTA, "Sair", submit): handler no `renderVals()` com
  `window.location.href = 'Yield2Pay%20Dashboard%20Cliente.dc.html'`.
- **Passar intenção** via query string: a landing manda `?mode=signup`; o Auth lê em
  `componentDidMount()` com `new URLSearchParams(window.location.search).get('mode')`.

Fluxo atual já cabeado (use como referência ao adicionar telas):

```
Landing ──"Entrar"──────────────▶ Auth (login)
Landing ──"Começar"─────────────▶ Auth (?mode=signup)
Auth ────submit / Google────────▶ Dashboard
Auth ────logo───────────────────▶ Landing
Dashboard ─logo─────────────────▶ Landing
Dashboard ─"Sair"───────────────▶ Auth
```

Ao criar uma tela nova, decida de onde se chega a ela e para onde ela leva, e ligue os dois lados.

---

## 6. Receita passo a passo para uma tela nova

1. **Copie a tela existente mais próxima** como ponto de partida (não comece do zero).
2. **Renomeie** para `Nome Descritivo.dc.html` na raiz.
3. **Mantenha o `<helmet>`** (§3) intacto.
4. **Header/sidebar e footer:** reaproveite o markup da landing/dashboard — mesmo logo (diamante
   prata + wordmark), mesmo toggle EN/PT.
5. **Conteúdo:** monte com estilos inline usando os valores do `DESIGN-SYSTEM.md`. Cards em
   `.brushed`/`.mcard`, botões primários no gradiente cromado com `.btn-shine`, números em Geist
   Mono, eyebrows mono em maiúsculo.
6. **Lógica:** reescreva o dicionário `en`/`pt` com as strings da nova tela; mantenha o padrão de
   `setLang`/handlers.
7. **Ligue a navegação** (§5) de e para a tela.
8. **Revise pelo checklist** (§7).
9. Verifique que carrega sem erros antes de entregar.

---

## 7. Checklist (DO / DON'T)

**Faça**
- ✅ Estilo inline com os hex literais do design system.
- ✅ Hanken Grotesk para texto; Geist Mono para todo número/rótulo/eyebrow.
- ✅ Sentence case; maiúscula só em kicker mono.
- ✅ Cards/painéis em metal escovado com borda 1px + brilho interno + sombra profunda.
- ✅ Entradas em fade; sweep no metal; respeitar `prefers-reduced-motion`.
- ✅ Tudo bilíngue EN/PT no dicionário, em lockstep.
- ✅ Logo = diamante prata + wordmark "Yield2Pay".
- ✅ Ícones de linha fina (stroke 1.4–1.6) em prata; faltou ícone → Lucide via CDN (sinalize).

**Não faça**
- ❌ Cores vibrantes (roxo, azul neon, verde berrante) ou glows coloridos.
- ❌ Emoji. Nunca.
- ❌ Importar `styles.css` ou as primitivas React de `components/` nas telas `.dc.html`.
- ❌ Stylesheets com classes fora do `<helmet>`; nem `<script src>` no corpo do template.
- ❌ Lógica/expressões dentro dos furos `{{ }}`; nem texto cru hardcoded fora do dicionário.
- ❌ `React.createElement` para layout (só para ícones SVG).
- ❌ Superfícies chapadas onde deveria haver metal; cantos vivos onde deveria haver raio.
- ❌ Fundo animado; ALL CAPS na prosa; ícones preenchidos/duotone.

---

## 8. Referência rápida — valores mais usados (cole direto)

```
Fundo da página          #0c0d0f
Texto primário           #EDEFF1     Texto secundário   #9A9DA1
Número/ênfase            #F2F3F4     Prata acento       #C0C2C5
Borda controle           #2A2D31     Borda card         #3a3d42     Borda metal  #4a4d52
Botão primário (cromo)   linear-gradient(180deg,#E6E8EA,#A8AAAD)  · texto #0E0F11
Metal escovado           linear-gradient(135deg,#3c3f44,#26282c,#16181b,#303338,#1b1d21)
Raio pílula/botão        999px       Raio card          18px        Raio painel  22–26px
Hero h1                  clamp(38px,5.6vw,66px), 700, -0.025em, + emboss
Eyebrow mono             12px, UPPERCASE, letter-spacing .16–.2em, #9A9DA1
Max largura / gutter     1200px / 24px
```

Em caso de dúvida sobre um valor, abra a tela existente mais parecida e copie de lá.
