# FixEarn Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Padronizar o monorepo FixEarn segundo o preference doc, remover redundância e código morto, e melhorar velocidade runtime + build — sem mudar comportamento de produto.

**Architecture:** Três fases sequenciais (padronizar → redundância → velocidade). Refactors mecânicos usam a suíte de testes existente como rede de regressão (devem ficar verdes); peças novas (utils, componentes) entram via TDD. Withdraw-fix está FORA desta rodada.

**Tech Stack:** NestJS 11 + Prisma 7 + Stellar SDK (apps/api), Next.js custom + React (apps/web), pnpm workspace, vitest (web; API migra p/ vitest nesta rodada).

## Global Constraints

- **Commits** (CLAUDE.md): NÃO commitar por conta própria — só quando o usuário pedir. Agrupar em commits grandes (um por fase). NUNCA adicionar trailer `Co-Authored-By`.
- **Preference (`docs/Preference - Coding Style.md`)**: código explícito e linear > DRY agressivo. Nomes descritivos. Sem `any`. **Proibido over-abstraction** (sem base-controller/factory). Não criar helper que só chama outra função sem ganho real.
- **Next.js é custom**: ler `node_modules/next/dist/docs/` ANTES de qualquer mudança de config/padrão Next (ver `apps/web/AGENTS.md`). Não aplicar config de memória.
- **Sem novas deps** além das estritamente necessárias à migração vitest da API (`vitest`, `unplugin-swc`, `@swc/core`, `@vitest/...` se preciso) e remoção de `ts-jest`/`jest`.
- Comandos: API tests `pnpm --filter @fixearn/api test`; API lint `pnpm --filter @fixearn/api lint`; web tests `pnpm --filter @fixearn/web test`; web lint `pnpm --filter @fixearn/web lint`.
- **Sem mudança de comportamento**: todo refactor mantém a suíte existente verde.

## File Structure

**Fase 1 (apps/api):**
- Create: `apps/api/src/auth/authenticated-request.ts` — tipo `AuthenticatedRequest`.
- Modify: 5 controllers, `main.ts`, `stellar.service.ts`, `vault.service.ts`, `privy.service.ts`, `wallet.service.ts`, `config/env.ts`, `ledger.service.ts`, `eslint.config.mjs`.

**Fase 2 (apps/web):**
- Create: `apps/web/src/lib/errors.ts`, `apps/web/src/lib/validateAmount.ts`, `apps/web/src/components/BrandHeader.tsx`, `apps/web/src/components/TxResultCard.tsx`, `apps/web/src/components/TxErrorBox.tsx` (+ `.test.tsx`).
- Modify: `deposit/page.tsx`, `withdraw/page.tsx`, `dashboard/Bills.tsx`, `lib/useStellarTx.ts`.
- Delete (se órfãos): `Eyebrow.tsx`, `SegmentedControl.tsx`, `StatTile.tsx`, `StatPanel.tsx`.

**Fase 3:**
- Modify: `ledger.service.ts`, `deposit.service.ts`, `withdraw.service.ts`, `stellar.service.ts`, `company.service.ts`, `jobs/snapshot.job.ts`, `prisma/schema.prisma` (+migration), `Bills.tsx`, Privy providers, `next.config.ts`.
- Create: `apps/api/vitest.config.ts`; Delete jest config/deps.

---

# FASE 1 — Padronizar

> Ordem: corrigir o código primeiro, **depois** elevar as regras de lint a `error` (assim o lint nunca fica vermelho no meio).

### Task 1: Tipo `AuthenticatedRequest` e remoção de `any` nos controllers

**Files:**
- Create: `apps/api/src/auth/authenticated-request.ts`
- Modify: `apps/api/src/auth/auth.guard.ts` (confirmar onde `companyId` é anexado ao request)
- Modify: `apps/api/src/bills/bills.controller.ts:12,17,22`, `apps/api/src/ledger/ledger.controller.ts:12`, `apps/api/src/wallet/wallet.controller.ts:11`, `apps/api/src/deposit/deposit.controller.ts:13,18`, `apps/api/src/withdraw/withdraw.controller.ts:13,18`
- Modify: `apps/api/src/main.ts:9,13`

**Interfaces:**
- Produces: `AuthenticatedRequest` (extends express `Request`, com `companyId: string`).

- [ ] **Step 1: Ler `auth.guard.ts`** para confirmar o nome exato do campo anexado ao request (esperado `companyId`). Ajustar o tipo ao que o guard realmente injeta.

- [ ] **Step 2: Criar o tipo**

```ts
// apps/api/src/auth/authenticated-request.ts
import { Request } from 'express';

/** Request após o AuthGuard: carrega o companyId resolvido a partir do token Privy. */
export interface AuthenticatedRequest extends Request {
  companyId: string;
}
```

- [ ] **Step 3: Substituir `@Req() req: any` por `@Req() req: AuthenticatedRequest`** em todos os controllers listados, importando o tipo. Acessos `req.companyId` ficam tipados.

- [ ] **Step 4: Tipar `main.ts`** — o middleware `(req, res, next)` usa tipos do express (`Request, Response, NextFunction`). Para `BigInt.prototype.toJSON`, declarar via `interface BigInt { toJSON(): string }` (declaration merging) em vez de `as any`:

```ts
// no topo de main.ts, fora de qualquer função
declare global {
  interface BigInt {
    toJSON(): string;
  }
}
BigInt.prototype.toJSON = function () {
  return this.toString();
};
```

- [ ] **Step 5: Build + testes**

Run: `pnpm --filter @fixearn/api build && pnpm --filter @fixearn/api test`
Expected: build sem erro de tipo; testes PASS.

### Task 2: Nomes explícitos

**Files:**
- Modify: `apps/api/src/stellar/stellar.service.ts:11` (`cfg`→`config`)
- Modify: `apps/api/src/vault/vault.service.ts:32` (`cfg`→`config`)
- Modify: `apps/api/src/auth/privy.service.ts:9` (`cfg`→`config`)
- Modify: `apps/api/src/wallet/wallet.service.ts:21` (`w`→`wallet`)
- Modify: `apps/api/src/config/env.ts:24` (`p`→`parsed`)
- Modify: `apps/api/src/ledger/ledger.service.ts:19` (`agg`→`depositAggregate`)

- [ ] **Step 1: Renomear cada variável/parâmetro** no escopo local (incluindo todos os usos no mesmo arquivo). Atenção: `cfg` é parâmetro de constructor injetado — renomear a propriedade e todos os `this.cfg`/usos.

- [ ] **Step 2: Testes**

Run: `pnpm --filter @fixearn/api test`
Expected: PASS (renomeações puras, sem mudança de lógica).

### Task 3: Naming uniforme de service injetado nos controllers

**Files:**
- Modify: `apps/api/src/deposit/deposit.controller.ts:10` (`deposits`→`depositService`)
- Modify: `apps/api/src/wallet/wallet.controller.ts:9` (`wallets`→`walletService`)
- Modify: `apps/api/src/withdraw/withdraw.controller.ts:10` (`withdraws`→`withdrawService`)
- (`bills.controller.ts:9` já é `billsService` — referência do padrão; não mexer.)

- [ ] **Step 1: Renomear a propriedade** e todos os usos `this.<old>` dentro de cada controller.

- [ ] **Step 2: Testes**

Run: `pnpm --filter @fixearn/api test`
Expected: PASS.

### Task 4: Elevar regras de lint a `error` (guard-rail)

**Files:**
- Modify: `apps/api/eslint.config.mjs:28-33`

- [ ] **Step 1: Trocar as regras**

```js
rules: {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  'prettier/prettier': ['error', { endOfLine: 'auto' }],
},
```

- [ ] **Step 2: Rodar lint**

Run: `pnpm --filter @fixearn/api lint`
Expected: 0 erros. Se aparecer `no-unsafe-argument` em algum ponto não previsto, corrigir tipando (não suprimir com `any`/comentário). Se houver caso legítimo e isolado, usar `eslint-disable-next-line` com comentário explicando o porquê.

- [ ] **Step 3 (commit da Fase 1 — só quando o usuário pedir)**

```bash
git add apps/api
git commit -m "refactor(api): padroniza tipos, nomes e lint conforme preference"
```

---

# FASE 2 — Redundância (apps/web)

### Task 5: Util `getErrorMessage`

**Files:**
- Create: `apps/web/src/lib/errors.ts`, `apps/web/src/lib/errors.test.ts`
- Modify: call sites em `deposit/page.tsx`, `withdraw/page.tsx`, `dashboard/Bills.tsx`

**Interfaces:**
- Produces: `getErrorMessage(error: unknown): string`

- [ ] **Step 1: Teste que falha**

```ts
// apps/web/src/lib/errors.test.ts
import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('returns message from an Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });
  it('stringifies non-Error values', () => {
    expect(getErrorMessage('nope')).toBe('nope');
    expect(getErrorMessage(42)).toBe('42');
  });
});
```

- [ ] **Step 2: Rodar — falha**

Run: `pnpm --filter @fixearn/web test -- errors`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
// apps/web/src/lib/errors.ts
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

- [ ] **Step 4: Rodar — passa.** `pnpm --filter @fixearn/web test -- errors` → PASS.

- [ ] **Step 5: Substituir call sites.** Trocar cada `err instanceof Error ? err.message : ...` por `getErrorMessage(err)`. Onde havia fallback custom (ex.: Bills `'Failed to...'`), preservar a mensagem: `getErrorMessage(err) || 'Failed to delete bill'` só se o original tinha fallback fixo; senão usar direto. **Ler cada call site antes** para não perder mensagem de fallback específica.

- [ ] **Step 6: Testes web.** `pnpm --filter @fixearn/web test` → PASS.

### Task 6: Util `validateAmount`

**Files:**
- Create: `apps/web/src/lib/validateAmount.ts`, `apps/web/src/lib/validateAmount.test.ts`
- Modify: `deposit/page.tsx:31-41`, `withdraw/page.tsx:16-26`, `dashboard/Bills.tsx:28-38` (esta é `validateCost`)

**Interfaces:**
- Consumes: `toBaseUnits` de `apps/web/src/lib/money.ts`
- Produces: `validateAmount(value: string): string | null` (retorna mensagem de erro ou `null` se válido)

- [ ] **Step 1: Ler as 3 cópias** (deposit, withdraw, Bills) e confirmar que a lógica é idêntica (não-vazio, numérico, positivo, ≤7 casas via `toBaseUnits`). Anotar diferenças de mensagem entre elas.

- [ ] **Step 2: Teste que falha**

```ts
// apps/web/src/lib/validateAmount.test.ts
import { describe, it, expect } from 'vitest';
import { validateAmount } from './validateAmount';

describe('validateAmount', () => {
  it('rejects empty', () => { expect(validateAmount('')).not.toBeNull(); });
  it('rejects non-numeric', () => { expect(validateAmount('abc')).not.toBeNull(); });
  it('rejects zero and negative', () => {
    expect(validateAmount('0')).not.toBeNull();
    expect(validateAmount('-5')).not.toBeNull();
  });
  it('rejects more than 7 decimals', () => { expect(validateAmount('1.12345678')).not.toBeNull(); });
  it('accepts valid amount', () => { expect(validateAmount('10.5')).toBeNull(); });
});
```

- [ ] **Step 3: Rodar — falha.** `pnpm --filter @fixearn/web test -- validateAmount` → FAIL.

- [ ] **Step 4: Implementar** copiando a lógica existente (a mais completa das 3), retornando string de erro ou `null`. Manter as mensagens exatas usadas hoje na UI.

- [ ] **Step 5: Rodar — passa.**

- [ ] **Step 6: Substituir as 3 cópias** pela chamada a `validateAmount`. Se a mensagem da UI variava por tela, parametrizar via segundo arg opcional `label` só se necessário (não criar abstração além do preciso).

- [ ] **Step 7: Testes web.** `pnpm --filter @fixearn/web test` → PASS (inclui `deposit.test.tsx`, `withdraw.test.tsx`, `bills.test.tsx`).

### Task 7: Componente `<BrandHeader/>`

**Files:**
- Create: `apps/web/src/components/BrandHeader.tsx`, `apps/web/src/components/BrandHeader.test.tsx`
- Modify: `deposit/page.tsx` (2 renders), `withdraw/page.tsx` (2 renders)

**Interfaces:**
- Produces: `<BrandHeader />` (BackButton + chrome square + texto "FixEarn"). Props: nenhuma, ou `showBack?: boolean` se algum dos 4 usos não tinha BackButton — **confirmar lendo os 4 blocos antes**.

- [ ] **Step 1: Ler os 4 blocos** (deposit:236-260, deposit:331-355, withdraw:72-97, withdraw:170-195) e confirmar se são 100% idênticos. Listar qualquer diferença → vira prop.

- [ ] **Step 2: Teste que falha**

```tsx
// apps/web/src/components/BrandHeader.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandHeader } from './BrandHeader';

describe('BrandHeader', () => {
  it('renders the brand name', () => {
    render(<BrandHeader />);
    expect(screen.getByText('FixEarn')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar — falha.**

- [ ] **Step 4: Implementar** o componente movendo o JSX + estilos exatos de um dos blocos (estilos idênticos confirmados no step 1).

- [ ] **Step 5: Rodar — passa.**

- [ ] **Step 6: Substituir os 4 renders** por `<BrandHeader .../>`. Remover imports de BackButton que ficaram órfãos nas páginas.

- [ ] **Step 7: Testes web.** `pnpm --filter @fixearn/web test` → PASS.

### Task 8: Componentes `<TxResultCard/>` e `<TxErrorBox/>`

**Files:**
- Create: `TxResultCard.tsx` (+test), `TxErrorBox.tsx` (+test)
- Modify: `deposit/page.tsx`, `withdraw/page.tsx`

**Interfaces:**
- Produces: `<TxResultCard txHash={string} ...props que diferem entre deposit/withdraw />`, `<TxErrorBox message={string} />`

- [ ] **Step 1: Diff os blocos** success (deposit:223-315 ↔ withdraw:59-155) e error (deposit:727-742 ↔ withdraw:244-259). Listar o que varia (texto/labels) → props. O que é igual → fixo no componente.

- [ ] **Step 2..5 (TDD por componente):** teste falha → impl movendo JSX/estilos → teste passa, para cada componente. Props cobrem só as diferenças reais identificadas no step 1.

- [ ] **Step 6: Substituir** nos dois pages.

- [ ] **Step 7: Testes web.** `pnpm --filter @fixearn/web test` → PASS.

### Task 9: Colapsar twins em `useStellarTx`

**Files:**
- Modify: `apps/web/src/lib/useStellarTx.ts:28-78`, `apps/web/src/lib/useStellarTx.test.tsx`

- [ ] **Step 1: Ler** as duas funções (deposit/withdraw, ~85% iguais). Identificar o que difere: `buildDeposit` vs `buildWithdraw`, `submitDeposit` vs `submitWithdraw`.

- [ ] **Step 2: Decisão de legibilidade.** Se uma helper interna parametrizada por `{ build, submit }` ficar MAIS legível, criar. Se introduzir indireção/magia (preference: evitar), **manter as duas funções explícitas** e parar aqui — registrar a decisão no PR. Não forçar DRY.

- [ ] **Step 3 (se colapsou): garantir testes existentes cobrem ambos caminhos.** Rodar `pnpm --filter @fixearn/web test -- useStellarTx` → PASS. Adicionar caso de teste se algum caminho ficou descoberto.

### Task 10: Remover código morto

**Files:**
- Delete (condicional): `Eyebrow.tsx`, `SegmentedControl.tsx`, `StatTile.tsx`, `StatPanel.tsx` (+ seus `.test.tsx`)

- [ ] **Step 1: Provar que é morto.** Para cada componente: `grep -rn "<NomeDoComponente" apps/web/src --include=*.tsx` (e por import). Se só aparece em testes próprios e/ou na landing `page.tsx`, decidir: usado na landing = manter; sem nenhum uso de produto = remover.

- [ ] **Step 2: Deletar** apenas os comprovadamente órfãos, junto com seus testes.

- [ ] **Step 3: Build + testes web.** `pnpm --filter @fixearn/web build && pnpm --filter @fixearn/web test` → PASS, sem import quebrado.

- [ ] **Step 4 (commit da Fase 2 — só quando o usuário pedir)**

```bash
git add apps/web
git commit -m "refactor(web): extrai utils/componentes compartilhados e remove código morto"
```

---

# FASE 3 — Velocidade

### Task 11: Paralelizar I/O nos services (runtime API)

**Files:**
- Modify: `ledger.service.ts:26-34`, `deposit.service.ts:18-23`, `withdraw.service.ts:15-20`

- [ ] **Step 1: `computeSpendable`** — mover `wallet.getAddress` para dentro do `Promise.all`:

```ts
async computeSpendable(companyId: string) {
  const [address, principal] = await Promise.all([
    this.wallet.getAddress(companyId),
    this.principal(companyId),
  ]);
  const vaultValue = await this.vault.getPositionValue(address);
  const spendable = vaultValue > principal ? vaultValue - principal : 0n;
  return { vaultValue, principal, spendable };
}
```
> Nota: `getPositionValue` depende de `address`, então só `getAddress`+`principal` paralelizam. Confirmar que a ordem dos testes não fixa sequência específica.

- [ ] **Step 2: `deposit.service.build` / `withdraw.service.build`** — `wallet.getAddress` e o build do vault: o vault depende do address, então não paralelizam diretamente. **Reavaliar**: o ganho real aqui é só se houver outra chamada independente. Se não houver, **não mudar** (evitar mudança sem ganho). Documentar no PR.

- [ ] **Step 3: Testes.** `pnpm --filter @fixearn/api test` → PASS. Ajustar mocks que assumiam ordem sequencial se necessário.

### Task 12: Reusar `rpc.Server` no `StellarService`

**Files:**
- Modify: `apps/api/src/stellar/stellar.service.ts`

- [ ] **Step 1: Ler** o constructor e `attachAndSubmit` (linha ~27). Mover `new rpc.Server(config.sorobanRpcUrl)` para uma propriedade criada no constructor (`this.server`), reusada em `attachAndSubmit`.

- [ ] **Step 2: Testes.** `pnpm --filter @fixearn/api test` → PASS. Ajustar o spec se ele mockava `new rpc.Server` por chamada.

### Task 13: `prisma.upsert` em `CompanyService.findOrCreate`

**Files:**
- Modify: `apps/api/src/company/company.service.ts:8-20`, `company.service.spec.ts`

- [ ] **Step 1: Atualizar/adicionar teste** que cobre criação e idempotência (chamar 2× → mesmo id, sem erro).

- [ ] **Step 2: Reescrever**

```ts
async findOrCreate(privyUserId: string): Promise<{ id: string }> {
  return this.prisma.company.upsert({
    where: { privyUserId },
    create: { privyUserId },
    update: {},
    select: { id: true },
  });
}
```

- [ ] **Step 3: Testes.** `pnpm --filter @fixearn/api test` → PASS. Ajustar o spec (não há mais branch P2002 para mockar).

### Task 14: Batch no `snapshot.job`

**Files:**
- Modify: `apps/api/src/jobs/snapshot.job.ts:14-23`, `snapshot.job.spec.ts`

- [ ] **Step 1: Ler** o job. Hoje: lista companies, loop serial chamando `ledger.snapshot(c.id)`.

- [ ] **Step 2: Paralelizar** os snapshots com `Promise.all` (limite de concorrência se a lista puder ser grande — usar lotes simples de N se necessário; para MVP `Promise.all` direto basta). Manter `snapshot()` por company (não reescrever a matemática).

```ts
const companies = await this.prisma.company.findMany({ select: { id: true } });
await Promise.all(companies.map((company) => this.ledger.snapshot(company.id)));
```

- [ ] **Step 3: Testes.** `pnpm --filter @fixearn/api test` → PASS. Ajustar spec que assumia ordem serial.

### Task 15: Índice `Deposit.companyId` (+ migration)

**Files:**
- Modify: `apps/api/prisma/schema.prisma:46-57`

- [ ] **Step 1: Adicionar** `@@index([companyId])` ao model `Deposit`.

- [ ] **Step 2: Gerar migration**

Run: `pnpm --filter @fixearn/api exec prisma migrate dev --name deposit_company_id_index`
Expected: nova migration criada e aplicada no DB local. (Requer `pnpm db:up` rodando.)

- [ ] **Step 3: Regenerar client + testes.** `pnpm db:generate && pnpm --filter @fixearn/api test` → PASS.

### Task 16: `useMemo` em `Bills.visibleBills`

**Files:**
- Modify: `apps/web/src/app/(app)/dashboard/Bills.tsx:61`

- [ ] **Step 1: Envolver** o cálculo em `useMemo(() => tab === 'all' ? bills : bills.filter((b) => b.type === tab), [bills, tab])`.

- [ ] **Step 2: Testes.** `pnpm --filter @fixearn/web test -- bills` → PASS.

### Task 17: Escopar `PrivyProvider` ao grupo `(app)`

**Files:**
- Modify: `apps/web/src/app/layout.tsx` (root), `apps/web/src/app/(app)/layout.tsx`, providers.

- [ ] **Step 1: LER `node_modules/next/dist/docs/`** sobre layouts/route-groups/providers nesta versão custom do Next (obrigatório por `apps/web/AGENTS.md`).

- [ ] **Step 2: Confirmar** onde `Providers` (Privy) está montado hoje (esperado: root `layout.tsx`, logo carrega em landing/login).

- [ ] **Step 3: Mover** `Providers`/`PrivyProviderWrapper` para `(app)/layout.tsx` (que já tem LangProvider+AuthGate), deixando `/` e `/login` sem Privy. Verificar que `/login` não depende de Privy fora do grupo `(app)` — se depender, manter Privy também no login ou ajustar. **Não quebrar auth.**

- [ ] **Step 4: Validar manualmente** (a skill `/run` ou `pnpm dev:web`): landing e login carregam sem Privy; dashboard/deposit/withdraw funcionam. Testes: `pnpm --filter @fixearn/web test` → PASS.

> Risco arquitetural — confirmar com o usuário antes de mergear se o fluxo de login mudar.

### Task 18: Migrar testes da API de jest → vitest (build/dev)

**Files:**
- Create: `apps/api/vitest.config.ts`
- Modify: `apps/api/package.json` (scripts + devDeps), remover bloco `jest`
- Delete deps: `jest`, `ts-jest`, `@types/jest`
- Add deps: `vitest`, `unplugin-swc`, `@swc/core`

**Interfaces:**
- Produces: `pnpm --filter @fixearn/api test` rodando em vitest.

- [ ] **Step 1: Instalar deps**

```bash
pnpm --filter @fixearn/api add -D vitest unplugin-swc @swc/core
pnpm --filter @fixearn/api remove jest ts-jest @types/jest
```

- [ ] **Step 2: Criar `vitest.config.ts`** (swc resolve `emitDecoratorMetadata` do Nest):

```ts
// apps/api/vitest.config.ts
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
    alias: {
      '@fixearn/shared': new URL('../../packages/shared/src/index.ts', import.meta.url).pathname,
    },
  },
  plugins: [swc.vite()],
});
```

- [ ] **Step 3: Atualizar scripts** em `apps/api/package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:cov": "vitest run --coverage"`. Remover o objeto `jest`. Remover scripts `test:debug`/`test:e2e` jest-específicos ou adaptá-los (e2e pode ficar fora de escopo — anotar).

- [ ] **Step 4: Ajustar specs** se usarem APIs jest-only. Com `globals: true`, `describe/it/expect` funcionam. Trocar `jest.fn()`→`vi.fn()`, `jest.mock`→`vi.mock`, `jest.spyOn`→`vi.spyOn` onde aparecerem. `grep -rn "jest\." apps/api/src`.

- [ ] **Step 5: Rodar**

Run: `pnpm --filter @fixearn/api test`
Expected: toda a suíte (auth.guard, bills, company, deposit, ledger ×2, prisma, snapshot, stellar, vault, wallet, withdraw, parse-money, env) PASS em vitest.

### Task 19: Next config — `optimizePackageImports` (opcional, após docs)

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: LER `node_modules/next/dist/docs/`** sobre `experimental.optimizePackageImports` / opções de bundle desta versão custom. Se a opção não existir/for diferente nesta versão, **pular a task** e registrar.

- [ ] **Step 2: Adicionar** (se suportado) os pacotes pesados confirmados como usados no client (`@privy-io/react-auth`, e Stellar SDK só se realmente importado no client — checar com `grep -rn "stellar-sdk\|@stellar" apps/web/src`).

- [ ] **Step 3: Build.** `pnpm --filter @fixearn/web build` → sucesso. Comparar tamanho de bundle antes/depois se possível.

- [ ] **Step 4 (commit da Fase 3 — só quando o usuário pedir)**

```bash
git add apps/api apps/web
git commit -m "perf: paraleliza I/O, otimiza prisma/stellar/snapshot e migra testes da API p/ vitest"
```

---

## Self-Review (preenchido)

- **Cobertura do spec:** Fase 1 (1.1→Task4, 1.2→Task1, 1.3→Task2, 1.4→Task3) ✓. Fase 2 (2.1→Task5/6, 2.2→Task7/8, 2.3→Task9, 2.4→Task10, 2.5 "não abstrair" respeitado) ✓. Fase 3 (runtime→Task11-16, Privy→Task17, build→Task18-19) ✓. Withdraw-fix: fora de escopo, documentado no spec ✓.
- **Placeholders:** nenhum TODO/TBD; código real nas peças novas; renames com file:line exatos.
- **Consistência de tipos:** `AuthenticatedRequest`, `getErrorMessage`, `validateAmount` usados com a mesma assinatura onde referenciados.
- **Riscos sinalizados:** Task17 (auth flow) e Task15 (migration/DB) marcados; Tasks 11.2 e 19 podem ser puladas se não houver ganho/suporte — explicitado para não forçar mudança sem valor.
