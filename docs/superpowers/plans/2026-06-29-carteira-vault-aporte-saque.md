# Carteira ↔ Vault (aporte e saque) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir mover XLM que o cliente já tem na carteira para o vault DeFindex (render) e sacar de volta, com painel unificado + drawer no dashboard.

**Architecture:** Camada aditiva fina sobre a plumbing de tx que já existe (`useStellarTx`, deposit/withdraw services, vault SDK). Backend ganha leitura de saldo on-chain e pré-check; deposit deixa de abastecer a carteira via sponsor (modelo real, sponsor só paga fee-bump); frontend ganha `MoneyPanel` + `MoveDrawer`.

**Tech Stack:** NestJS + Prisma + `@stellar/stellar-sdk` (Soroban RPC) + `@defindex/sdk` (backend, Vitest). Next.js + React + Privy + Vitest/Testing-Library (frontend). Monorepo pnpm; tipos compartilhados em `packages/shared`.

## Global Constraints

- **Modelo real:** o deposit move **só** carteira→vault. **Remover** `stellar.fundClient` do `DepositService.build`. Sponsor (`FEE_SPONSOR_SECRET_KEY`) continua pagando só o fee-bump, nunca o valor.
- **Fiat cosmético:** labels `$`/`R$` cosméticos; valor por trás é XLM nativo 1:1, 7 casas decimais (stroops = base units). Sem cotação.
- **Reserva:** `RESERVE_BUFFER_BASE_UNITS = 15_000_000n` (1.5 XLM). Mesma constante no back (pré-check) e no cálculo de spendable.
- **Não-custodial:** chave do cliente é só do Privy; backend nunca toca. `submit` valida `dto.stellarAddress === wallet registrada` (anti-spoof) — manter.
- **Base units como string na API**; `bigint` no domínio backend.
- **Commits:** mensagens **sem** `Co-Authored-By` (nem qualquer trailer de co-autoria) — regra do projeto.
- **Next.js:** este repo usa um Next com breaking changes; conferir `node_modules/next/dist/docs/` antes de usar APIs de routing/redirect.

---

### Task 1: `StellarService.getNativeBalance`

Lê o saldo XLM nativo on-chain via Soroban RPC (não há Horizon configurado).

**Files:**
- Modify: `apps/api/src/stellar/stellar.service.ts`
- Test: `apps/api/src/stellar/stellar.service.spec.ts`

**Interfaces:**
- Consumes: `this.server: rpc.Server` (já existe no construtor), `Keypair`, `xdr` (importado como `xdr as StellarXdr`).
- Produces: `getNativeBalance(address: string): Promise<bigint>` — stroops; `0n` se a conta não existe on-chain.

- [ ] **Step 1: Write the failing tests**

Adicionar ao fim de `apps/api/src/stellar/stellar.service.spec.ts`:

```ts
// ── getNativeBalance ──────────────────────────────────────────────────────────

it('getNativeBalance lê o balance nativo do AccountEntry (stroops)', async () => {
  const addr = Keypair.random().publicKey();
  const server = {
    getLedgerEntries: vi.fn().mockResolvedValue({
      entries: [
        { val: { account: () => ({ balance: () => ({ toString: () => '250000000' }) }) } },
      ],
      latestLedger: 1,
    }),
  } as unknown as rpc.Server;

  const bal = await new StellarService(cfg, server).getNativeBalance(addr);
  expect(bal).toBe(250000000n); // 25 XLM
  expect(server.getLedgerEntries).toHaveBeenCalledTimes(1);
});

it('getNativeBalance retorna 0n quando a conta não existe (sem entries)', async () => {
  const server = {
    getLedgerEntries: vi.fn().mockResolvedValue({ entries: [], latestLedger: 1 }),
  } as unknown as rpc.Server;

  const bal = await new StellarService(cfg, server).getNativeBalance(Keypair.random().publicKey());
  expect(bal).toBe(0n);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm vitest run src/stellar/stellar.service.spec.ts -t getNativeBalance`
Expected: FAIL — `getNativeBalance is not a function`.

- [ ] **Step 3: Implement `getNativeBalance`**

Em `apps/api/src/stellar/stellar.service.ts`, adicionar o método (depois de `fundClient`, antes de `attachAndSubmit`):

```ts
  /**
   * Lê o saldo XLM nativo da conta on-chain via Soroban RPC.
   * `getAccount` do RPC não traz balance — usamos `getLedgerEntries` no
   * LedgerKey da conta e parseamos o `AccountEntry.balance` (Int64 stroops).
   * Retorna 0n se a conta ainda não existe on-chain.
   */
  async getNativeBalance(address: string): Promise<bigint> {
    const key = StellarXdr.LedgerKey.account(
      new StellarXdr.LedgerKeyAccount({
        accountId: Keypair.fromPublicKey(address).xdrAccountId(),
      }),
    );
    const resp = await this.server.getLedgerEntries(key);
    const entry = resp.entries?.[0];
    if (!entry) return 0n;
    return BigInt(entry.val.account().balance().toString());
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pnpm vitest run src/stellar/stellar.service.spec.ts -t getNativeBalance`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/stellar/stellar.service.ts apps/api/src/stellar/stellar.service.spec.ts
git commit -m "feat(api): read native XLM balance via getLedgerEntries"
```

---

### Task 2: Reserve constant + `WalletService.getBalance`

**Files:**
- Create: `apps/api/src/common/reserve.ts`
- Modify: `apps/api/src/wallet/wallet.service.ts`
- Test: `apps/api/src/wallet/wallet.service.spec.ts`

**Interfaces:**
- Consumes: `StellarService.getNativeBalance` (Task 1), `WalletService.getAddress` (existe).
- Produces:
  - `RESERVE_BUFFER_BASE_UNITS: bigint` (= `15_000_000n`)
  - `WalletService.getBalance(companyId: string): Promise<{ balance: string; spendable: string }>` — base units como string.

- [ ] **Step 1: Create the reserve constant**

Criar `apps/api/src/common/reserve.ts`:

```ts
/**
 * Buffer de reserva mantido na carteira do cliente (não aportável).
 * Cobre a reserva mínima base da conta Stellar (1 XLM) + folga. O path do
 * vault XLM nativo não cria subentries/trustline, então a reserva fica no mínimo.
 * 1.5 XLM em base units (7 casas).
 */
export const RESERVE_BUFFER_BASE_UNITS = 15_000_000n;
```

- [ ] **Step 2: Write the failing test**

Adicionar ao fim de `apps/api/src/wallet/wallet.service.spec.ts`:

```ts
import { RESERVE_BUFFER_BASE_UNITS } from '../common/reserve';

it('getBalance: retorna balance e spendable (balance − reserva)', async () => {
  const prisma = {} as any;
  const stellar = { getNativeBalance: vi.fn().mockResolvedValue(120_0000000n) }; // 120 XLM
  const svc = new WalletService(prisma, stellar as any);
  vi.spyOn(svc, 'getAddress').mockResolvedValue('GADDR');

  const r = await svc.getBalance('co_1');
  expect(stellar.getNativeBalance).toHaveBeenCalledWith('GADDR');
  expect(r.balance).toBe('1200000000');
  expect(r.spendable).toBe((1200000000n - RESERVE_BUFFER_BASE_UNITS).toString()); // 1185000000
});

it('getBalance: spendable nunca é negativo (saldo abaixo da reserva)', async () => {
  const stellar = { getNativeBalance: vi.fn().mockResolvedValue(5_000000n) }; // 0.5 XLM
  const svc = new WalletService({} as any, stellar as any);
  vi.spyOn(svc, 'getAddress').mockResolvedValue('GADDR');

  const r = await svc.getBalance('co_1');
  expect(r.balance).toBe('5000000');
  expect(r.spendable).toBe('0');
});
```

> Nota: se o `wallet.service.spec.ts` ainda não importar `vi`/`it` (estão globais no setup do projeto), seguir o mesmo padrão dos outros testes do arquivo.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && pnpm vitest run src/wallet/wallet.service.spec.ts -t getBalance`
Expected: FAIL — `getBalance is not a function`.

- [ ] **Step 4: Implement `getBalance`**

Em `apps/api/src/wallet/wallet.service.ts`, importar a constante e adicionar o método:

```ts
import { RESERVE_BUFFER_BASE_UNITS } from '../common/reserve';
```

```ts
  async getBalance(
    companyId: string,
  ): Promise<{ balance: string; spendable: string }> {
    const address = await this.getAddress(companyId);
    const balance = await this.stellar.getNativeBalance(address);
    const spendable =
      balance > RESERVE_BUFFER_BASE_UNITS
        ? balance - RESERVE_BUFFER_BASE_UNITS
        : 0n;
    return { balance: balance.toString(), spendable: spendable.toString() };
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && pnpm vitest run src/wallet/wallet.service.spec.ts -t getBalance`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/reserve.ts apps/api/src/wallet/wallet.service.ts apps/api/src/wallet/wallet.service.spec.ts
git commit -m "feat(api): WalletService.getBalance with reserve buffer"
```

---

### Task 3: Shared `WalletBalanceView` + `GET /wallet/balance`

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/wallet/wallet.controller.ts`
- Test: `apps/api/src/wallet/wallet.controller.spec.ts` (Create)

**Interfaces:**
- Consumes: `WalletService.getBalance` (Task 2), `AuthGuard`, `AuthenticatedRequest` (existem).
- Produces:
  - `interface WalletBalanceView { balance: string; spendable: string }` em `@yield2pay/shared`.
  - Rota `GET /wallet/balance` → `WalletBalanceView`.

- [ ] **Step 1: Add the shared type**

Em `packages/shared/src/index.ts`, adicionar:

```ts
export interface WalletBalanceView { balance: string; spendable: string; }
```

- [ ] **Step 2: Write the failing controller test**

Criar `apps/api/src/wallet/wallet.controller.spec.ts`:

```ts
import { WalletController } from './wallet.controller';

it('GET /wallet/balance delega para walletService.getBalance(companyId)', async () => {
  const walletService = {
    getBalance: vi.fn().mockResolvedValue({ balance: '1200000000', spendable: '1185000000' }),
  };
  const ctrl = new WalletController(walletService as any);
  const r = await ctrl.balance({ companyId: 'co_1' } as any);
  expect(walletService.getBalance).toHaveBeenCalledWith('co_1');
  expect(r).toEqual({ balance: '1200000000', spendable: '1185000000' });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && pnpm vitest run src/wallet/wallet.controller.spec.ts`
Expected: FAIL — `ctrl.balance is not a function`.

- [ ] **Step 4: Add the route**

Em `apps/api/src/wallet/wallet.controller.ts`, adicionar import `Get` e o handler:

```ts
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
```

```ts
  @Get('balance')
  balance(@Req() req: AuthenticatedRequest) {
    return this.walletService.getBalance(req.companyId);
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && pnpm vitest run src/wallet/wallet.controller.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/index.ts apps/api/src/wallet/wallet.controller.ts apps/api/src/wallet/wallet.controller.spec.ts
git commit -m "feat: add GET /wallet/balance endpoint and WalletBalanceView type"
```

---

### Task 4: `DepositService.build` — remove fundClient + pré-check de saldo

**Files:**
- Modify: `apps/api/src/deposit/deposit.service.ts`
- Test: `apps/api/src/deposit/deposit.service.spec.ts`

**Interfaces:**
- Consumes: `StellarService.getNativeBalance` (Task 1), `RESERVE_BUFFER_BASE_UNITS` (Task 2), `VaultService.buildDeposit`, `StellarService.hashForSigning`, `WalletService.getAddress` (existem).
- Produces: `DepositService.build` agora **não** chama `fundClient`; lança `BadRequestException('saldo insuficiente na carteira')` quando `amount > spendable`.

- [ ] **Step 1: Rewrite the failing tests**

Substituir o conteúdo de `apps/api/src/deposit/deposit.service.spec.ts` por:

```ts
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { DepositService } from './deposit.service';
import { RESERVE_BUFFER_BASE_UNITS } from '../common/reserve';

const BIG_BALANCE = (RESERVE_BUFFER_BASE_UNITS + 1_000_000_000n).toString(); // reserva + 100 XLM

it('build: checa saldo, monta o xdr do vault e retorna o hash (sem fundClient)', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const vault = { buildDeposit: vi.fn().mockResolvedValue({ xdr: 'XDR1' }) };
  const stellar = {
    getNativeBalance: vi.fn().mockResolvedValue(BigInt(BIG_BALANCE)),
    hashForSigning: vi.fn().mockReturnValue({ hash: '0xabc' }),
    fundClient: vi.fn(),
  };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);

  const r = await svc.build('co_1', 1000000n);

  expect(stellar.fundClient).not.toHaveBeenCalled();
  expect(stellar.getNativeBalance).toHaveBeenCalledWith('GADDR');
  expect(vault.buildDeposit).toHaveBeenCalledWith('GADDR', 1000000n);
  expect(r).toEqual({ xdr: 'XDR1', hash: '0xabc' });
});

it('build: rejeita quando amount > spendable (saldo insuficiente)', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const vault = { buildDeposit: vi.fn() };
  const stellar = {
    getNativeBalance: vi.fn().mockResolvedValue(RESERVE_BUFFER_BASE_UNITS + 5_000000n), // só 0.5 XLM spendable
    hashForSigning: vi.fn(),
    fundClient: vi.fn(),
  };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);

  await expect(svc.build('co_1', 1_000000000n)).rejects.toThrow(BadRequestException);
  expect(vault.buildDeposit).not.toHaveBeenCalled();
});

it('build: rejeita amount acima do teto MAX_DEPOSIT', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const vault = { buildDeposit: vi.fn() };
  const stellar = { getNativeBalance: vi.fn(), hashForSigning: vi.fn(), fundClient: vi.fn() };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);

  await expect(svc.build('co_1', 100_000_000_001n)).rejects.toThrow(BadRequestException);
  expect(vault.buildDeposit).not.toHaveBeenCalled();
});

it('submit: attaches sig, submits, records deposit', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const stellar = { attachAndSubmit: vi.fn().mockResolvedValue({ txHash: 'TX9' }) };
  const ledger = { recordDeposit: vi.fn().mockResolvedValue(undefined) };
  const svc = new DepositService({} as any, stellar as any, ledger as any, wallet as any);

  const r = await svc.submit('co_1', { xdr: 'X', signatureHex: '0xsig', stellarAddress: 'GADDR', amount: '1000000' });
  expect(stellar.attachAndSubmit).toHaveBeenCalledWith('X', 'GADDR', '0xsig');
  expect(ledger.recordDeposit).toHaveBeenCalledWith('co_1', 1000000n, 'TX9');
  expect(r).toEqual({ txHash: 'TX9' });
});

it('submit: rejeita com Forbidden quando o address não bate com a wallet registrada', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const stellar = { attachAndSubmit: vi.fn() };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService({} as any, stellar as any, ledger as any, wallet as any);

  await expect(
    svc.submit('co_1', { xdr: 'X', signatureHex: '0xsig', stellarAddress: 'GEVIL', amount: '1000000' }),
  ).rejects.toThrow(ForbiddenException);
  expect(stellar.attachAndSubmit).not.toHaveBeenCalled();
  expect(ledger.recordDeposit).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm vitest run src/deposit/deposit.service.spec.ts`
Expected: FAIL — o `build` atual ainda chama `fundClient` e não tem o pré-check.

- [ ] **Step 3: Rewrite `build`**

Em `apps/api/src/deposit/deposit.service.ts`: importar a constante e reescrever `build` (remover a chamada `fundClient`):

```ts
import { RESERVE_BUFFER_BASE_UNITS } from '../common/reserve';
```

```ts
  async build(companyId: string, amount: bigint): Promise<BuildTxResponse> {
    if (amount > MAX_DEPOSIT_BASE_UNITS) {
      throw new BadRequestException('amount exceeds maximum deposit');
    }
    const address = await this.wallet.getAddress(companyId);
    const balance = await this.stellar.getNativeBalance(address);
    const spendable =
      balance > RESERVE_BUFFER_BASE_UNITS
        ? balance - RESERVE_BUFFER_BASE_UNITS
        : 0n;
    if (amount > spendable) {
      throw new BadRequestException('saldo insuficiente na carteira');
    }
    const { xdr } = await this.vault.buildDeposit(address, amount);
    const { hash } = this.stellar.hashForSigning(xdr);
    return { xdr, hash };
  }
```

> O comentário sobre `fundClient` (linhas ~29-32 do arquivo) deve ser removido junto. `MAX_DEPOSIT_BASE_UNITS` continua como guarda. `submit` fica inalterado.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pnpm vitest run src/deposit/deposit.service.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/deposit/deposit.service.ts apps/api/src/deposit/deposit.service.spec.ts
git commit -m "feat(api): deposit from wallet funds, drop sponsor top-up, add balance pre-check"
```

---

### Task 5: `LedgerService.recordWithdraw` + `principal()` floor

Saque registra um lançamento negativo (reduz o principal). `principal()` passa a clampar em 0 pra evitar valor negativo quando se saca o rendimento.

**Files:**
- Modify: `apps/api/src/ledger/ledger.service.ts`
- Test: `apps/api/src/ledger/ledger.service.spec.ts`

**Interfaces:**
- Consumes: `this.prisma.deposit` (model existente; `amount: BigInt` aceita negativo; `txHash` é `@unique` — hash do saque ≠ hash do depósito).
- Produces: `LedgerService.recordWithdraw(companyId: string, amount: bigint, txHash: string): Promise<void>`; `principal()` retorna `max(0n, soma)`.

- [ ] **Step 1: Write the failing tests**

Adicionar ao fim de `apps/api/src/ledger/ledger.service.spec.ts`:

```ts
it('recordWithdraw: grava um lançamento negativo (reduz principal)', async () => {
  const prisma = { deposit: { create: vi.fn().mockResolvedValue({}) } } as any;
  const svc = new LedgerService(prisma, {} as any, {} as any);
  await svc.recordWithdraw('co_1', 250000n, 'TXW');
  expect(prisma.deposit.create).toHaveBeenCalledWith({
    data: { companyId: 'co_1', amount: -250000n, txHash: 'TXW' },
  });
});

it('principal: clampa em 0 quando a soma é negativa', async () => {
  const prisma = {
    deposit: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: -5000n } }) },
  } as any;
  const svc = new LedgerService(prisma, {} as any, {} as any);
  expect(await svc.principal('co_1')).toBe(0n);
});
```

> Conferir os args do construtor de `LedgerService` no `ledger.service.spec.ts` existente e espelhar (ordem: `prisma, vault, wallet`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm vitest run src/ledger/ledger.service.spec.ts -t "recordWithdraw|clampa"`
Expected: FAIL — `recordWithdraw is not a function` / principal retorna `-5000n`.

- [ ] **Step 3: Implement**

Em `apps/api/src/ledger/ledger.service.ts`:

Adicionar o método (depois de `recordDeposit`):

```ts
  async recordWithdraw(
    companyId: string,
    amount: bigint,
    txHash: string,
  ): Promise<void> {
    // Lançamento negativo: reduz o principal agregado em principal().
    await this.prisma.deposit.create({
      data: { companyId, amount: -amount, txHash },
    });
  }
```

Alterar o `return` de `principal()` para clampar em 0:

```ts
    const sum = depositAggregate._sum.amount ?? 0n;
    return sum > 0n ? sum : 0n;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pnpm vitest run src/ledger/ledger.service.spec.ts`
Expected: PASS (todos, incluindo os 2 novos).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ledger/ledger.service.ts apps/api/src/ledger/ledger.service.spec.ts
git commit -m "feat(api): ledger records withdrawals as negative entries, floor principal at 0"
```

---

### Task 6: `WithdrawService` grava o saque no ledger

**Files:**
- Modify: `apps/api/src/withdraw/withdraw.service.ts`
- Modify: `apps/api/src/withdraw/withdraw.module.ts`
- Test: `apps/api/src/withdraw/withdraw.service.spec.ts`

**Interfaces:**
- Consumes: `LedgerService.recordWithdraw` (Task 5), `parseBaseUnits` (`apps/api/src/common/parse-money.ts`), `LedgerModule` (existe, exporta `LedgerService`).
- Produces: `WithdrawService` com construtor `(vault, stellar, wallet, ledger)`; `submit` chama `ledger.recordWithdraw(companyId, parseBaseUnits(dto.amount), txHash)` após `attachAndSubmit`.

- [ ] **Step 1: Update the failing tests**

Substituir o conteúdo de `apps/api/src/withdraw/withdraw.service.spec.ts` por:

```ts
import { ForbiddenException } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';

it('build: builds withdraw xdr for the company wallet', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const vault = { buildWithdraw: vi.fn().mockResolvedValue({ xdr: 'WXDR' }) };
  const stellar = { hashForSigning: vi.fn().mockReturnValue({ hash: '0xdef' }) };
  const ledger = { recordWithdraw: vi.fn() };
  const svc = new WithdrawService(vault as any, stellar as any, wallet as any, ledger as any);
  const r = await svc.build('co_1', 250000n);
  expect(vault.buildWithdraw).toHaveBeenCalledWith('GADDR', 250000n);
  expect(r).toEqual({ xdr: 'WXDR', hash: '0xdef' });
});

it('submit: attaches sig, submits and records the withdraw', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const stellar = { attachAndSubmit: vi.fn().mockResolvedValue({ txHash: 'TXW' }) };
  const ledger = { recordWithdraw: vi.fn().mockResolvedValue(undefined) };
  const svc = new WithdrawService({} as any, stellar as any, wallet as any, ledger as any);
  const r = await svc.submit('co_1', { xdr: 'X', signatureHex: '0xs', stellarAddress: 'GADDR', amount: '250000' });
  expect(stellar.attachAndSubmit).toHaveBeenCalledWith('X', 'GADDR', '0xs');
  expect(ledger.recordWithdraw).toHaveBeenCalledWith('co_1', 250000n, 'TXW');
  expect(r).toEqual({ txHash: 'TXW' });
});

it('submit: rejects with ForbiddenException when stellarAddress does not match registered wallet', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const stellar = { attachAndSubmit: vi.fn() };
  const ledger = { recordWithdraw: vi.fn() };
  const svc = new WithdrawService({} as any, stellar as any, wallet as any, ledger as any);
  await expect(
    svc.submit('co_1', { xdr: 'X', signatureHex: '0xs', stellarAddress: 'GEVIL', amount: '250000' }),
  ).rejects.toThrow(ForbiddenException);
  expect(stellar.attachAndSubmit).not.toHaveBeenCalled();
  expect(ledger.recordWithdraw).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm vitest run src/withdraw/withdraw.service.spec.ts`
Expected: FAIL — construtor não aceita 4º arg / `submit` não chama `recordWithdraw`.

- [ ] **Step 3: Implement**

Reescrever `apps/api/src/withdraw/withdraw.service.ts`:

```ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { VaultService } from '../vault/vault.service';
import { StellarService } from '../stellar/stellar.service';
import { WalletService } from '../wallet/wallet.service';
import { LedgerService } from '../ledger/ledger.service';
import { parseBaseUnits } from '../common/parse-money';
import { BuildTxResponse, SubmitTxDto } from '@yield2pay/shared';

@Injectable()
export class WithdrawService {
  constructor(
    private readonly vault: VaultService,
    private readonly stellar: StellarService,
    private readonly wallet: WalletService,
    private readonly ledger: LedgerService,
  ) {}

  async build(companyId: string, amount: bigint): Promise<BuildTxResponse> {
    const address = await this.wallet.getAddress(companyId);
    const { xdr } = await this.vault.buildWithdraw(address, amount);
    const { hash } = this.stellar.hashForSigning(xdr);
    return { xdr, hash };
  }

  async submit(
    companyId: string,
    dto: SubmitTxDto,
  ): Promise<{ txHash: string }> {
    const registered = await this.wallet.getAddress(companyId);
    if (dto.stellarAddress !== registered) {
      throw new ForbiddenException('stellar address does not match registered wallet');
    }
    const { txHash } = await this.stellar.attachAndSubmit(
      dto.xdr,
      dto.stellarAddress,
      dto.signatureHex,
    );
    await this.ledger.recordWithdraw(companyId, parseBaseUnits(dto.amount), txHash);
    return { txHash };
  }
}
```

Em `apps/api/src/withdraw/withdraw.module.ts`, adicionar `LedgerModule` aos imports:

```ts
import { LedgerModule } from '../ledger/ledger.module';
```

```ts
  imports: [VaultModule, StellarModule, WalletModule, LedgerModule, AuthModule],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pnpm vitest run src/withdraw/withdraw.service.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify the Nest module compiles (DI graph)**

Run: `cd apps/api && pnpm build`
Expected: build OK (sem erro de provider `LedgerService` não resolvido).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/withdraw/withdraw.service.ts apps/api/src/withdraw/withdraw.module.ts apps/api/src/withdraw/withdraw.service.spec.ts
git commit -m "feat(api): record withdrawals in the ledger for principal parity"
```

---

### Task 7: `api.getWalletBalance` (frontend)

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Consumes: `WalletBalanceView` (Task 3).
- Produces: `ApiMethods.getWalletBalance(): Promise<WalletBalanceView>` → `GET /wallet/balance`.

- [ ] **Step 1: Add the method**

Em `apps/web/src/lib/api.ts`:

Adicionar ao import de tipos: `WalletBalanceView`.

```ts
import type {
  BuildTxResponse,
  SubmitTxDto,
  SubmitTxResponse,
  RegisterWalletDto,
  CreateBillDto,
  SpendableView,
  WalletBalanceView,
  Bill,
} from '@yield2pay/shared';
```

Na interface `ApiMethods`, adicionar:

```ts
  getWalletBalance(): Promise<WalletBalanceView>;
```

No objeto retornado por `createApi`, adicionar (perto de `getDashboard`):

```ts
    getWalletBalance: () => request('/wallet/balance', 'GET'),
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add getWalletBalance API method"
```

---

### Task 8: `MoveDrawer` component

Drawer compartilhado de aporte/saque (overlay sobre o dashboard).

**Files:**
- Create: `apps/web/src/components/MoveDrawer.tsx`
- Test: `apps/web/src/components/MoveDrawer.test.tsx`

**Interfaces:**
- Consumes: `useStellarTx` (`deposit`/`withdraw`), `MetalCard`, `Button`, `Input`, `TxResultCard`, `TxErrorBox`, `toBaseUnits`/`formatUsdc` (`@/lib/money`), `validateAmount`, `getErrorMessage`.
- Produces: `MoveDrawer(props: MoveDrawerProps)` onde
  `interface MoveDrawerProps { mode: 'deposit' | 'withdraw'; maxBaseUnits: string; apyPercent: string; onClose: () => void; onSuccess: () => void; }`

- [ ] **Step 1: Write the failing tests**

Criar `apps/web/src/components/MoveDrawer.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockDeposit = vi.fn();
const mockWithdraw = vi.fn();
vi.mock('@/lib/useStellarTx', () => ({
  useStellarTx: () => ({ deposit: mockDeposit, withdraw: mockWithdraw }),
}));

import { MoveDrawer } from './MoveDrawer';

const baseProps = {
  maxBaseUnits: '1000000000', // 100.00
  apyPercent: '12.00',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

describe('MoveDrawer', () => {
  beforeEach(() => {
    mockDeposit.mockReset();
    mockWithdraw.mockReset();
  });

  it('deposit: chama deposit com base units no confirmar', async () => {
    mockDeposit.mockResolvedValue('txdep');
    render(<MoveDrawer mode="deposit" {...baseProps} />);
    const input = screen.getByLabelText(/valor/i);
    await userEvent.type(input, '10');
    fireEvent.click(screen.getByRole('button', { name: /confirmar aporte/i }));
    await waitFor(() => expect(mockDeposit).toHaveBeenCalledWith('100000000')); // 10 * 10^7
  });

  it('withdraw: chama withdraw com base units no confirmar', async () => {
    mockWithdraw.mockResolvedValue('txwit');
    render(<MoveDrawer mode="withdraw" {...baseProps} />);
    const input = screen.getByLabelText(/valor/i);
    await userEvent.type(input, '10');
    fireEvent.click(screen.getByRole('button', { name: /confirmar saque/i }));
    await waitFor(() => expect(mockWithdraw).toHaveBeenCalledWith('100000000'));
  });

  it('botão max preenche o valor com o máximo disponível', async () => {
    render(<MoveDrawer mode="deposit" {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /max/i }));
    expect((screen.getByLabelText(/valor/i) as HTMLInputElement).value).toBe('100.00');
  });

  it('bloqueia confirmar quando o valor passa do máximo', async () => {
    render(<MoveDrawer mode="deposit" {...baseProps} />);
    await userEvent.type(screen.getByLabelText(/valor/i), '101');
    expect(screen.getByRole('button', { name: /confirmar aporte/i })).toBeDisabled();
  });

  it('mostra erro quando a transação falha', async () => {
    mockDeposit.mockRejectedValue(new Error('saldo insuficiente na carteira'));
    render(<MoveDrawer mode="deposit" {...baseProps} />);
    await userEvent.type(screen.getByLabelText(/valor/i), '10');
    fireEvent.click(screen.getByRole('button', { name: /confirmar aporte/i }));
    await waitFor(() => expect(screen.getByText(/saldo insuficiente/i)).toBeInTheDocument());
  });

  it('sucesso: mostra o hash e o botão fechar chama onSuccess', async () => {
    mockDeposit.mockResolvedValue('txdep123');
    const onSuccess = vi.fn();
    render(<MoveDrawer mode="deposit" {...baseProps} onSuccess={onSuccess} />);
    await userEvent.type(screen.getByLabelText(/valor/i), '10');
    fireEvent.click(screen.getByRole('button', { name: /confirmar aporte/i }));
    await waitFor(() => expect(screen.getByText(/txdep123/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));
    expect(onSuccess).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && pnpm vitest run src/components/MoveDrawer.test.tsx`
Expected: FAIL — módulo `./MoveDrawer` não existe.

- [ ] **Step 3: Implement the component**

Criar `apps/web/src/components/MoveDrawer.tsx`:

```tsx
'use client';

import React, { useState } from 'react';
import { MetalCard } from './MetalCard';
import { Button } from './Button';
import { Input } from './Input';
import { TxResultCard } from './TxResultCard';
import { TxErrorBox } from './TxErrorBox';
import { useStellarTx } from '@/lib/useStellarTx';
import { toBaseUnits, formatUsdc } from '@/lib/money';
import { validateAmount } from '@/lib/validateAmount';
import { getErrorMessage } from '@/lib/errors';

export interface MoveDrawerProps {
  mode: 'deposit' | 'withdraw';
  /** Máximo movível, em base units (deposit = spendable da carteira; withdraw = posição do vault). */
  maxBaseUnits: string;
  apyPercent: string;
  onClose: () => void;
  onSuccess: () => void;
}

const COPY = {
  deposit: { title: 'Aportar no vault', cta: 'Confirmar aporte', source: 'Da carteira', success: 'Aporte confirmado!' },
  withdraw: { title: 'Sacar do vault', cta: 'Confirmar saque', source: 'Do vault', success: 'Saque confirmado!' },
} as const;

export function MoveDrawer({ mode, maxBaseUnits, apyPercent, onClose, onSuccess }: MoveDrawerProps) {
  const tx = useStellarTx();
  const copy = COPY[mode];

  const [amountRaw, setAmountRaw] = useState('');
  const [touched, setTouched] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const formatError = validateAmount(amountRaw);
  const overMax =
    formatError === null && BigInt(toBaseUnits(amountRaw)) > BigInt(maxBaseUnits);
  const validationError = formatError ?? (overMax ? 'Acima do disponível' : null);
  const isValid = validationError === null;

  // Preview de rendimento mensal (informativo): valor × apy% / 12.
  const previewMonthly = (() => {
    if (formatError !== null) return null;
    const apyBps = Math.round(parseFloat(apyPercent || '0') * 100);
    if (!apyBps) return null;
    const monthly = (BigInt(toBaseUnits(amountRaw)) * BigInt(apyBps)) / 10000n / 12n;
    return formatUsdc(monthly.toString());
  })();

  function fillMax() {
    setTouched(true);
    // Trunca pra 2 casas (escala 10^(7-2)) pra nunca arredondar acima do máximo.
    const truncated = (BigInt(maxBaseUnits) / 100000n) * 100000n;
    setAmountRaw(formatUsdc(truncated.toString()));
  }

  async function handleConfirm() {
    if (!isValid) return;
    setSubmitting(true);
    setTxError(null);
    try {
      const hash = await tx[mode](toBaseUnits(amountRaw));
      setTxHash(hash);
    } catch (err) {
      setTxError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (txHash) {
    return (
      <Overlay onClose={onSuccess}>
        <TxResultCard title={copy.success} subtitle="Pronto." txHash={txHash} />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Button onClick={onSuccess}>Fechar</Button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <MetalCard padding={0} radius="var(--fx-radius-2xl)" style={{ border: '1px solid var(--fx-border-metal)' }}>
        <div style={{ padding: 28 }}>
          <h2 style={{ fontFamily: 'var(--fx-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--fx-text)', margin: 0 }}>
            {copy.title}
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
            <span style={{ fontSize: 13, color: 'var(--fx-text-3)' }}>{copy.source}</span>
            <button
              type="button"
              onClick={fillMax}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fx-silver)', fontSize: 13, fontFamily: 'var(--fx-font-mono)' }}
            >
              max ${formatUsdc(maxBaseUnits)}
            </button>
          </div>
          <div style={{ marginTop: 8 }}>
            <Input
              label="Valor"
              prefix="$"
              value={amountRaw}
              onChange={(e) => { setTouched(true); setAmountRaw(e.target.value); }}
              placeholder="0.00"
              hint={touched && validationError ? validationError : undefined}
              aria-label="Valor"
            />
          </div>
          {mode === 'deposit' && previewMonthly && (
            <div style={{ marginTop: 14, fontFamily: 'var(--fx-font-mono)', fontSize: 13, color: 'var(--fx-text-2)' }}>
              Rende ~${previewMonthly}/mês ({apyPercent}% a.a.)
            </div>
          )}
          {txError && <TxErrorBox message={txError} />}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!isValid || submitting}>
              {submitting ? 'Confirmando…' : copy.cta}
            </Button>
          </div>
        </div>
      </MetalCard>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '100%' }}>
        {children}
      </div>
    </div>
  );
}
```

> Conferir o caminho/props reais de `MetalCard`, `TxResultCard`, `TxErrorBox` em `apps/web/src/components/` (usados igual em `withdraw/page.tsx`: `MetalCard` aceita `padding`/`radius`/`style`; `TxResultCard` aceita `title`/`subtitle`/`txHash`; `TxErrorBox` aceita `message`). Conferir que `getErrorMessage` está em `@/lib/errors`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm vitest run src/components/MoveDrawer.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/MoveDrawer.tsx apps/web/src/components/MoveDrawer.test.tsx
git commit -m "feat(web): shared MoveDrawer for deposit/withdraw with max + yield preview"
```

---

### Task 9: `MoneyPanel` component

Painel "Seu dinheiro" (Carteira + Vault) no dashboard.

**Files:**
- Create: `apps/web/src/app/(app)/dashboard/MoneyPanel.tsx`
- Test: `apps/web/src/app/(app)/dashboard/MoneyPanel.test.tsx`

**Interfaces:**
- Consumes: `formatUsdc` (`@/lib/money`).
- Produces: `MoneyPanel(props: MoneyPanelProps)` onde
  `interface MoneyPanelProps { walletBalance: string | null; spendable: string; vaultValue: string; apyPercent: string; onDeposit: () => void; onWithdraw: () => void; }`
  (`walletBalance === null` → saldo indisponível; aporte desabilitado.)

- [ ] **Step 1: Write the failing tests**

Criar `apps/web/src/app/(app)/dashboard/MoneyPanel.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { MoneyPanel } from './MoneyPanel';

const base = {
  walletBalance: '1200000000', // 120.00
  spendable: '1185000000',
  vaultValue: '5000000000', // 500.00
  apyPercent: '15.00',
  onDeposit: vi.fn(),
  onWithdraw: vi.fn(),
};

describe('MoneyPanel', () => {
  it('mostra saldo da carteira e posição do vault formatados', () => {
    render(<MoneyPanel {...base} />);
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
  });

  it('Aportar chama onDeposit; Sacar chama onWithdraw', () => {
    const onDeposit = vi.fn();
    const onWithdraw = vi.fn();
    render(<MoneyPanel {...base} onDeposit={onDeposit} onWithdraw={onWithdraw} />);
    fireEvent.click(screen.getByRole('button', { name: /aportar/i }));
    fireEvent.click(screen.getByRole('button', { name: /sacar/i }));
    expect(onDeposit).toHaveBeenCalled();
    expect(onWithdraw).toHaveBeenCalled();
  });

  it('saldo indisponível: mostra — e desabilita Aportar', () => {
    render(<MoneyPanel {...base} walletBalance={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aportar/i })).toBeDisabled();
  });

  it('desabilita Sacar quando não há posição no vault', () => {
    render(<MoneyPanel {...base} vaultValue="0" />);
    expect(screen.getByRole('button', { name: /sacar/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && pnpm vitest run "src/app/(app)/dashboard/MoneyPanel.test.tsx"`
Expected: FAIL — módulo `./MoneyPanel` não existe.

- [ ] **Step 3: Implement the component**

Criar `apps/web/src/app/(app)/dashboard/MoneyPanel.tsx`:

```tsx
'use client';

import React from 'react';
import { formatUsdc } from '@/lib/money';

export interface MoneyPanelProps {
  walletBalance: string | null; // base units; null = indisponível
  spendable: string;            // base units (máximo de aporte)
  vaultValue: string;           // base units
  apyPercent: string;
  onDeposit: () => void;
  onWithdraw: () => void;
}

function actionBtn(enabled: boolean, primary: boolean): React.CSSProperties {
  return {
    marginTop: 14,
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.45,
    borderRadius: 10,
    padding: '10px 18px',
    border: primary ? 'none' : '1px solid #3A3D41',
    color: primary ? '#0E0F11' : '#F2F3F4',
    background: primary ? 'linear-gradient(180deg,#E6E8EA,#A8AAAD)' : 'rgba(255,255,255,.03)',
  };
}

export function MoneyPanel({
  walletBalance,
  spendable,
  vaultValue,
  apyPercent,
  onDeposit,
  onWithdraw,
}: MoneyPanelProps) {
  const walletAvailable = walletBalance !== null;
  const canDeposit = walletAvailable && BigInt(spendable) > 0n;
  const canWithdraw = BigInt(vaultValue) > 0n;

  return (
    <div style={{ background: '#1A1C1F', border: '1px solid #2A2D31', borderRadius: 18, padding: 24 }}>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9DA1' }}>
        Seu dinheiro
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginTop: 16 }}>
        {/* Carteira */}
        <div>
          <div style={{ fontSize: 13.5, color: '#9A9DA1' }}>Carteira</div>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 28, fontWeight: 600, color: '#F2F3F4', marginTop: 6 }}>
            {walletAvailable ? `$${formatUsdc(walletBalance as string)}` : '—'}
          </div>
          <div style={{ fontSize: 12, color: '#9A9DA1', marginTop: 4 }}>sem render</div>
          <button onClick={onDeposit} disabled={!canDeposit} style={actionBtn(canDeposit, true)}>
            Aportar →
          </button>
        </div>
        {/* Vault */}
        <div>
          <div style={{ fontSize: 13.5, color: '#9A9DA1' }}>Vault</div>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 28, fontWeight: 600, color: '#F2F3F4', marginTop: 6 }}>
            ${formatUsdc(vaultValue)}
          </div>
          <div style={{ fontSize: 12, color: '#C0C2C5', marginTop: 4 }}>~{apyPercent}% a.a.</div>
          <button onClick={onWithdraw} disabled={!canWithdraw} style={actionBtn(canWithdraw, false)}>
            ← Sacar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm vitest run "src/app/(app)/dashboard/MoneyPanel.test.tsx"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/dashboard/MoneyPanel.tsx" "apps/web/src/app/(app)/dashboard/MoneyPanel.test.tsx"
git commit -m "feat(web): MoneyPanel showing wallet (idle) and vault (earning) sides"
```

---

### Task 10: Ligar `MoneyPanel` + `MoveDrawer` no dashboard

**Files:**
- Modify: `apps/web/src/app/(app)/dashboard/page.tsx`
- Test: `apps/web/src/app/(app)/dashboard/dashboard.test.tsx`

**Interfaces:**
- Consumes: `api.getWalletBalance` (Task 7), `MoneyPanel` (Task 9), `MoveDrawer` (Task 8).
- Produces: dashboard busca o saldo da carteira (não-bloqueante), renderiza o `MoneyPanel`, e abre o `MoveDrawer` no modo certo; em sucesso, refetcha saldo + dashboard.

- [ ] **Step 1: Update the dashboard test**

Em `apps/web/src/app/(app)/dashboard/dashboard.test.tsx`:

Adicionar o mock do `getWalletBalance` no `createApi` e stubs dos novos componentes (pra isolar a fiação do dashboard das internals do drawer/painel):

```ts
const mockGetWalletBalance = vi.fn();

vi.mock('@/lib/api', () => ({
  createApi: () => ({
    getDashboard: mockGetDashboard,
    listBills: mockListBills,
    getWalletBalance: mockGetWalletBalance,
  }),
}));

// Stub do MoveDrawer: vira um marcador clicável que dispara onSuccess.
vi.mock('@/components/MoveDrawer', () => ({
  MoveDrawer: ({ mode, onSuccess }: { mode: string; onSuccess: () => void }) => (
    <div data-testid="move-drawer">
      drawer:{mode}
      <button onClick={onSuccess}>drawer-success</button>
    </div>
  ),
}));
```

Atualizar o `setup()` e `beforeEach` pra resolver o saldo:

```ts
function setup() {
  mockGetDashboard.mockResolvedValue(DASHBOARD_DATA);
  mockListBills.mockResolvedValue(BILLS_DATA);
  mockGetWalletBalance.mockResolvedValue({ balance: '1200000000', spendable: '1185000000' });
  return render(<DashboardPage />);
}
```

```ts
  beforeEach(() => {
    mockGetDashboard.mockReset();
    mockListBills.mockReset();
    mockGetWalletBalance.mockReset();
  });
```

Adicionar dois testes novos:

```ts
it('mostra o MoneyPanel com o saldo da carteira', async () => {
  setup();
  // formatUsdc('1200000000') = '120.00'
  await waitFor(() => expect(screen.getByText('$120.00')).toBeInTheDocument());
});

it('clicar Aportar abre o MoveDrawer em modo deposit', async () => {
  setup();
  await waitFor(() => expect(screen.getByRole('button', { name: /aportar/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /aportar/i }));
  expect(screen.getByTestId('move-drawer')).toHaveTextContent('drawer:deposit');
});
```

> Garantir que `fireEvent` está importado de `@testing-library/react` no topo do arquivo.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && pnpm vitest run "src/app/(app)/dashboard/dashboard.test.tsx" -t "MoneyPanel|Aportar"`
Expected: FAIL — dashboard ainda não renderiza `MoneyPanel`/drawer.

- [ ] **Step 3: Wire the dashboard**

Em `apps/web/src/app/(app)/dashboard/page.tsx`:

Imports novos (perto dos outros):

```tsx
import { MoneyPanel } from './MoneyPanel';
import { MoveDrawer } from '@/components/MoveDrawer';
```

Estado novo (perto dos outros `useState`):

```tsx
  const [walletBalance, setWalletBalance] = useState<{ balance: string; spendable: string } | null>(null);
  const [drawer, setDrawer] = useState<'deposit' | 'withdraw' | null>(null);
```

Atualizar `fetchData` pra também buscar o saldo (não-bloqueante: falha no saldo não derruba o dashboard):

```tsx
  const fetchData = useCallback(() => {
    api.getWalletBalance()
      .then(setWalletBalance)
      .catch(() => setWalletBalance(null));
    return Promise.all([api.getDashboard(), api.listBills()])
      .then(([dash, billList]) => {
        setDashboard(dash);
        setBills(billList);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      });
  }, [api]);
```

Trocar o `handleNavClick` (dentro do `.map` da nav) pra abrir o drawer em vez de rotear:

```tsx
            function handleNavClick() {
              if (item.id === 'deposit') {
                setDrawer('deposit');
              } else {
                setNav(item.id);
              }
            }
```

Renderizar o `MoneyPanel` logo antes do bloco de stat panels (`{/* ── Stat panels ... */}`), dentro do `<div>` do body:

```tsx
          <MoneyPanel
            walletBalance={walletBalance ? walletBalance.balance : null}
            spendable={walletBalance ? walletBalance.spendable : '0'}
            vaultValue={dash.vaultValue}
            apyPercent={dash.apyPercent}
            onDeposit={() => setDrawer('deposit')}
            onWithdraw={() => setDrawer('withdraw')}
          />
```

Trocar os `onClick={() => router.push('/deposit')}` do "Deposit CTA card" (chips de quick-amount e o botão `depositCta`) por `onClick={() => setDrawer('deposit')}`.

Renderizar o drawer no fim do `return` (antes de fechar o `</div>` raiz do componente):

```tsx
      {drawer && (
        <MoveDrawer
          mode={drawer}
          maxBaseUnits={drawer === 'deposit' ? (walletBalance?.spendable ?? '0') : dash.vaultValue}
          apyPercent={dash.apyPercent}
          onClose={() => setDrawer(null)}
          onSuccess={() => { setDrawer(null); void fetchData(); }}
        />
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm vitest run "src/app/(app)/dashboard/dashboard.test.tsx"`
Expected: PASS (incluindo os 2 novos; os antigos seguem passando).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/dashboard/page.tsx" "apps/web/src/app/(app)/dashboard/dashboard.test.tsx"
git commit -m "feat(web): wire MoneyPanel and MoveDrawer into the dashboard"
```

---

### Task 11: Aposentar o wizard `/deposit` e redirecionar rotas legadas

A entrada agora é o painel no dashboard. `/deposit` (wizard de 3 passos com passo "Tools" falso) e `/withdraw` viram redirects.

**Files:**
- Modify: `apps/web/src/app/(app)/deposit/page.tsx`
- Modify: `apps/web/src/app/(app)/withdraw/page.tsx`
- Modify: `apps/web/src/app/(app)/withdraw/withdraw.test.tsx`
- Delete: passos do wizard que ficarem órfãos (se houver componentes só-usados-pelo-wizard em `apps/web/src/app/(app)/deposit/`).

**Interfaces:**
- Consumes: `useRouter` de `next/navigation` (já usado no repo).
- Produces: `/deposit` e `/withdraw` redirecionam pra `/dashboard`.

- [ ] **Step 1: Rewrite the withdraw page test**

Substituir o conteúdo de `apps/web/src/app/(app)/withdraw/withdraw.test.tsx` por:

```tsx
import React from 'react';
import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/withdraw',
}));

import WithdrawPage from './page';

describe('Withdraw page (legacy redirect)', () => {
  beforeEach(() => replace.mockReset());

  it('redireciona pra /dashboard', () => {
    render(<WithdrawPage />);
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run "src/app/(app)/withdraw/withdraw.test.tsx"`
Expected: FAIL — a página atual não chama `replace`.

- [ ] **Step 3: Replace the pages with redirects**

Conferir antes a API de redirect deste Next: `ls node_modules/next/dist/docs/` e ler a referência de routing. Usar o padrão client `useRouter().replace` (já usado no dashboard) pra não depender de API server-side incerta.

`apps/web/src/app/(app)/withdraw/page.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WithdrawPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return null;
}
```

`apps/web/src/app/(app)/deposit/page.tsx` (substituir o wizard inteiro):

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DepositPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return null;
}
```

Se a pasta `apps/web/src/app/(app)/deposit/` tiver componentes auxiliares usados só pelo wizard (passos, "Tools"), remover os arquivos órfãos. Conferir com:

```bash
cd apps/web && grep -rl "from './" "src/app/(app)/deposit" | cat
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm vitest run "src/app/(app)/withdraw/withdraw.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Full web test + typecheck**

Run: `cd apps/web && pnpm vitest run && pnpm tsc --noEmit`
Expected: tudo passa; sem erro de import órfão.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/deposit" "apps/web/src/app/(app)/withdraw"
git commit -m "refactor(web): retire deposit wizard, redirect legacy /deposit and /withdraw to dashboard"
```

---

### Task 12: Testes de integração + checklist manual

**Files:**
- Modify: `apps/api/test/deposit.integration-spec.ts`
- Modify: `apps/api/test/vault.integration-spec.ts` (ou `apps/api/test/prisma.integration-spec.ts`, conforme onde fica o setup de wallet)
- Create: `apps/api/test/wallet.integration-spec.ts`

**Interfaces:**
- Consumes: app Nest completo (DB de teste), endpoints `/deposit/build`, `/wallet/balance`.
- Produces: cobertura e2e de que (a) `/wallet/balance` responde `{ balance, spendable }`; (b) deposit rejeita saldo insuficiente sem `fundClient`.

- [ ] **Step 1: Inspect the existing integration setup**

Run: `cd apps/api && sed -n '1,60p' test/deposit.integration-spec.ts`
Objetivo: descobrir como o teste monta o `AppModule`, autentica (mock do `AuthGuard`/Privy) e mocka a chain (`rpc.Server`). **Espelhar esse setup** nos passos abaixo (os snippets assumem um helper `bootstrapTestApp()`/mock de guard já existente; adaptar aos nomes reais).

- [ ] **Step 2: Write the wallet balance integration test**

Criar `apps/api/test/wallet.integration-spec.ts` espelhando o setup do `deposit.integration-spec.ts`. Núcleo do caso (adaptar boot/guard/mocks reais):

```ts
it('GET /wallet/balance retorna balance e spendable', async () => {
  // Arrange: empresa+wallet registradas; mock do rpc.Server.getLedgerEntries
  // resolvendo um AccountEntry com balance 1200000000 (120 XLM).
  // (usar o mesmo mecanismo de override de provider StellarService/rpc.Server do deposit spec)
  const res = await request(app.getHttpServer())
    .get('/wallet/balance')
    .set('Authorization', 'Bearer test')
    .expect(200);

  expect(res.body).toEqual({ balance: '1200000000', spendable: '1185000000' });
});
```

- [ ] **Step 3: Update the deposit integration test**

Em `apps/api/test/deposit.integration-spec.ts`: remover qualquer expectativa de `fundClient` e adicionar/ajustar um caso de saldo insuficiente:

```ts
it('POST /deposit/build rejeita quando o saldo da carteira é insuficiente', async () => {
  // mock getNativeBalance resolvendo um saldo baixo (ex. reserva + 0.1 XLM)
  await request(app.getHttpServer())
    .post('/deposit/build')
    .set('Authorization', 'Bearer test')
    .send({ amount: '1000000000' }) // 100 XLM
    .expect(400);
});
```

- [ ] **Step 4: Run the integration tests**

Run: `cd apps/api && pnpm vitest run --config vitest.config.e2e.ts test/wallet.integration-spec.ts test/deposit.integration-spec.ts`
Expected: PASS. (Conferir o nome real do script/config e2e — há `apps/api/vitest.config.e2e.ts` no repo.)

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/wallet.integration-spec.ts apps/api/test/deposit.integration-spec.ts
git commit -m "test(api): integration coverage for wallet balance and insufficient-balance deposit"
```

- [ ] **Step 6: Manual smoke (testnet) — checklist**

```
PRÉ: a carteira do cliente precisa de XLM antes (sem fundClient).
   → friendbot na conta G... do cliente, OU um Payment único do sponsor.
1. pnpm db:up && pnpm db:migrate && pnpm dev:app
2. http://localhost:3000 → login Google → dashboard mostra painel "Seu dinheiro".
3. Carteira mostra saldo > 0; Vault ~0 no início.
4. Aportar 10 → confirmar → ver hash → painel refetcha:
   Carteira cai ~10, Vault sobe ~10.
5. Sacar 5 → confirmar → ver hash → Carteira sobe ~5, Vault cai ~5.
6. Conferir on-chain: getVaultBalance(VAULT, clientAddr).underlyingBalance ≈ posição mostrada.
```

> Captura do `G...` do cliente: log no `DepositService.build` ou via Privy.

---

## Self-Review

**Spec coverage:**
- §4.1 getNativeBalance → Task 1 ✓ · getBalance → Task 2 ✓ · GET /wallet/balance + WalletBalanceView → Task 3 ✓ · DepositService.build (remove fundClient + pré-check) → Task 4 ✓ · recordWithdraw + principal floor → Task 5 ✓ · WithdrawService grava ledger → Task 6 ✓ · fundClient mantido-não-chamado → Task 4 (não removido) ✓
- §4.2 api.getWalletBalance → Task 7 ✓ · MoneyPanel → Task 9 ✓ · MoveDrawer → Task 8 ✓ · dashboard wiring → Task 10 ✓ · aposentar wizard / thin pages → Task 11 ✓
- §5 decimais 7 casas / fiat cosmético → Tasks 8–10 usam `formatUsdc`/`toBaseUnits` ✓
- §6 erros (saldo insuficiente, conta 0, getLedgerEntries falha, abandono inerte, saque>posição, reserva) → Task 4 (pré-check), Task 1 (0n), Task 10 (catch→null), Tasks 8/9 (max/disabled) ✓
- §7 testes (unit/front/integração/manual) → Tasks 1–12 ✓
- §9 riscos (fund manual testnet, reserve buffer, parsing SDK, ledger schema, saldo defasado) → Task 12 manual, Task 2 constante, Task 1 teste de parsing, Task 5 (negative entry sem migration), Task 10 refetch ✓

**Placeholder scan:** sem TBD/TODO. Os "conferir setup real" nos Tasks 11/12 são instruções de espelhar padrões existentes (não placeholders de código) — necessários porque os arquivos de integração/Next variam; cada um traz o snippet concreto do núcleo do teste.

**Type consistency:**
- `getNativeBalance(address): Promise<bigint>` — consistente em Tasks 1, 2, 4.
- `getBalance → { balance: string; spendable: string }` — consistente em Tasks 2, 3, 7, 10.
- `WalletBalanceView { balance; spendable }` — Task 3 define, Tasks 7/10 consomem.
- `MoveDrawerProps { mode; maxBaseUnits; apyPercent; onClose; onSuccess }` — Task 8 define, Task 10 consome (mesmos nomes).
- `MoneyPanelProps { walletBalance; spendable; vaultValue; apyPercent; onDeposit; onWithdraw }` — Task 9 define, Task 10 consome.
- `recordWithdraw(companyId, amount, txHash)` — Task 5 define, Task 6 consome.
- `RESERVE_BUFFER_BASE_UNITS = 15_000_000n` — Task 2 define, Task 4 consome.
