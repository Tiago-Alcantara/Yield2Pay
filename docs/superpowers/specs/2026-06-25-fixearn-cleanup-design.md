---
title: FixEarn Cleanup — Padronização, Redundância e Velocidade
date: 2026-06-25
status: draft
area: specs
related:
  - "[[Preference - Coding Style]]"
---

# FixEarn Cleanup — Design

## Objetivo

Melhorar o código do monorepo FixEarn (`apps/api` NestJS, `apps/web` Next.js, `packages/shared`)
em três frentes, **nesta ordem de prioridade**:

1. **Padronizar** segundo `docs/Preference - Coding Style.md`
2. **Reduzir redundância** (duplicação e código morto)
3. **Velocidade** (runtime + build/dev)

Restrição forte do preference: **clareza e código linear acima de DRY agressivo**.
Não introduzir over-abstraction (ex.: base-controller/factory) só para remover duplicação.

## Decisões tomadas

- **Withdraw bug**: `withdraw.submit()` ignora `companyId` e não grava no ledger → **corrigir**.
- **Utils compartilhados**: ficam **por app** (`apps/web/src/lib`, `apps/api/src/common`), não em `packages/shared`. `packages/shared` continua só com tipos/DTOs.
- **Test runner**: **migrar API de jest+ts-jest → vitest** (alinha com web, build de teste mais rápido).

---

## Fase 1 — Padronizar (preference doc)

Baixo risco, mecânico. Ativa guard-rails primeiro para o padrão se manter.

### 1.1 Lint guard-rails (API)
`apps/api/eslint.config.mjs:28-33` — elevar a `error`:
- `@typescript-eslint/no-explicit-any` (hoje `off`)
- `@typescript-eslint/no-floating-promises` (hoje `warn`)
- `@typescript-eslint/no-unsafe-argument` (hoje `warn`)

### 1.2 Eliminar `any`
Criar tipo explícito `AuthenticatedRequest` (campo `companyId: string` injetado pelo guard) em `apps/api/src/auth/`.
Substituir `@Req() req: any` em:
- `bills.controller.ts:12,17,22`
- `ledger.controller.ts:12`
- `wallet.controller.ts:11`
- `deposit.controller.ts:13,18`
- `withdraw.controller.ts:13,18`

`main.ts:9` (`BigInt.prototype as any` toJSON) e `main.ts:13` (`req/res/next: any`) — tipar com tipos do express.

### 1.3 Nomes explícitos
- `cfg` → `config`: `stellar.service.ts:11`, `vault.service.ts:32`, `privy.service.ts:9`
- `w` → `wallet`: `wallet.service.ts:21`
- `p` → `parsed`: `config/env.ts:24`
- `agg` → `depositAggregate`: `ledger.service.ts:19`

### 1.4 Naming uniforme de service injetado nos controllers
Padrão único: `private readonly <name>Service`. Ajustar os plurais:
- `deposit.controller.ts:10` `deposits` → `depositService`
- `wallet.controller.ts:9` `wallets` → `walletService`
- `withdraw.controller.ts:10` `withdraws` → `withdrawService`
- `bills.controller.ts:9` já é `billsService` ✓ (referência do padrão)

**Gate Fase 1**: `pnpm lint` + testes verdes nos dois apps.

---

## Fase 2 — Redundância

### 2.1 Utils web (`apps/web/src/lib`)
- `getErrorMessage(err): string` (`err instanceof Error ? err.message : String(err)`) — substituir as ~5 cópias em deposit/withdraw pages e `Bills.tsx`.
- `validateAmount(value): string | null` — unificar as 3 cópias (deposit page, withdraw page, `Bills.tsx`).

### 2.2 Componentes web (`apps/web/src/components`)
- `<BrandHeader/>` — extrair os 4 renders idênticos (deposit ×2, withdraw ×2).
- `<TxResultCard/>` — success state deposit↔withdraw (~85% igual).
- `<TxErrorBox/>` — caixa de erro deposit↔withdraw (~95% igual).

### 2.3 `useStellarTx.ts`
Colapsar os twins `deposit`/`withdraw` (~85% iguais) numa função parametrizada por ação — **só se ficar mais legível**; manter explícito se a parametrização adicionar magia.

### 2.4 Código morto
Verificar uso real e deletar se órfãos: `Eyebrow.tsx`, `SegmentedControl.tsx`, `StatTile.tsx`, `StatPanel.tsx`. (Checar imports fora de testes e da landing antes de remover.)

### 2.5 API — NÃO abstrair
`deposit.service.build()` ↔ `withdraw.service.build()` são ~95% iguais, e os controllers idênticos. **Manter explícitos** (preference: evitar over-abstraction). Sem base-controller/factory.

**Gate Fase 2**: testes verdes; nenhum import quebrado.

---

## Fase 3 — Velocidade

### Runtime — API
- `ledger.service.ts:26-34` `computeSpendable`: mover `wallet.getAddress()` para dentro do `Promise.all` (hoje serial antes do paralelo).
- `deposit.service.ts:18-23` e `withdraw.service.ts:15-20` `build()`: paralelizar wallet + vault com `Promise.all`.
- `stellar.service.ts:27`: criar `new rpc.Server(...)` uma vez no constructor, reusar.
- `company.service.ts:8-20`: trocar findOrCreate por `prisma.company.upsert` (remove race TOCTOU).
- `jobs/snapshot.job.ts:14-23`: batch-fetch + paralelizar vault calls (hoje N+1 serial).
- `schema.prisma` Deposit: adicionar `@@index([companyId])` (suporta `principal()` aggregate). **Requer migration.**

### Runtime — Web
- `Bills.tsx:61`: `useMemo` em `visibleBills` (`[bills, tab]`).
- Privy: avaliar mover `PrivyProvider` para o grupo `(app)` (hoje no root → carrega na landing/login).
  **Pré-requisito**: confirmar onde `Providers` está montado (root layout) e **ler `node_modules/next/dist/docs/`** antes (Next custom — ver `apps/web/AGENTS.md`).

### Build / dev
- **API jest → vitest**: trocar runner, remover `ts-jest`, adaptar specs (`describe/it/expect` compatíveis; ajustar mocks de `@nestjs/testing`).
- Next config (`optimizePackageImports` p/ Privy/Stellar SDK): **só após ler os docs do Next custom**. Não aplicar config de memória/treinamento.

**Gate Fase 3**: testes verdes; migration aplicada local; medir antes/depois onde fizer sentido.

---

## Tarefa separada (FORA desta rodada) — Correção do Withdraw

> **Decidido: NÃO faz parte desta rodada.** Vira tarefa própria depois.
> Durante esta rodada, em `withdraw.service.submit()` apenas manter o `_companyId`
> como está (não remover), para não esconder o bug nem mudar comportamento.

`withdraw.submit()` precisa registrar o saque e reduzir o principal. Hoje **não existe**
`recordWithdraw` nem modelo de saque; `principal()` = só soma de deposits.

Escopo real (não é só refactor), para a tarefa futura:
1. Schema: novo modelo `Withdrawal` (companyId, amount, txHash, createdAt, `@@index([companyId])`) + **migration**.
2. `ledger.service`: `recordWithdraw(companyId, amount, txHash)`; `principal()` passa a ser `sum(deposits) - sum(withdrawals)`.
3. `withdraw.service.submit(companyId, dto)`: usar `companyId` e chamar `recordWithdraw`.
4. Atualizar specs afetados (`ledger.service.spec`, `withdraw.service.spec`).

**Risco**: muda a matemática de `spendable`. Validar com testes antes de mergear.

---

## Ordem de execução (esta rodada)

1. Fase 1 (padronizar) — começar já, sem dependências.
2. Fase 2 (redundância).
3. Fase 3 (velocidade).

Cada fase é independentemente entregável; rodar lint+testes ao fim de cada uma.
Withdraw-fix fica fora desta rodada (tarefa separada acima).

## Fora de escopo

- Mover utils para `packages/shared` (decidido: por app).
- Base-controller/factory na API (over-abstraction).
- Trocar Prisma adapter por driver nativo (ganho marginal; revisitar só se DB virar gargalo).
