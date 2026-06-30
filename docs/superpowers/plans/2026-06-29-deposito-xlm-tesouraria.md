# Depósito XLM (cliente dono, tesouraria abastece) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o depósito XLM funcionar ponta a ponta no site (testnet): o cliente "deposita", a conta do fee sponsor abastece a wallet embedded dele com o valor exato, e ele deposita no vault DeFindex — ficando dono das shares.

**Architecture:** O fluxo de depósito já existe (Privy → build → sign → submit). A única peça nova no código é a **fonte de dinheiro**: um método `StellarService.fundClient` que envia um Payment nativo do sponsor → wallet do cliente, chamado no `DepositService.build` **antes** de montar o XDR (a build da DeFindex simula o invoke Soroban e precisa do saldo já presente). Sem friendbot, sem env nova — reusa `this.sponsor` (`FEE_SPONSOR_SECRET_KEY`).

**Tech Stack:** NestJS (apps/api), `@stellar/stellar-sdk`, DeFindex SDK, Vitest, pnpm workspace. Frontend Next.js + Privy (inalterado).

## Global Constraints

- Rede: **testnet** (`STELLAR_NETWORK=testnet`). Não rodar nada contra mainnet.
- Decimais XLM = **7** (stroops). `toBaseUnits("10")` = `100000000`.
- **Não** adicionar variável de ambiente nova. Reusar `FEE_SPONSOR_SECRET_KEY` via `this.sponsor`.
- **Não** alterar o frontend, o fluxo Privy, `attachAndSubmit`, fee-bump, ledger nem o withdraw.
- Posição do vault pertence ao **cliente** (a wallet do cliente é o `caller`/signer do depósito).
- Testar com valores **pequenos** (10–100 XLM) pra não drenar o sponsor.
- **Commits:** regra do projeto = só commitar quando o usuário autorizar, agrupando trabalho relacionado. Os passos `git commit` abaixo são o ponto de corte de cada task; execute-os apenas com autorização (pode agrupar várias tasks num commit).
- Rodar testes da API: `pnpm --filter @yield2pay/api exec vitest run <caminho>`.

---

## File Structure

- **Criar** `apps/api/src/common/format-amount.ts` — helper `toStellarAmount(baseUnits)`: base units (7 casas) → string decimal de XLM pro `Operation.payment`.
- **Criar** `apps/api/src/common/format-amount.spec.ts` — testes do helper.
- **Modificar** `apps/api/src/stellar/stellar.service.ts` — novo método `fundClient`; importar `Asset`.
- **Modificar** `apps/api/src/stellar/stellar.service.spec.ts` — teste do `fundClient`.
- **Modificar** `apps/api/src/deposit/deposit.service.ts` — `build` chama `fundClient` antes de `buildDeposit`.
- **Modificar** `apps/api/src/deposit/deposit.service.spec.ts` — atualizar o teste de `build`.
- **Criar** `apps/api/scripts/check-vault-balance.cjs` — script de verificação on-chain (saldo do cliente no vault).

---

### Task 1: Helper `toStellarAmount` (base units → string decimal de XLM)

**Files:**
- Create: `apps/api/src/common/format-amount.ts`
- Test: `apps/api/src/common/format-amount.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `toStellarAmount(baseUnits: bigint): string` — converte base units de 7 casas numa string decimal aceita por `Operation.payment` (ex.: `100000000n` → `"10"`, `105000000n` → `"10.5"`, `1n` → `"0.0000001"`). Sem trailing zeros; sem sinal (só valores positivos).

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/api/src/common/format-amount.spec.ts`:

```ts
import { toStellarAmount } from './format-amount';

it('converte valor inteiro de XLM sem casas decimais', () => {
  expect(toStellarAmount(100000000n)).toBe('10'); // 10 XLM
});

it('converte valor com fração', () => {
  expect(toStellarAmount(105000000n)).toBe('10.5'); // 10.5 XLM
});

it('converte o menor stroop', () => {
  expect(toStellarAmount(1n)).toBe('0.0000001');
});

it('remove zeros à direita da fração', () => {
  expect(toStellarAmount(100500000n)).toBe('10.05'); // 10.05 XLM
});

it('converte valor sub-unitário', () => {
  expect(toStellarAmount(5000000n)).toBe('0.5'); // 0.5 XLM
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @yield2pay/api exec vitest run src/common/format-amount.spec.ts`
Expected: FAIL — `Failed to resolve import "./format-amount"` (arquivo ainda não existe).

- [ ] **Step 3: Implementar o helper**

Criar `apps/api/src/common/format-amount.ts`:

```ts
const DECIMALS = 7n;
const DIVISOR = 10n ** DECIMALS;

/**
 * Converte um valor em base units (stroops, 7 casas) para a string decimal de XLM
 * esperada por `Operation.payment` do @stellar/stellar-sdk.
 *
 * Ex.: 100000000n -> "10", 105000000n -> "10.5", 1n -> "0.0000001".
 * Aceita apenas valores positivos (depósitos).
 */
export function toStellarAmount(baseUnits: bigint): string {
  const whole = baseUnits / DIVISOR;
  const frac = baseUnits % DIVISOR;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(7, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @yield2pay/api exec vitest run src/common/format-amount.spec.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit** (apenas com autorização — ver Global Constraints)

```bash
git add apps/api/src/common/format-amount.ts apps/api/src/common/format-amount.spec.ts
git commit -m "feat(api): add toStellarAmount base-units→XLM helper"
```

---

### Task 2: `StellarService.fundClient` (sponsor → cliente)

**Files:**
- Modify: `apps/api/src/stellar/stellar.service.ts`
- Test: `apps/api/src/stellar/stellar.service.spec.ts`

**Interfaces:**
- Consumes: `toStellarAmount(baseUnits: bigint): string` (Task 1); `this.sponsor`, `this.server`, `this.passphrase`, `this.submit(...)` (já existentes na classe).
- Produces: `fundClient(clientAddress: string, amountBaseUnits: bigint): Promise<void>` — envia Payment nativo de `amountBaseUnits` do sponsor → `clientAddress`, assina com o sponsor, submete e espera confirmação (`this.submit`). Lança em falha.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `apps/api/src/stellar/stellar.service.spec.ts` (os imports `Account`, `Operation`, `Asset`, `Keypair`, `rpc` já existem no arquivo):

```ts
// ── fundClient (sponsor → cliente) ────────────────────────────────────────────

it('fundClient envia um payment nativo do sponsor para o cliente e espera confirmar', async () => {
  const server = {
    getAccount: vi.fn().mockResolvedValue(new Account(SPONSOR_KP.publicKey(), '10')),
    sendTransaction: vi.fn().mockResolvedValue({ status: 'PENDING', hash: 'pay1' }),
    pollTransaction: vi.fn().mockResolvedValue({ status: rpc.Api.GetTransactionStatus.SUCCESS }),
  } as unknown as rpc.Server;

  const client = Keypair.random().publicKey();
  await new StellarService(cfg, server).fundClient(client, 100000000n); // 10 XLM

  expect(server.getAccount).toHaveBeenCalledWith(SPONSOR_KP.publicKey());
  expect(server.sendTransaction).toHaveBeenCalledTimes(1);

  const submitted = (server.sendTransaction as any).mock.calls[0][0];
  // Tx simples (não fee-bump) com um único payment nativo pro cliente.
  expect(submitted.toEnvelope().switch().name).toBe('envelopeTypeTx');
  const op = submitted.operations[0];
  expect(op.type).toBe('payment');
  expect(op.destination).toBe(client);
  expect(op.asset.isNative()).toBe(true);
  expect(Number(op.amount)).toBe(10);
});

it('fundClient lança quando o payment não confirma', async () => {
  const server = {
    getAccount: vi.fn().mockResolvedValue(new Account(SPONSOR_KP.publicKey(), '10')),
    sendTransaction: vi.fn().mockResolvedValue({ status: 'PENDING', hash: 'pay2' }),
    pollTransaction: vi.fn().mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.FAILED,
      resultXdr: { result: () => ({ switch: () => ({ name: 'txFailed' }) }) },
    }),
  } as unknown as rpc.Server;

  await expect(
    new StellarService(cfg, server).fundClient(Keypair.random().publicKey(), 100000000n),
  ).rejects.toThrow('failed on-chain');
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @yield2pay/api exec vitest run src/stellar/stellar.service.spec.ts`
Expected: FAIL — `fundClient is not a function` (método ainda não existe).

- [ ] **Step 3: Implementar `fundClient`**

Em `apps/api/src/stellar/stellar.service.ts`, adicionar `Asset` à lista de imports do `@stellar/stellar-sdk`:

```ts
import {
  TransactionBuilder,
  Transaction,
  FeeBumpTransaction,
  Keypair,
  Networks,
  Operation,
  Asset,
  xdr as StellarXdr,
  rpc,
  BASE_FEE,
} from '@stellar/stellar-sdk';
```

Adicionar o import do helper no topo (junto dos outros imports locais):

```ts
import { toStellarAmount } from '../common/format-amount';
```

Adicionar o método dentro da classe `StellarService`, logo após `ensureAccountFunded`:

```ts
  /**
   * Sends `amountBaseUnits` of native XLM from the sponsor (treasury) to the
   * client wallet, so the client can fund the vault deposit. Waits for
   * confirmation. Used to simulate the client funding their own deposit on
   * testnet — replaced by a real on-ramp on mainnet.
   */
  async fundClient(clientAddress: string, amountBaseUnits: bigint): Promise<void> {
    const source = await this.server.getAccount(this.sponsor.publicKey());
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.passphrase,
    })
      .addOperation(
        Operation.payment({
          destination: clientAddress,
          asset: Asset.native(),
          amount: toStellarAmount(amountBaseUnits),
        }),
      )
      .setTimeout(30)
      .build();
    tx.sign(this.sponsor);
    await this.submit(tx);
  }
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @yield2pay/api exec vitest run src/stellar/stellar.service.spec.ts`
Expected: PASS (todos os testes do arquivo, incluindo os 2 novos).

- [ ] **Step 5: Commit** (apenas com autorização)

```bash
git add apps/api/src/stellar/stellar.service.ts apps/api/src/stellar/stellar.service.spec.ts
git commit -m "feat(api): add StellarService.fundClient (sponsor funds client deposit)"
```

---

### Task 3: `DepositService.build` abastece o cliente antes de montar o XDR

**Files:**
- Modify: `apps/api/src/deposit/deposit.service.ts:18-23`
- Test: `apps/api/src/deposit/deposit.service.spec.ts:4-20`

**Interfaces:**
- Consumes: `stellar.fundClient(clientAddress, amountBaseUnits)` (Task 2); `wallet.getAddress`, `vault.buildDeposit`, `stellar.hashForSigning` (já existentes).
- Produces: nenhuma interface nova — comportamento de `build` atualizado (funda antes de montar o XDR).

- [ ] **Step 1: Atualizar o teste para exigir o `fundClient` antes do `buildDeposit`**

Substituir o teste `build:` (linhas 4-20) em `apps/api/src/deposit/deposit.service.spec.ts` por:

```ts
it('build: funda o cliente, monta o xdr do vault e retorna o hash', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const vault = { buildDeposit: vi.fn().mockResolvedValue({ xdr: 'XDR1' }) };
  const stellar = {
    fundClient: vi.fn().mockResolvedValue(undefined),
    hashForSigning: vi.fn().mockReturnValue({ hash: '0xabc' }),
  };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService(
    vault as any,
    stellar as any,
    ledger as any,
    wallet as any,
  );
  const r = await svc.build('co_1', 1000000n);

  expect(stellar.fundClient).toHaveBeenCalledWith('GADDR', 1000000n);
  expect(vault.buildDeposit).toHaveBeenCalledWith('GADDR', 1000000n);
  // funda ANTES de montar o XDR (a build da DeFindex simula e precisa do saldo).
  expect(stellar.fundClient.mock.invocationCallOrder[0]).toBeLessThan(
    vault.buildDeposit.mock.invocationCallOrder[0],
  );
  expect(r).toEqual({ xdr: 'XDR1', hash: '0xabc' });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @yield2pay/api exec vitest run src/deposit/deposit.service.spec.ts`
Expected: FAIL — `stellar.fundClient is not a function` (o `build` ainda não chama `fundClient`).

- [ ] **Step 3: Implementar a chamada no `build`**

Em `apps/api/src/deposit/deposit.service.ts`, substituir o método `build` (linhas 18-23) por:

```ts
  async build(companyId: string, amount: bigint): Promise<BuildTxResponse> {
    const address = await this.wallet.getAddress(companyId);
    // Abastece a wallet do cliente com o valor do depósito (sponsor → cliente)
    // ANTES de montar o XDR: a build da DeFindex simula o invoke Soroban e
    // exige que o saldo já esteja na conta do cliente.
    await this.stellar.fundClient(address, amount);
    const { xdr } = await this.vault.buildDeposit(address, amount);
    const { hash } = this.stellar.hashForSigning(xdr);
    return { xdr, hash };
  }
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @yield2pay/api exec vitest run src/deposit/deposit.service.spec.ts`
Expected: PASS (3 testes do arquivo).

- [ ] **Step 5: Rodar a suíte inteira da API pra garantir que nada quebrou**

Run: `pnpm --filter @yield2pay/api test`
Expected: PASS (toda a suíte unitária).

- [ ] **Step 6: Commit** (apenas com autorização)

```bash
git add apps/api/src/deposit/deposit.service.ts apps/api/src/deposit/deposit.service.spec.ts
git commit -m "feat(api): fund client wallet before building vault deposit"
```

---

### Task 4: Script de verificação on-chain (saldo do cliente no vault)

**Files:**
- Create: `apps/api/scripts/check-vault-balance.cjs`

**Interfaces:**
- Consumes: `@defindex/sdk`, `apps/api/.env` (`VAULT_ADDRESS`, `DEFINDEX_API_KEY`, `DEFINDEX_BASE_URL`).
- Produces: CLI `node apps/api/scripts/check-vault-balance.cjs <Gclient>` — imprime `getVaultInfo` (totalManagedFunds) e `getVaultBalance` do cliente passado. Usado pra provar que as shares são do cliente.

- [ ] **Step 1: Criar o script**

Criar `apps/api/scripts/check-vault-balance.cjs`:

```js
/* Verificação on-chain: saldo do cliente no vault DeFindex (testnet). */
const fs = require('fs');
const path = require('path');
const { DefindexSDK, SupportedNetworks } = require('@defindex/sdk');

const clientAddr = process.argv[2];
if (!clientAddr || !clientAddr.startsWith('G')) {
  console.error('uso: node apps/api/scripts/check-vault-balance.cjs <Gclient>');
  process.exit(1);
}

// carrega apps/api/.env
const envPath = path.join(__dirname, '..', '.env');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}

const VAULT = env.VAULT_ADDRESS;
const NET = SupportedNetworks.TESTNET;

(async () => {
  const sdk = new DefindexSDK({
    apiKey: env.DEFINDEX_API_KEY,
    baseUrl: env.DEFINDEX_BASE_URL || 'https://api.defindex.io',
  });

  console.log('vault :', VAULT);
  console.log('client:', clientAddr, '\n');

  const info = await sdk.getVaultInfo(VAULT, NET);
  console.log('totalManagedFunds:', JSON.stringify(info.totalManagedFunds));

  const bal = await sdk.getVaultBalance(VAULT, clientAddr, NET);
  console.log('\n=== posição do cliente ===');
  console.log('dfTokens         :', bal.dfTokens);
  console.log('underlyingBalance:', JSON.stringify(bal.underlyingBalance));

  if (bal.dfTokens > 0) {
    console.log('\n✅ cliente é dono de uma posição no vault');
  } else {
    console.log('\n❌ cliente sem posição (dfTokens = 0)');
  }
})().catch((e) => {
  console.error('erro:', e?.message || e);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke-run do script (sem depósito ainda — deve mostrar 0)**

Run (usar o `PUBLIC_KEY` do `.env` como endereço qualquer):
`node apps/api/scripts/check-vault-balance.cjs GAOAECYJZVCWG65EJPYWMZSDMPQYX5KSWIRYHXRO72473ZEKHHIMPBRI`
Expected: imprime `totalManagedFunds`, e a posição desse endereço (provavelmente `dfTokens: 0`). Confirma que o script roda e fala com a API DeFindex.

- [ ] **Step 3: Commit** (apenas com autorização)

```bash
git add apps/api/scripts/check-vault-balance.cjs
git commit -m "chore(api): add vault balance verification script"
```

---

### Task 5: Validação end-to-end manual (runbook)

**Files:** nenhum (validação manual). Esta task não tem teste automatizado — o spec define a validação como manual.

**Interfaces:**
- Consumes: tudo acima + as duas apps rodando.
- Produces: confirmação dos critérios de aceite do spec (seção 9).

- [ ] **Step 1: Subir o Postgres e migrar**

```bash
pnpm db:up
pnpm db:migrate
```
Expected: container `db` de pé; migrations aplicadas sem erro.

- [ ] **Step 2: Subir as duas apps**

```bash
pnpm dev:app
```
Expected: API em `http://localhost:3001`, web em `http://localhost:3000`, sem erro de boot. (O boot da API valida o env via Zod — se faltar algo, ele falha aqui.)

- [ ] **Step 3: Logar como cliente**

- Abrir `http://localhost:3000` → ir pro login → "Continue with Google" → completar OAuth.
- Expected: redireciona pra `/dashboard`.

- [ ] **Step 4: Depositar um valor pequeno**

- Ir em `/deposit` → digitar `50` → avançar os passos → "Confirm deposit".
- Expected: aparece o `TxResultCard` com "Deposit confirmed!" e um hash de transação. Sem `TxErrorBox`.
- Capturar o endereço `G...` do cliente: ver o log do backend no `DepositService.build`/`fundClient` (o endereço é o `address`/`clientAddress`), ou inspecionar a wallet no Privy.

> Se falhar com erro de simulação/saldo no `build`: aumentar o valor enviado em `fundClient` somando um buffer fixo de 1 XLM — em `apps/api/src/deposit/deposit.service.ts`, trocar a chamada por `await this.stellar.fundClient(address, amount + 10000000n);` (10000000n = 1 XLM). Re-testar.

- [ ] **Step 5: Verificar a posição on-chain do cliente**

```bash
node apps/api/scripts/check-vault-balance.cjs <Gclient-do-step-4>
```
Expected (critérios de aceite):
- `dfTokens > 0` e `underlyingBalance[0] ≈ 50 XLM` (≈ `500000000` em base units) → **cliente é dono da posição** ✅
- `totalManagedFunds` maior do que antes do depósito (subiu ~50 XLM).

- [ ] **Step 6: Conferir o dashboard**

- Voltar pro `/dashboard` no navegador.
- Expected: a posição do cliente aparece (via `getPositionValue`, placeholder = dfTokens — valor não é o underlying real, é esperado neste momento).

- [ ] **Step 7: Registrar o resultado**

- Anotar no spec/PR: hash da tx, endereço do cliente, `dfTokens` resultante. Validação concluída.

---

## Self-Review

**1. Cobertura do spec:**
- §4 fluxo (cliente dono, tesouraria abastece) → Tasks 2+3 (fundClient + chamada no build). ✅
- §5.1 `fundClient` → Task 2. ✅
- §5.2 `build` chama fundClient antes do buildDeposit → Task 3. ✅
- §5.3 nada de env nova, reuso do sponsor → Global Constraints + Task 2 (usa `this.sponsor`). ✅
- §6 decimais 7 → Task 1 (helper) + Global Constraints. ✅
- §7 sem friendbot, valores pequenos → Global Constraints + Task 5. ✅
- §8 rodar → Task 5 steps 1-2. ✅
- §9 critérios de aceite → Task 5 steps 4-6 + Task 4 (script). ✅
- §11 risco de simulação exigir saldo > enviado → Task 5 step 4 (nota de buffer +1 XLM). ✅
- §12 segurança (secret server-side, não-custodial, anti-spoof) → preservado (frontend/`submit` inalterados; Global Constraints). ✅

**2. Placeholder scan:** Sem TBD/TODO/"add error handling" genérico. Todo código está completo. Task 5 é manual por design (o spec define validação manual), com passos e expected concretos. ✅

**3. Consistência de tipos:** `toStellarAmount(baseUnits: bigint): string` definido na Task 1 e usado na Task 2 com o mesmo nome/assinatura. `fundClient(clientAddress: string, amountBaseUnits: bigint): Promise<void>` definido na Task 2 e chamado na Task 3 como `stellar.fundClient(address, amount)` (address: string, amount: bigint). ✅
