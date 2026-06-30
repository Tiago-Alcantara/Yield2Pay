# Spec — Depósito XLM end-to-end (cliente dono, tesouraria abastece)

**Data:** 2026-06-29
**Status:** Aprovado para implementação
**Escopo:** Validar o fluxo de depósito client-facing no site, ponta a ponta, em **testnet**, usando **apenas XLM**, com a posição do vault pertencendo ao cliente.

---

## 1. Objetivo

Um cliente loga no site, vai em `/deposit`, digita um valor e confirma. Por trás, o sistema:

1. Cria/garante a wallet Stellar embedded do cliente (Privy, não-custodial).
2. Abastece essa wallet com XLM puxado da conta do **fee sponsor** (`FEE_SPONSOR_SECRET_KEY`).
3. Deposita esse XLM no vault DeFindex, assinado pela wallet do cliente.
4. As **shares do vault ficam do cliente** — posição real, não-custodial.

UX: parece um depósito real do cliente; o XLM vem de uma conta nossa já fundada (substitui um on-ramp real, que entra depois no mainnet).

**Não-objetivo deste primeiro momento:** USDC/multi-asset, saque, limpeza de UI ($→XLM), on-ramp real, conversão real shares→underlying.

---

## 2. Estado atual (o que já existe)

O fluxo já está construído ponta a ponta. **Não é build do zero — é ligar + adicionar a fonte de dinheiro + validar.**

**Frontend (`apps/web`):**
- `src/app/(app)/deposit/page.tsx` — wizard de 3 passos (valor → tools → confirm); chama `useStellarTx().deposit(baseUnits)`.
- `src/lib/useStellarTx.ts` — orquestra: `ensureWallet` → `build` → `signRawHash` (Privy) → `submit`.
- `src/lib/useWallet.ts` — wallet Stellar embedded do Privy (cria sob demanda via `createWallet({chainType:'stellar'})`), registra no backend.
- `src/lib/api.ts` — REST client (`/deposit/build`, `/deposit/submit`, `/wallet`).
- Login: Google via Privy (`src/app/login/page.tsx`).

**Backend (`apps/api`):**
- `src/deposit/deposit.controller.ts` + `deposit.service.ts` — `build` e `submit`.
- `src/vault/vault.service.ts` — `buildDeposit` via DeFindex SDK (`depositToVault`).
- `src/stellar/stellar.service.ts` — `hashForSigning`, `ensureAccountFunded` (cria conta com 2 XLM via sponsor), `attachAndSubmit` (anexa assinatura do cliente + fee-bump pago pelo sponsor + submit + poll).
- `src/wallet/wallet.service.ts` — registra wallet, funda conta on-chain.
- Auth: Privy bearer token (`src/auth/auth.guard.ts`).

**Vault de teste (já criado, testnet):**
- `VAULT_ADDRESS = CANPO5KXLGZ4UBMNKSJQZK7TBW2BDCQOUE7WO5XZXSM4C4ZIBDJ7O7A7`
- Asset: `native` (XLM). Estratégia: `xlm_blend` (Blend lending). APY ~15%.
- Fees: vaultFee 500bps + defindexFee 2000bps.

**Env (`apps/api/.env`) — já configurado:** `DATABASE_URL`, `PRIVY_APP_ID`/`SECRET`, `DEFINDEX_API_KEY`, `VAULT_ADDRESS`, `FEE_SPONSOR_SECRET_KEY` (conta com bastante XLM), `STELLAR_NETWORK=testnet`, `SOROBAN_RPC_URL`, `PORT=3001`.
**Env (`apps/web/.env.local`):** `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_API_BASE_URL`.

---

## 3. O nó técnico

Privy cria a wallet Stellar **sob demanda no 1º depósito** (não no login). E a build do depósito da DeFindex (`depositToVault`) **simula** o invoke Soroban contra o estado atual da ledger — incluindo o `transfer` de XLM do cliente. **Se a wallet do cliente não tem o XLM, a simulação falha e a build retorna erro.**

**Consequência:** o abastecimento da wallet do cliente precisa acontecer **antes de montar o XDR** (no `build`), não no `submit`.

---

## 4. Arquitetura — Design X (cliente dono, tesouraria abastece)

```
Cliente loga (Google/Privy) → /deposit → digita valor XLM → "Confirm deposit"
   │
   ▼ deposit() [useStellarTx — já existe]
1. ensureWallet()   → Privy cria wallet Stellar do cliente
                      → registerWallet → backend ensureAccountFunded (conta on-chain c/ 2 XLM, sponsor paga)
2. build()          → BACKEND DepositService.build:
                        a. fundClient(clientAddr, amount)  ◄── PASSO NOVO
                           sponsor manda Payment(amount) → wallet do cliente, espera confirmar
                        b. vault.buildDeposit(clientAddr, amount) → XDR (simulação agora passa)
                      → retorna { xdr, hash }
3. signRawHash()    → Privy assina o hash com a chave do cliente
4. submit()         → BACKEND DepositService.submit:
                        attachAndSubmit (assinatura do cliente + fee-bump do sponsor + submit + poll)
                        ledger.recordDeposit
   │
   ▼
Shares do vault ficam DO CLIENTE. Dashboard mostra a posição.
```

**Tesouraria = conta do `FEE_SPONSOR_SECRET_KEY`.** A mesma conta faz três coisas no testnet: cria conta nova (2 XLM), abastece o depósito (`amount`), e paga o fee-bump. Sem friendbot — a conta já está fundada.

---

## 5. Componentes

### 5.1 Novo — `StellarService.fundClient(clientAddress, amountBaseUnits)`

Arquivo: `apps/api/src/stellar/stellar.service.ts`.

Responsabilidade: enviar Payment em XLM nativo de `this.sponsor` → `clientAddress`, no valor **exato** do depósito (`amountBaseUnits`), e esperar confirmação on-chain.

- Reusa `this.sponsor` (já é `Keypair.fromSecret(config.feeSponsorSecretKey)`).
- Monta tx com `Operation.payment({ destination: clientAddress, asset: Asset.native(), amount })`. `amount` em XLM humano (7 casas) — converter de base units.
- Assina com o sponsor, submete via `this.submit(...)` (já existe, faz poll até estado terminal).
- Pré-condição: a conta do cliente já existe on-chain (garantida por `ensureAccountFunded` no register, que roda antes no `ensureWallet`). Se não existir, fazer `createAccount` com `startingBalance = amount`. (Caminho normal: conta já existe → Payment.)

Interface: `fundClient(clientAddress: string, amountBaseUnits: bigint): Promise<void>` — resolve quando o Payment confirma; lança em falha (propaga pro caller).

**Reserva:** o cliente já tem 2 XLM da criação da conta; isso cobre a reserva base após depositar `amount`. Sem buffer adicional. Se algum depósito falhar por reserva insuficiente, adicionar buffer fixo de +1 XLM no Payment.

### 5.2 Alterado — `DepositService.build`

Arquivo: `apps/api/src/deposit/deposit.service.ts`.

```
async build(companyId, amount):
  address = wallet.getAddress(companyId)
  await stellar.fundClient(address, amount)   // PASSO NOVO — antes de montar o XDR
  { xdr } = await vault.buildDeposit(address, amount)
  { hash } = stellar.hashForSigning(xdr)
  return { xdr, hash }
```

Ordem importa: `fundClient` **antes** de `buildDeposit` (simulação precisa do saldo).

### 5.3 Inalterado

Privy, `useStellarTx`, `useWallet`, página `/deposit` (UI fica como está — "$" é cosmético, o número digitado vira XLM com 7 casas via `toBaseUnits`), `attachAndSubmit`, fee-bump, `ledger`, withdraw, schema de env (nenhuma env nova).

---

## 6. Decimais e semântica de valor

- `toBaseUnits("10")` → `"100000000"` (7 casas). XLM usa 7 casas (stroops) → bate.
- Valor digitado na UI = quantidade de XLM. Labels "$"/"USD"/"BRL" são cosméticos neste momento; não afetam a tx.

---

## 7. Funding (testnet)

- Conta sponsor **já fundada** (confirmado). Sem friendbot.
- Uma conta paga tudo: criação de conta, top-up do depósito, fee-bump.
- ⚠️ Testar com valores **pequenos** (ex. 10–100 XLM) pra não drenar o sponsor. A UI permite digitar valores grandes (default 18.400) — no teste, usar valor baixo.

---

## 8. Rodar

```bash
pnpm db:up         # Postgres via docker-compose
pnpm db:migrate    # prisma migrate deploy
pnpm dev:app       # web :3000 + api :3001 em paralelo
```

Passos manuais:
1. Abrir `http://localhost:3000` → login com Google.
2. Ir em `/deposit` → digitar `50` → avançar os passos → "Confirm deposit".
3. Esperar o `TxResultCard` com o hash da transação.

---

## 9. Verificação (critérios de aceite)

O teste é considerado **passado** quando:

1. **UI:** `/deposit` retorna sucesso com hash de tx (sem erro no `TxErrorBox`).
2. **On-chain — posição do cliente:** rodar o script de smoke (`scratchpad/test-vault.cjs`, adaptado pra receber o `G...` do cliente) e confirmar:
   - `getVaultBalance(VAULT, clientAddr)` → `dfTokens > 0` e `underlyingBalance[0] ≈ valor depositado`.
   - Prova que **as shares são do cliente** (não do sponsor).
3. **On-chain — vault:** `getVaultInfo(VAULT).totalManagedFunds` aumentou ~ valor depositado.
4. **Movimento do sponsor:** saldo da conta sponsor caiu ~ valor depositado (+ taxas).
5. **Dashboard:** mostra a posição do cliente (via `getPositionValue`, placeholder = dfTokens — aceitável neste momento).

Capturar o endereço `G...` do cliente: log no `DepositService.build`/`fundClient`, ou via Privy.

---

## 10. Fora de escopo (agora)

- USDC, multi-asset.
- Limpeza de UI ($→XLM, remover passo "Tools" com dados falsos).
- Saque end-to-end.
- On-ramp real (a tesouraria→on-ramp vem no mainnet).
- `getPositionValue` shares→underlying real (fica placeholder; pinado depois pelo `apps/api/test/vault.integration-spec.ts`).

---

## 11. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| DeFindex simula footprint exigindo saldo > valor enviado | Adicionar buffer fixo (+1 XLM) no `fundClient`. |
| Top-up move dinheiro no `build`, antes de assinar — se o cliente abandonar, XLM fica parado na wallet dele | Inócuo no testnet; valor pequeno; pode ser reaproveitado no próximo depósito. |
| Conta sponsor sem XLM suficiente | Testar com valores pequenos; checar saldo do sponsor antes. |
| Wallet do cliente sem trustline | XLM é nativo — sem trustline. Shares do vault são token Soroban (storage do contrato) — sem trustline. OK. |
| Postgres não sobe / migration desatualizada | `pnpm db:up` + `pnpm db:migrate` antes de subir a API. |

---

## 12. Segurança

- `FEE_SPONSOR_SECRET_KEY` permanece **server-side** (env do backend); nunca exposto ao frontend.
- Fluxo não-custodial preservado: a chave do cliente é responsabilidade do Privy; o backend nunca a toca.
- `DepositService.submit` já valida que `dto.stellarAddress` bate com a wallet registrada da empresa (anti-spoof).
