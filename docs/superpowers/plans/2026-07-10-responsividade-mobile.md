# Responsividade Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar todas as telas do web app (deposit, withdraw, login, landing, dashboard) legíveis e usáveis em qualquer largura abaixo de desktop (< 1200px), sem scroll horizontal nem elementos cortados.

**Architecture:** Abordagem fluid-first (spec `docs/superpowers/specs/2026-07-10-responsividade-mobile-design.md`). Empurrar responsividade para CSS intrínseco (`clamp()`, `min()`, `%`, `repeat(auto-fit, minmax())`) e reservar `@media` só para pivôs reais de layout. JS (`useBreakpoint`) só para renderizar/omitir elementos, nunca para estilo puro. Cada tela é validada visualmente com Playwright em 5 larguras antes de fechar.

**Tech Stack:** Next.js 16, React 19, estilos inline `style={{}}` + design tokens CSS em `apps/web/src/app/tokens/`, testes vitest, validação visual via Playwright MCP.

## Global Constraints

- Estilos permanecem inline `style={{}}` + tokens CSS. **Não** introduzir Tailwind, CSS Modules ou nova lib de estilo.
- Breakpoints canônicos: mobile `480px`, tablet `768px`, desktop `1200px`. Em `@media`, escrever os px literais (CSS não aceita `var()` na condição de media).
- **Desktop (≥1200px) não pode regredir** visualmente em nenhuma tela.
- Suíte vitest do web (`pnpm --filter @yield2pay/web test`) deve continuar 100% verde após cada tarefa.
- `NEXT_PUBLIC_AUTH_BYPASS` é só para validação local — **desligado/removido antes de qualquer commit de produção** (Task 8).
- Regra do projeto (CLAUDE.md): não commitar por conta própria fora do que este plano especifica; agrupar em commits maiores; nunca adicionar trailer `Co-Authored-By`.
- Todo texto de corpo ≥ 14px; alvos de toque ≥ 44×44px; imagens/ícones `max-width: 100%`.

---

## File Structure

**Criar:**
- `apps/web/src/app/tokens/breakpoints.css` — tokens `--fx-bp-*` (fonte da verdade documental).
- `apps/web/src/app/tokens/breakpoints.ts` — espelho TS `BP` para uso em JS.
- `apps/web/src/lib/useBreakpoint.ts` — hook de tier responsivo.
- `apps/web/src/lib/useBreakpoint.test.ts` — testes do hook.

**Modificar:**
- `apps/web/src/app/globals.css` — importar `breakpoints.css`.
- `apps/web/src/lib/useIsMobile.ts` — reimplementar como wrapper fino sobre `useBreakpoint` (mantém API `boolean`).
- `apps/web/src/providers/AuthGate.tsx` — flag de bypass para validação.
- `apps/web/src/app/(app)/deposit/page.tsx` — paddings fluidos.
- `apps/web/src/app/(app)/withdraw/page.tsx` — paddings fluidos.
- `apps/web/src/app/login/page.tsx` — pivô 1↔2 colunas.
- `apps/web/src/app/page.tsx` — overflow, footer, marquee.
- `apps/web/src/app/(app)/dashboard/page.tsx` + `MoneyPanel.tsx` + `ServiceCatalog.tsx` — sidebar/grids/paddings.

**Ferramenta de validação (não commitada):**
- Snippet Playwright reutilizável (Task 2, seção de validação) — roda via Playwright MCP, não vira arquivo no repo.

---

## Task 1: Fundação — tokens de breakpoint, `useBreakpoint`, bypass de auth

**Files:**
- Create: `apps/web/src/app/tokens/breakpoints.css`
- Create: `apps/web/src/app/tokens/breakpoints.ts`
- Create: `apps/web/src/lib/useBreakpoint.ts`
- Create: `apps/web/src/lib/useBreakpoint.test.ts`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/lib/useIsMobile.ts`
- Modify: `apps/web/src/providers/AuthGate.tsx`

**Interfaces:**
- Produces:
  - `BP = { mobile: 480, tablet: 768, desktop: 1200 }` (const, de `@/app/tokens/breakpoints`)
  - `type Breakpoint = 'mobile' | 'tablet' | 'desktop'`
  - `useBreakpoint(): Breakpoint` (de `@/lib/useBreakpoint`)
  - `useIsMobile(breakpoint?: number): boolean` — assinatura inalterada (compat)
- Consumes: nada.

- [ ] **Step 1: Criar tokens CSS de breakpoint**

Criar `apps/web/src/app/tokens/breakpoints.css`:

```css
/* Breakpoints canônicos. Fonte da verdade documental — o CSS não aceita
   var() na condição de @media, então nos @media os px são escritos literais
   (480 / 768 / 1200), espelhando estes valores. */
:root {
  --fx-bp-mobile: 480px;    /* phone retrato */
  --fx-bp-tablet: 768px;    /* phone landscape / tablet retrato */
  --fx-bp-desktop: 1200px;  /* abaixo disso = "mobile mode" */
}
```

- [ ] **Step 2: Importar em globals.css**

Em `apps/web/src/app/globals.css`, adicionar o import junto aos outros tokens (topo do arquivo, após os `@import` existentes):

```css
@import "./tokens/motion.css";
@import "./tokens/base.css";
@import "./tokens/breakpoints.css";
```

- [ ] **Step 3: Criar espelho TS**

Criar `apps/web/src/app/tokens/breakpoints.ts`:

```ts
// Espelho TS dos tokens de breakpoint (app/tokens/breakpoints.css).
// Usado pelo pouco de JS responsivo restante (useBreakpoint).
export const BP = { mobile: 480, tablet: 768, desktop: 1200 } as const;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';
```

- [ ] **Step 4: Escrever o teste do useBreakpoint (falhando)**

Criar `apps/web/src/lib/useBreakpoint.test.ts`:

```ts
import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useBreakpoint } from './useBreakpoint';

// Faz matchMedia casar apenas com queries cujo max-width >= o width simulado.
function mockWidth(width: number) {
  (window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => {
    const m = query.match(/max-width:\s*(\d+)px/);
    const max = m ? Number(m[1]) : Infinity;
    return {
      matches: width <= max,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
}

describe('useBreakpoint', () => {
  it("retorna 'mobile' abaixo de 480px", () => {
    mockWidth(375);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');
  });

  it("retorna 'tablet' entre 480 e 767px", () => {
    mockWidth(600);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('tablet');
  });

  it("retorna 'desktop' em 768px ou mais", () => {
    mockWidth(1024);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });

  it("é SSR-safe: retorna 'desktop' no server snapshot", () => {
    // getServerSnapshot é exercitado indiretamente; aqui só garante que
    // sem match algum (largura enorme) o valor é 'desktop'.
    mockWidth(2000);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });
});
```

- [ ] **Step 5: Rodar o teste — deve falhar**

Run: `pnpm --filter @yield2pay/web test useBreakpoint`
Expected: FAIL — `Cannot find module './useBreakpoint'`.

- [ ] **Step 6: Implementar useBreakpoint**

Criar `apps/web/src/lib/useBreakpoint.ts`:

```ts
'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { BP, type Breakpoint } from '@/app/tokens/breakpoints';

const MOBILE_Q = `(max-width: ${BP.mobile - 1}px)`;
const TABLET_Q = `(max-width: ${BP.tablet - 1}px)`;

// SSR: assume desktop até hidratar (matchMedia não existe no servidor).
const getServerSnapshot = (): Breakpoint => 'desktop';

/**
 * Tier responsivo atual: 'mobile' (<480), 'tablet' (<768), 'desktop' (>=768).
 *
 * Mesma mecânica SSR-safe do useIsMobile (useSyncExternalStore + matchMedia),
 * generalizada para três tiers. Prefira CSS/@media para estilo; use este hook
 * só quando precisar renderizar/omitir elementos em JS.
 */
export function useBreakpoint(): Breakpoint {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const mqls = [window.matchMedia(MOBILE_Q), window.matchMedia(TABLET_Q)];
    mqls.forEach((m) => m.addEventListener('change', onStoreChange));
    return () => mqls.forEach((m) => m.removeEventListener('change', onStoreChange));
  }, []);

  const getSnapshot = useCallback((): Breakpoint => {
    if (window.matchMedia(MOBILE_Q).matches) return 'mobile';
    if (window.matchMedia(TABLET_Q).matches) return 'tablet';
    return 'desktop';
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

- [ ] **Step 7: Rodar o teste — deve passar**

Run: `pnpm --filter @yield2pay/web test useBreakpoint`
Expected: PASS (4 testes).

- [ ] **Step 8: Reimplementar useIsMobile como wrapper (compat)**

Substituir o corpo de `apps/web/src/lib/useIsMobile.ts` mantendo a mesma assinatura pública. Só o default 768 muda para reusar `useBreakpoint`; chamadas com `breakpoint` custom continuam pelo caminho matchMedia direto.

```ts
'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { useBreakpoint } from '@/lib/useBreakpoint';

const getServerSnapshot = () => false;

/**
 * True quando a viewport está abaixo de `breakpoint` (default 768px).
 *
 * Compat: mantém a API booleana usada pelas telas. No default (768) delega ao
 * useBreakpoint (tier != desktop). Com breakpoint custom, usa matchMedia direto.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const tier = useBreakpoint();

  const query = `(max-width: ${breakpoint - 1}px)`;
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const custom = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return breakpoint === 768 ? tier !== 'desktop' : custom;
}
```

- [ ] **Step 9: Rodar os testes existentes do useIsMobile — devem continuar passando**

Run: `pnpm --filter @yield2pay/web test useIsMobile`
Expected: PASS (todos os testes originais verdes — a API booleana não mudou).

- [ ] **Step 10: Adicionar bypass de auth para validação visual**

Modificar `apps/web/src/providers/AuthGate.tsx`. Adicionar a flag no topo do componente e dois early-returns. Deixar o resto intacto:

```tsx
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { ensureWallet } = useWallet();

  // Bypass SÓ para validação visual local (screenshots de telas autenticadas).
  // Nunca ligar em produção — ver plano de responsividade, Task 8.
  const bypass = process.env.NEXT_PUBLIC_AUTH_BYPASS === 'true';

  useEffect(() => {
    if (bypass) return;
    if (!ready) return;
    if (!authenticated) {
      router.replace('/login');
      return;
    }
    ensureWallet().catch((err) => {
      console.error('[AuthGate] ensureWallet failed:', err);
    });
  }, [ready, authenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  if (bypass) return <>{children}</>;
  if (!ready || !authenticated) return null;
  return <>{children}</>;
}
```

- [ ] **Step 11: Rodar teste do AuthGate — deve continuar passando**

Run: `pnpm --filter @yield2pay/web test AuthGate`
Expected: PASS — o teste não define `NEXT_PUBLIC_AUTH_BYPASS`, então `bypass` é `false` e o comportamento original é preservado.

- [ ] **Step 12: Rodar suíte completa**

Run: `pnpm --filter @yield2pay/web test`
Expected: PASS (toda a suíte verde).

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/app/tokens/breakpoints.css apps/web/src/app/tokens/breakpoints.ts \
        apps/web/src/lib/useBreakpoint.ts apps/web/src/lib/useBreakpoint.test.ts \
        apps/web/src/lib/useIsMobile.ts apps/web/src/app/globals.css \
        apps/web/src/providers/AuthGate.tsx
git commit -m "feat(web): fundação responsiva — tokens de breakpoint, useBreakpoint e bypass de auth p/ validação"
```

---

## Task 2: Deposit responsivo + protocolo de validação visual

Esta task conserta a tela mais simples **e** estabelece o loop de validação reusado por todas as telas seguintes.

**Files:**
- Modify: `apps/web/src/app/(app)/deposit/page.tsx`
- (regressão) Test: `apps/web/src/app/(app)/deposit/deposit.test.tsx`

**Interfaces:**
- Consumes: `useIsMobile` (compat de Task 1). Nada novo produzido.

- [ ] **Step 1: Subir o app com bypass ligado**

```bash
NEXT_PUBLIC_AUTH_BYPASS=true pnpm dev:web
```
App em `http://localhost:3000`. (Se a tela precisar de dados da API: `NEXT_PUBLIC_AUTH_BYPASS=true pnpm dev:app`.)

- [ ] **Step 2: Baseline visual — screenshot ANTES em 360px**

Via Playwright MCP:
1. `browser_resize` para 360×800.
2. `browser_navigate` → `http://localhost:3000/deposit`.
3. `browser_take_screenshot`.
Observar: `padding: 30` interno do card apertando o conteúdo contra as bordas.

- [ ] **Step 3: Aplicar fixes fluidos no deposit**

Em `apps/web/src/app/(app)/deposit/page.tsx`:

3a. Padding interno do card (linha do `<div style={{ padding: 30 }}>`) → fluido:

```tsx
<div style={{ padding: 'clamp(16px, 5vw, 30px)' }}>
```

3b. Container externo — consolidar largura (o `<div style={{ width: 520, maxWidth: '100%' }}>`):

```tsx
<div style={{ width: 'min(520px, 100%)' }}>
```

3c. Wrapper raiz — o padding já é `isMobile ? '24px 12px' : '48px 24px'`; substituir por fluido e remover a dependência de `isMobile` para este estilo:

```tsx
<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'clamp(20px, 4vw, 48px) clamp(12px, 3vw, 24px)' }}>
```

3d. Se `isMobile` ficar sem uso após 3c, remover a linha `const isMobile = useIsMobile();` e o import, para não deixar variável morta (o lint falha em var não usada). Se ainda houver uso, manter.

- [ ] **Step 4: Revalidar visual nos 5 breakpoints**

Via Playwright MCP, para cada largura em `[360, 480, 768, 1024, 1280]`:
1. `browser_resize` para `width×800`.
2. `browser_navigate` → `/deposit`.
3. `browser_take_screenshot`.
4. Rodar checagem de overflow com `browser_evaluate`:

```js
() => {
  const el = document.scrollingElement;
  return { w: el.scrollWidth, c: el.clientWidth, overflow: el.scrollWidth > el.clientWidth };
}
```

Aprovar só se, em TODAS as larguras: `overflow === false`, nada cortado/sobreposto, botões ≥44px, texto legível. Repetir do Step 3 se falhar.

- [ ] **Step 5: Rodar teste de regressão do deposit**

Run: `pnpm --filter @yield2pay/web test deposit`
Expected: PASS. Se algum teste asserta um valor de estilo antigo (ex: `padding: 30`), atualizar a asserção para o novo valor fluido.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(app)/deposit/page.tsx
git commit -m "fix(web): deposit responsivo — paddings e largura fluidos"
```

---

## Task 3: Withdraw responsivo

Mesmo padrão do deposit (estrutura de card idêntica).

**Files:**
- Modify: `apps/web/src/app/(app)/withdraw/page.tsx`
- (regressão) Test: `apps/web/src/app/(app)/withdraw/withdraw.test.tsx`

- [ ] **Step 1: Baseline visual em 360px**

Playwright MCP: `browser_resize` 360×800 → `browser_navigate` `/withdraw` → `browser_take_screenshot`.

- [ ] **Step 2: Aplicar os mesmos fixes fluidos**

Em `apps/web/src/app/(app)/withdraw/page.tsx`:

2a. `<div style={{ padding: 30 }}>` → `<div style={{ padding: 'clamp(16px, 5vw, 30px)' }}>`
2b. `<div style={{ width: 520, maxWidth: '100%' }}>` → `<div style={{ width: 'min(520px, 100%)' }}>`
2c. Wrapper raiz `padding: isMobile ? '24px 12px' : '48px 24px'` → `padding: 'clamp(20px, 4vw, 48px) clamp(12px, 3vw, 24px)'`
2d. Remover `const isMobile = useIsMobile();` e o import se ficarem sem uso.

- [ ] **Step 3: Revalidar visual nos 5 breakpoints**

Playwright MCP: mesmo loop `[360, 480, 768, 1024, 1280]` da Task 2 Step 4, rota `/withdraw`. Overflow deve ser `false` em todas.

- [ ] **Step 4: Rodar teste de regressão**

Run: `pnpm --filter @yield2pay/web test withdraw`
Expected: PASS (ajustar asserções de estilo antigo se houver).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/(app)/withdraw/page.tsx
git commit -m "fix(web): withdraw responsivo — paddings e largura fluidos"
```

---

## Task 4: Login — pivô 1↔2 colunas em CSS

O login tem duas colunas (`flex: '1 1 420px'` / `flex: '1.15 1 480px'`); o painel esquerdo já é escondido por `!isMobile` (JS). Manter o painel escondido em mobile é comportamento de layout — mover o pivô para CSS quando puder, mas como envolve renderização condicional do bloco inteiro, `useIsMobile` para **omitir** o painel é uso legítimo de JS (não é só estilo). Foco aqui: garantir que a coluna do formulário fica 100% usável em 360px e que não há overflow.

**Files:**
- Modify: `apps/web/src/app/login/page.tsx`
- (regressão) Test: `apps/web/src/app/login/login.test.tsx`

- [ ] **Step 1: Baseline visual em 360 e 768px**

Playwright MCP: `browser_navigate` `/login`, screenshot em 360×800 e 768×1024. (Login é público — não precisa de bypass.) Observar overflow do painel esquerdo e padding do form.

- [ ] **Step 2: Tornar paddings do form fluidos e sem `isMobile` para estilo**

Em `apps/web/src/app/login/page.tsx`, na `<section>` do formulário (`flex: '1.15 1 480px'`), o padding é `isMobile ? '24px 16px' : 'clamp(32px,5vw,64px) 24px'`. Unificar para fluido único e manter `minHeight` mobile via CSS fluido:

```tsx
padding: 'clamp(24px, 5vw, 64px) clamp(16px, 3vw, 24px)',
```

O `minHeight: isMobile ? '100vh' : undefined` pode permanecer (uso de renderização/comportamento aceitável), ou trocar por `minHeight: '100dvh'` só quando a coluna esquerda estiver ausente. Manter simples: deixar como está se `isMobile` ainda for usado para omitir o painel esquerdo (Step 3).

- [ ] **Step 3: Confirmar que o painel esquerdo é omitido corretamente em mobile**

Verificar que o bloco `{!isMobile && ( <aside/section esquerda> )}` continua funcionando — este é o único uso legítimo de `useIsMobile` nesta tela (omite o elemento, não só estiliza). Não remover.

- [ ] **Step 4: Garantir sem overflow-x no container flex**

O wrapper das duas colunas deve permitir wrap/coluna única. Confirmar que o flex container tem `flexWrap: 'wrap'` ou que, com o painel esquerdo omitido em mobile, a coluna do form ocupa 100%. Se a coluna do form tiver `flex: '1.15 1 480px'` e o painel esquerdo sumir, ela expande sozinha — validar no Step 5. Se houver overflow, adicionar `flexWrap: 'wrap'` ao container das colunas.

- [ ] **Step 5: Revalidar visual nos 5 breakpoints**

Playwright MCP: loop `[360, 480, 768, 1024, 1280]` em `/login`. Overflow `false` em todas; form centrado e usável; painel esquerdo visível só ≥768px (ou conforme `isMobile`).

- [ ] **Step 6: Rodar teste de regressão**

Run: `pnpm --filter @yield2pay/web test login`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/login/page.tsx
git commit -m "fix(web): login responsivo — form fluido e sem overflow em telas estreitas"
```

---

## Task 5: Landing — overflow, footer e marquee

A landing já é majoritariamente fluida (`clamp()`, `auto-fit minmax`). Foco: eliminar qualquer overflow horizontal em <400px, garantir footer em coluna, e conferir o marquee de logos.

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- (regressão) Test: `apps/web/src/app/landing.test.tsx`

- [ ] **Step 1: Baseline + detecção de overflow em 360px**

Playwright MCP: `browser_navigate` `/`, `browser_resize` 360×800, screenshot. Rodar o `browser_evaluate` de overflow (Task 2 Step 4). Se `overflow === true`, identificar o elemento culpado:

```js
() => {
  const docW = document.documentElement.clientWidth;
  return [...document.querySelectorAll('*')]
    .filter((e) => e.getBoundingClientRect().right > docW + 1)
    .slice(0, 10)
    .map((e) => ({ tag: e.tagName, cls: e.className, right: Math.round(e.getBoundingClientRect().right) }));
}
```

- [ ] **Step 2: Corrigir o(s) elemento(s) que estouram**

Para cada elemento identificado no Step 1, aplicar a técnica cabível (spec seção 2):
- Largura fixa → `min(Xpx, 100%)`.
- Padding fixo lateral grande → `clamp()`.
- Linha de logos/marquee que transborda → garantir `overflow: hidden` no wrapper do marquee (a animação translada o conteúdo; o wrapper não pode expandir a página).
- Grid do footer (`repeat(auto-fit, minmax(...))` já ideal) → se estiver com colunas fixas, trocar por `gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))'`.

Escrever o valor concreto conforme o elemento achado; não deixar genérico.

- [ ] **Step 3: Confirmar overflow-x global tratado**

`globals.css` já tem `body { overflow-x: hidden; }`. Confirmar que isso não está apenas mascarando um estouro — o teste do Step 4 (com `scrollWidth`) revela estouro real mesmo com `overflow-x: hidden` no body via `documentElement`. O objetivo é `scrollWidth <= clientWidth`, não só esconder a barra.

- [ ] **Step 4: Revalidar nos 5 breakpoints**

Playwright MCP: loop `[360, 480, 768, 1024, 1280]` em `/`. Overflow `false` em todas; hero, seções, marquee e footer legíveis e sem corte.

- [ ] **Step 5: Rodar teste de regressão**

Run: `pnpm --filter @yield2pay/web test landing`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "fix(web): landing responsiva — elimina overflow horizontal e ajusta footer/marquee"
```

---

## Task 6: Dashboard — sidebar, grids e paddings (tela complexa)

O dashboard já colapsa sidebar → nav via `isMobile`. Consolidar: grids `auto-fit`, paddings fluidos, rows longas empilhadas, e manter a omissão/troca de sidebar (uso legítimo de JS).

**Files:**
- Modify: `apps/web/src/app/(app)/dashboard/page.tsx`
- Modify: `apps/web/src/app/(app)/dashboard/MoneyPanel.tsx`
- Modify: `apps/web/src/app/(app)/dashboard/ServiceCatalog.tsx`
- (regressão) Test: `apps/web/src/app/(app)/dashboard/dashboard.test.tsx`, `MoneyPanel.test.tsx`, `ServiceCatalog.test.tsx`

- [ ] **Step 1: Baseline visual em 360 / 768 / 1024**

Subir com bypass (`NEXT_PUBLIC_AUTH_BYPASS=true pnpm dev:app`). Playwright MCP: `browser_navigate` `/dashboard`, screenshots em 360×800, 768×1024, 1024×768. Catalogar: paddings fixos apertando (`padding: 26`, `padding: 32`, `padding: '20px 32px'`), grids com colunas fixas, rows do catálogo de serviços transbordando.

- [ ] **Step 2: Paddings fixos → fluidos**

Em `dashboard/page.tsx`, trocar os paddings fixos grandes por `clamp()`. Exemplos concretos (ajustar aos valores achados no Step 1):
- `padding: 26` → `padding: 'clamp(14px, 4vw, 26px)'`
- `padding: 32` (main content, já `isMobile ? '16px 12px' : 32`) → `padding: 'clamp(12px, 3vw, 32px)'` e remover o ternário `isMobile` desse estilo.
- Header `padding: isMobile ? '12px 16px' : '20px 32px'` → `padding: 'clamp(12px, 3vw, 20px) clamp(16px, 4vw, 32px)'`.

- [ ] **Step 3: Grids → auto-fit minmax**

Localizar grids com colunas fixas em `page.tsx` / `MoneyPanel.tsx` / `ServiceCatalog.tsx`. O grid principal já usa `repeat(auto-fit, minmax(240px, 1fr))` (bom). Aplicar o mesmo padrão a qualquer grid que ainda use contagem fixa de colunas:

```tsx
gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
```

Reduzir o `minmax` mínimo (ex: 200px) onde os cards ficarem apertados em 360px.

- [ ] **Step 4: Rows do catálogo de serviços — empilhar em telas estreitas**

Em `ServiceCatalog.tsx`, linhas horizontais (ícone + nome + valor + ação) que transbordam em 360px: usar `flexWrap: 'wrap'` ou, no tier mobile, `flexDirection: 'column'` com `gap`. Preferir `flexWrap: 'wrap'` (CSS puro, sem JS). Se a densidade exigir empilhamento explícito, usar `useBreakpoint() === 'mobile'` para trocar `flexDirection` — uso justificado (mudança estrutural, não só tamanho).

- [ ] **Step 5: Manter o pivô sidebar↔nav (JS legítimo)**

Confirmar que os blocos `isMobile ? {...nav horizontal} : {...sidebar coluna}` e `{!isMobile && (...)}` continuam corretos. Esse é o pivô de layout real que justifica JS. Não remover; se quiser, migrar `useIsMobile` → `useBreakpoint() !== 'desktop'` para consistência, mantendo o comportamento.

- [ ] **Step 6: Revalidar nos 5 breakpoints**

Playwright MCP: loop `[360, 480, 768, 1024, 1280]` em `/dashboard`. Overflow `false`; sidebar vira nav em mobile; cards e rows sem corte; MoneyPanel e ServiceCatalog legíveis.

- [ ] **Step 7: Rodar testes de regressão do dashboard**

Run: `pnpm --filter @yield2pay/web test dashboard MoneyPanel ServiceCatalog`
Expected: PASS (ajustar asserções de estilo antigo se houver).

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/(app)/dashboard/page.tsx" \
        "apps/web/src/app/(app)/dashboard/MoneyPanel.tsx" \
        "apps/web/src/app/(app)/dashboard/ServiceCatalog.tsx"
git commit -m "fix(web): dashboard responsivo — grids auto-fit, paddings fluidos e rows empilháveis"
```

---

## Task 7: Varredura visual final (todas as telas × todas as larguras)

**Files:** nenhum novo — validação de regressão cruzada.

- [ ] **Step 1: Loop completo de screenshots**

Subir com bypass (`NEXT_PUBLIC_AUTH_BYPASS=true pnpm dev:app`). Via Playwright MCP, para cada rota em `['/', '/login', '/dashboard', '/deposit', '/withdraw']` × cada largura em `[360, 480, 768, 1024, 1280]`:
1. `browser_resize` `width×800`.
2. `browser_navigate` rota.
3. `browser_take_screenshot`.
4. `browser_evaluate` de overflow (Task 2 Step 4).

- [ ] **Step 2: Conferir checklist objetivo por tela (spec 5.5)**

Para cada screenshot: sem scroll horizontal (overflow `false`), nada cortado/sobreposto, alvos ≥44px, texto ≥14px, inputs full-width, desktop (1280) inalterado vs. antes. Registrar falhas e voltar à task da tela correspondente.

- [ ] **Step 3: Comparar com mockups de referência (spec 5.4)**

Conferir hierarquia/identidade vs. `design/reference/` (`Yield2Pay.dc.html` → landing, `Yield2Pay Auth.dc.html` → login, `Yield2Pay Dashboard Cliente.dc.html` → dashboard). Não precisa ser pixel-perfect; preservar intenção visual.

- [ ] **Step 4: Rodar suíte completa**

Run: `pnpm --filter @yield2pay/web test`
Expected: PASS (toda a suíte verde).

---

## Task 8: Desligar bypass e fechar

**Files:**
- Modify: `apps/web/src/providers/AuthGate.tsx` (decisão: manter flag desligada ou remover)

- [ ] **Step 1: Garantir bypass desligado**

Parar o dev server. Confirmar que nenhum `.env` versionado tem `NEXT_PUBLIC_AUTH_BYPASS=true`. A flag em `AuthGate.tsx` é segura em produção (default `false` quando a env não é `'true'`), mas verificar que nada a liga por engano.

- [ ] **Step 2: Decisão sobre a flag**

Duas opções — escolher com o usuário:
- **Manter** a flag `NEXT_PUBLIC_AUTH_BYPASS` no código (útil p/ validação futura, inerte em prod). Documentar em `apps/web/README.md`.
- **Remover** a flag e reverter `AuthGate.tsx` ao original.

Aplicar a escolha.

- [ ] **Step 3: Rodar suíte completa uma última vez**

Run: `pnpm --filter @yield2pay/web test`
Expected: PASS.

- [ ] **Step 4: Commit (se a flag foi removida ou README atualizado)**

```bash
git add apps/web/src/providers/AuthGate.tsx apps/web/README.md
git commit -m "chore(web): finaliza responsividade — trata flag de bypass de validação"
```

---

## Self-Review (feito na escrita)

- **Cobertura do spec:** breakpoints (Task 1) · técnica fluid-first (Tasks 2–6) · deposit (2) · withdraw (3) · login (4) · landing (5) · dashboard (6) · protocolo de validação Playwright/bypass/viewports/checklist (Tasks 2–7) · testes vitest sem regressão (cada task) · fora de escopo respeitado (sem Tailwind/CSS Modules). Sem lacunas.
- **Placeholders:** nenhum "TODO/TBD"; todo passo de código mostra o código.
- **Consistência de tipos:** `BP`, `Breakpoint`, `useBreakpoint`, `useIsMobile` usados com a mesma assinatura em todas as tasks.
