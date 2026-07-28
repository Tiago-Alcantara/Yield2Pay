# Design — Responsividade mobile (fluid-first)

**Data:** 2026-07-10
**Abordagem:** C — fluid-first + breakpoints mínimos
**Alvo:** todas as larguras abaixo de desktop (< ~1200px)
**Estado:** telas quebrando em produção (deposit/withdraw, dashboard, login, landing)

---

## 1. Contexto e problema

Stack: Next.js 16 + React 19, **sem framework CSS**. Estilos são **inline `style={{}}`**
espalhados por todos os componentes, mais um sistema de design tokens em
`app/tokens/*.css`.

Responsividade hoje é ad-hoc:

- Hook `useIsMobile()` (breakpoint único 768px, via `useSyncExternalStore` — SSR-safe,
  assume desktop até hidratar) alterna estilos em ternários `isMobile ? a : b`.
- Landing já usa `clamp()` para tipografia fluida e grids `repeat(auto-fit, minmax(...))`.
- Dashboard já colapsa sidebar → nav horizontal em mobile via `isMobile`.

Problemas para o alvo "tudo < desktop":

1. **Um só breakpoint (768px).** Não distingue phone (≤480) de tablet (≤1024).
2. **Flash SSR / layout-shift.** `useIsMobile` retorna `false` no servidor → render desktop,
   depois vira no cliente. Cada decisão vira ternário duplicado em JS.
3. **Paddings/larguras fixos.** `padding: 30`, `padding: 26`, `width: 520` não encolhem
   sozinhos; apertam ou estouram em telas estreitas.

## 2. Princípio da abordagem C

Empurrar o máximo de responsividade para **CSS intrínseco que flui sozinho**, e reservar
breakpoints explícitos (`@media` em CSS, não JS) apenas para os poucos pivôs reais de
layout. JS (`useBreakpoint`) só onde for genuinamente necessário renderizar/omitir um
elemento — nunca para estilo puro.

Ordem de preferência ao consertar cada estilo:

1. **Padding / gap fixo → `clamp()`.** Ex: `padding: 30` → `padding: clamp(16px, 4vw, 30px)`.
2. **Largura fixa → `min()` / `%`.** Ex: `width: 520` → `width: min(520px, 100%)`
   (consolida os `maxWidth: '100%'` já presentes).
3. **Grid → `repeat(auto-fit, minmax(Xpx, 1fr))`.** Já usado na landing; estender aos grids
   do dashboard.
4. **Pivô de layout → `@media` em CSS.** Sidebar do dashboard, 2-colunas do login.
5. **JS `useBreakpoint` só para renderizar/omitir** (ex: nav mobile vs sidebar completa),
   nunca para trocar valores de estilo que o CSS resolve.

## 3. Fundação: tokens de breakpoint

Novo `app/tokens/breakpoints.css`, importado por `globals.css`:

```css
:root {
  --fx-bp-mobile: 480px;    /* phone retrato */
  --fx-bp-tablet: 768px;    /* phone landscape / tablet retrato */
  --fx-bp-desktop: 1200px;  /* abaixo disso = "mobile mode" */
}
```

> Nota: valores em `var()` não podem ser usados dentro da condição de `@media`
> (limitação do CSS). Os breakpoints ficam documentados aqui como fonte da verdade;
> nos `@media` os px são escritos literalmente (480 / 768 / 1200), espelhando estes tokens.

Espelho em TS para o pouco de JS restante — `app/tokens/breakpoints.ts`:

```ts
export const BP = { mobile: 480, tablet: 768, desktop: 1200 } as const;
```

`useBreakpoint()` (novo, em `lib/useBreakpoint.ts`) substitui `useIsMobile`: mesma mecânica
`useSyncExternalStore`, retorna `'mobile' | 'tablet' | 'desktop'`. `useIsMobile` vira wrapper
fino (`useBreakpoint() !== 'desktop'` ou mantém 768) para **não quebrar as chamadas atuais** —
migração incremental, arquivo por arquivo.

## 4. Correções por tela

Ordem: do mais simples ao mais complexo. Testar cada uma antes de seguir.

| # | Tela | Arquivos | Problema | Fix |
|---|------|----------|----------|-----|
| 1 | **Deposit** | `app/(app)/deposit/page.tsx` | `padding: 30` interno aperta < 360px; card `width: 520` já colapsa | padding → `clamp`; inputs full-width; revisar `TxResultCard` |
| 2 | **Withdraw** | `app/(app)/withdraw/page.tsx` | idem deposit | mesmo padrão do deposit |
| 3 | **Login** | `app/login/page.tsx` | 2-colunas via `flex-basis`; painel esquerdo escondido por `!isMobile` (JS) | mover pivô 1-col ↔ 2-col para `@media`; form `maxWidth: 404` ok |
| 4 | **Landing** | `app/page.tsx` | maioria fluida; risco de overflow-x < 400px, marquee de logos, footer 3-col | footer → `auto-fit`; garantir `overflow-x: hidden` real; checar marquee |
| 5 | **Dashboard** | `app/(app)/dashboard/page.tsx`, `MoneyPanel.tsx`, `ServiceCatalog.tsx` | mais complexo: sidebar ↔ nav, paddings fixos, grids, rows/tabela | `@media` pro pivô sidebar; grids → `auto-fit`; paddings → `clamp`; rows longas → stack ou scroll interno |

Regra transversal em todas: sem scroll horizontal, alvos de toque ≥ 44px, texto de corpo ≥ 14px, nada cortado/sobreposto.

## 5. Protocolo de validação (para ser assertivo, não achismo)

Cada tela só é considerada pronta após **verificação visual real** nos breakpoints. Não
declarar "responsivo" sem screenshot conferido.

### 5.1 Subir o app
- Web: `pnpm dev:web` (Next, porta padrão **3000**).
- API (se telas autenticadas precisarem de dados): `pnpm dev:api` (porta **3001**) — ou
  `pnpm dev:app` para ambos.
- `.env.local` do web precisa de `NEXT_PUBLIC_PRIVY_APP_ID` válido para o fluxo real de auth.

### 5.2 Alcançar telas autenticadas (bloqueador conhecido)
`AuthGate` redireciona para `/login` se não autenticado. Dashboard/deposit/withdraw **não
renderizam** sem sessão Privy. Para validação visual, usar **uma** das opções:

- **Bypass temporário (recomendado):** flag `NEXT_PUBLIC_AUTH_BYPASS` que faz `AuthGate`
  renderizar `children` direto quando `true`. Ligar só localmente durante a validação,
  **remover/desligar antes de qualquer commit**. (Alternativa sem código: login Privy real
  na sessão do Playwright.)
- Nunca commitar o bypass ligado.

### 5.3 Viewports obrigatórios (por tela)
Screenshot em cada largura, retrato:

| Largura | Representa |
|---------|-----------|
| **360px** | phone pequeno (piso real de mercado) |
| **480px** | phone grande |
| **768px** | tablet retrato / limite mobile-tablet |
| **1024px** | tablet landscape / laptop pequeno |
| **1280px** | desktop (regressão — garantir que não quebrou) |

Ferramenta: **Playwright MCP** — `browser_resize` para cada largura, `browser_navigate`,
`browser_take_screenshot`. DPR 2 quando quiser conferir nitidez, mas layout se valida em CSS px.

### 5.4 Referências de design
Comparar contra os mockups em `design/reference/`:
- `Yield2Pay.dc.html` → landing
- `Yield2Pay Auth.dc.html` → login
- `Yield2Pay Dashboard Cliente.dc.html` → dashboard
- `Yield2Pay-App.html` → app geral

Os mockups são a fonte da intenção visual; a versão mobile deve preservar hierarquia e
identidade, não necessariamente pixel-perfect.

### 5.5 Checklist objetivo por tela (todos devem passar)
- [ ] **Sem scroll horizontal** em nenhuma das 5 larguras (`document.scrollingElement.scrollWidth <= clientWidth`).
- [ ] Nenhum elemento cortado, sobreposto ou saindo do container.
- [ ] Alvos de toque (botões, links, toggles) ≥ 44×44px.
- [ ] Texto de corpo ≥ 14px; títulos legíveis, sem quebra feia.
- [ ] Imagens/ícones com `max-width: 100%`, sem esticar.
- [ ] Formulários: inputs full-width, teclado não cobre o campo ativo (checar em 360px).
- [ ] Estados interativos (hover→tap): nada depende só de hover em touch.
- [ ] Desktop (1280px) **inalterado** — sem regressão visual.

### 5.6 Automação leve (opcional, reforço)
Snippet Playwright que percorre `[360, 480, 768, 1024, 1280]` por rota, tira screenshot e
loga `scrollWidth > clientWidth` como falha de overflow. Roda como smoke visual antes de
fechar cada tela.

## 6. Testes automatizados
- Suíte vitest existente (`pnpm --filter @yield2pay/web test`) **não pode quebrar** — mudanças
  são de estilo/CSS. Rodar após cada tela.
- Se algum teste asserta layout/estilo inline específico, ajustar junto.

## 7. Fora de escopo (YAGNI)
- Reescrever tudo para CSS Modules ou Tailwind — não. Mantém inline + tokens.
- Redesign de UX mobile (novos fluxos, gestos, bottom-nav dedicada) — só se um pivô exigir.
- Dark/light theme, i18n de layout — inalterados.

## 8. Sequência de trabalho
1. Fundação: `breakpoints.css` + `breakpoints.ts` + `useBreakpoint` (compat `useIsMobile`).
2. Deposit → validar → Withdraw → validar → Login → validar → Landing → validar → Dashboard → validar.
3. Rodar vitest após cada tela.
4. Desligar/remover `NEXT_PUBLIC_AUTH_BYPASS`.
5. Revisão visual final nas 5 telas × 5 larguras.
