# Spec — Carteira ↔ Vault (aporte e saque, modelo real)

**Data:** 2026-06-29
**Status:** Aprovado para implementação
**Escopo:** Mover XLM que o cliente **já tem na carteira** para o vault DeFindex (render) e sacar do vault de volta pra carteira, com UX unificada no dashboard. Modelo real (mainnet): a carteira é a fonte do dinheiro; o sponsor só paga taxa de rede (gasless), nunca o valor.

---

## 1. Objetivo

No dashboard, o cliente vê um painel "Seu dinheiro" com dois lados:

- **Carteira** — saldo XLM nativo parado (não rende).
- **Vault** — posição rendendo (~15% APY).

Botões **Aportar** (carteira→vault) e **Sacar** (vault→carteira) abrem um drawer inline com valor, botão `[max]`, preview de rendimento e confirmar. A transação usa o fluxo de assinatura/submit que já existe.

**Modelo de dinheiro:** real. O deposit move **só** carteira→vault — sem top-up do sponsor (`fundClient` deixa de ser chamado). O sponsor continua pagando o fee-bump (rede gasless).

**Unidade:** fiat cosmético — mantém os labels `$`/`R$` do dashboard atual; o valor por trás é XLM 1:1 (7 casas). Sem conversão de cotação.

**Não-objetivo agora:** USDC/multi-asset, on-ramp real (como a carteira recebe fundos em mainnet), conversão de cotação XLM→fiat, histórico de movimentações dedicado.

---

## 2. Estado atual (o que já existe)

A plumbing de transação já está ligada ponta a ponta. **Não é build do zero.**

**Backend (`apps/api`):**
- `deposit/deposit.service.ts` — `build` (hoje chama `stellar.fundClient` antes do `vault.buildDeposit`) + `submit` (grava `ledger.recordDeposit`).
- `withdraw/withdraw.service.ts` — `build` (`vault.buildWithdraw`) + `submit`. **Não** grava no ledger.
- `vault/vault.service.ts` — `buildDeposit`, `buildWithdraw`, `getApyPercent`, `getPositionValue` via DeFindex SDK.
- `stellar/stellar.service.ts` — usa **Soroban RPC** (`rpc.Server`); tem `hashForSigning`, `ensureAccountFunded`, `fundClient`, `attachAndSubmit` (fee-bump pago pelo sponsor), `exists`, `submit`. `getAccount` do RPC **não** traz saldo.
- `wallet/wallet.service.ts` + `wallet.controller.ts` — `register` (`POST /wallet`), `getAddress`. Sem leitura de saldo.

**Frontend (`apps/web`):**
- `lib/useStellarTx.ts` — `deposit` e `withdraw` compartilham `runStellarTx` (ensureWallet → build → signRawHash Privy → submit). **Intacto.**
- `lib/api.ts` — REST client (`buildDeposit/submitDeposit`, `buildWithdraw/submitWithdraw`, `/wallet`).
- `lib/money.ts` — `formatUsdc` (base units 7dp → "x.xx"), `toBaseUnits`.
- `app/(app)/dashboard/page.tsx` — painéis de stat (vaultValue/returns/spendable/APY) + bills + nav com `deposit`→`/deposit`, `withdraw`→`/withdraw`.
- `app/(app)/deposit/page.tsx` — wizard de 3 passos (com passo "Tools" falso).
- `app/(app)/withdraw/page.tsx` — form simples de um input.

**Componentes UI reutilizáveis:** `MetalCard`, `Button`, `Input`, `Badge`, `BrandHeader`, `TxResultCard`, `TxErrorBox`.

---

## 3. Abordagem — Camada aditiva fina

Reusa toda a plumbing de tx. Concentra mudança em 3 pontos: (a) ler saldo da carteira, (b) tirar `fundClient` do deposit + pré-check de saldo, (c) UI nova (painel + drawer).

```
DASHBOARD ── painel "Seu dinheiro" ──────────────────────
  CARTEIRA (parada)            VAULT (rendendo)
  GET /wallet/balance          GET /dashboard (existe)
  [Aportar →]                  [← Sacar]   APY
        │ click                      │ click
        ▼                            ▼
   MoveDrawer(mode=deposit)     MoveDrawer(mode=withdraw)
   valor + [max] + preview      valor + [max] + preview
        │ useStellarTx.deposit       │ useStellarTx.withdraw
        ▼                            ▼
   build → signRawHash(Privy) → submit → fee-bump sponsor
        │
        ▼ sucesso → refetch(/wallet/balance, /dashboard)
```

---

## 4. Componentes

### 4.1 Backend

#### `StellarService.getNativeBalance(address): Promise<bigint>` — **novo**
Arquivo: `apps/api/src/stellar/stellar.service.ts`.

Lê o saldo XLM nativo via Soroban RPC (não há Horizon configurado):
- Monta `xdr.LedgerKey.account(new xdr.LedgerKeyAccount({ accountId: Keypair.fromPublicKey(address).xdrAccountId() }))`.
- `this.server.getLedgerEntries(key)`; se vazio (conta inexistente) → `0n`.
- Senão parseia `entry.val.account().balance()` (Int64 stroops) → `bigint`. XLM = 7 casas → bate com base units do app.

Interface: `getNativeBalance(address: string): Promise<bigint>` — stroops; `0n` se a conta não existe on-chain. Lança em falha de RPC (caller decide).

#### `WalletService.getBalance(companyId): Promise<{ balance: string; spendable: string }>` — **novo**
Arquivo: `apps/api/src/wallet/wallet.service.ts`.

- `getAddress(companyId)` → `stellar.getNativeBalance(addr)` = `balance`.
- `spendable = max(0, balance − RESERVE_BUFFER)`. `RESERVE_BUFFER` = constante (≈ 1.5 XLM = `15_000_000` stroops) cobrindo a reserva mínima da conta. Path do vault XLM nativo não cria subentries/trustline → reserva fica no mínimo.
- Retorna ambos como string de base units (consistente com o resto da API).

#### `GET /wallet/balance` — **novo**
Arquivo: `apps/api/src/wallet/wallet.controller.ts`. Sob `AuthGuard`; chama `walletService.getBalance(req.companyId)`.

#### `DepositService.build` — **alterado**
Arquivo: `apps/api/src/deposit/deposit.service.ts`.

```
async build(companyId, amount):
  address = wallet.getAddress(companyId)
  balance = stellar.getNativeBalance(address)          // PRÉ-CHECK (reusa address)
  spendable = max(0, balance − RESERVE_BUFFER)
  if amount > spendable:
    throw BadRequestException('saldo insuficiente na carteira')
  // REMOVIDO: stellar.fundClient(address, amount)
  { xdr } = vault.buildDeposit(address, amount)
  { hash } = stellar.hashForSigning(xdr)
  return { xdr, hash }
```

`RESERVE_BUFFER` é a mesma constante usada em `WalletService.getBalance` (extrair pra um lugar compartilhado, ex. `common/`, pra `[max]` do front e o pré-check do back baterem). Mantém o cap `MAX_DEPOSIT_BASE_UNITS` como guarda extra. `submit` inalterado (grava `ledger.recordDeposit`).

#### `WithdrawService.submit` — **alterado (paridade de ledger)**
Arquivo: `apps/api/src/withdraw/withdraw.service.ts`.

Adiciona `ledger.recordWithdraw(companyId, amount, txHash)` após `attachAndSubmit`, para `principal`/`spendable` (derivados do ledger) não driftarem após saque. Requer injetar `LedgerService` no `WithdrawService` e confirmar/estender o método no `LedgerService` (verificar schema na implementação; se não houver `recordWithdraw`, adicionar simétrico a `recordDeposit`). `vaultValue` do dashboard já se auto-corrige (vem do on-chain `getPositionValue`).

#### `StellarService.fundClient` — **mantido, não chamado**
Não removido (não quebra `ensureAccountFunded` nem testes de stellar). Apenas deixa de ser chamado no deposit.

### 4.2 Frontend

#### `api.getWalletBalance()` — **novo**
Arquivo: `apps/web/src/lib/api.ts`. `GET /wallet/balance` → `{ balance: string; spendable: string }`. Tipo compartilhado em `@yield2pay/shared` (ex.: `WalletBalanceView`).

#### `MoneyPanel` — **novo**
Card "Seu dinheiro" no dashboard. Dois lados:
- **Carteira:** `formatUsdc(walletBalance.balance)`, label "sem render".
- **Vault:** `formatUsdc(dash.vaultValue)`, badge APY `dash.apyPercent`.
- Botões **Aportar** / **Sacar** → abrem `MoveDrawer` no modo certo.
- Estado de saldo indisponível: mostra "—" e desabilita Aportar (não trava o resto).

#### `MoveDrawer` — **novo, compartilhado**
Props: `mode: 'deposit' | 'withdraw'`, `max: string` (base units), `apyPercent: string`, `onClose`, `onSuccess`.
- Input de valor (reusa `Input`, prefixo `$`), botão `[max]` (preenche com `max` formatado).
- Validação reusa `validateAmount` + checa `valor ≤ max`.
- Preview de rendimento: `valorBaseUnits × (apyPercent/100) / 12` → "+ $X/mês" (só informativo).
- Confirmar → `useStellarTx()[mode](toBaseUnits(valor))`. Sucesso → `TxResultCard` + `onSuccess()` (dashboard refetcha balance+dashboard). Erro → `TxErrorBox`.
- `max` por modo: deposit = `walletBalance.spendable`; withdraw = posição do vault (`dash.vaultValue`).

#### Dashboard `page.tsx` — **alterado**
- `fetchData` passa a fazer `Promise.all([getDashboard(), getWalletBalance(), listBills()])`.
- Renderiza `MoneyPanel` (pode substituir/co-existir com o CTA de depósito atual).
- Nav `deposit`/`withdraw` abrem o `MoveDrawer` no modo certo em vez de `router.push`.

#### `/deposit` e `/withdraw` — **aposentados/thin**
Wizard de 3 passos do `/deposit` sai. As rotas viram thin: renderizam o `MoveDrawer` em página cheia ou redirecionam pro dashboard. (Decisão final de redirect vs render na implementação; não manter o passo "Tools" falso.)

---

## 5. Decimais e unidade

- Ativo on-chain = XLM nativo, 7 casas (stroops) = base units do app. `toBaseUnits`/`formatUsdc`/`getNativeBalance` todos em 7 casas → batem.
- Labels `$`/`R$` são cosméticos; valor digitado = quantidade de XLM 1:1. Sem cotação.

---

## 6. Erros e bordas

| Caso | Tratamento |
|---|---|
| Valor > saldo carteira | Front: `[max]`=spendable + validação bloqueia. Back: pré-check → `BadRequest('saldo insuficiente na carteira')` → `TxErrorBox`. |
| Carteira sem conta / saldo 0 | `getNativeBalance` → `0n`; `spendable`=0; Aportar desabilitado, msg "sem saldo". |
| `getLedgerEntries` falha | Endpoint propaga erro; painel mostra saldo "—" e desabilita `[max]`/Aportar; o build no backend re-valida (gate real). Não trava a tela inteira. |
| Abandono no meio do fluxo | **Inerte** — sem `fundClient`, nenhum dinheiro se move antes da assinatura. |
| Saque > posição | Front: `[max]`=posição bloqueia. Back: simulação DeFindex falha → erro on-chain via `attachAndSubmit` → `TxErrorBox`. |
| Slippage | `DEFAULT_SLIPPAGE_BPS=50` (já em `vault.service`). Sem mudança. |
| Reserva mínima | `spendable` subtrai `RESERVE_BUFFER` (~1.5 XLM); impede zerar a conta abaixo do mínimo. |

---

## 7. Testes (TDD — escrever teste antes da implementação)

**Backend (unit):**
- `StellarService.getNativeBalance` — mock `rpc.Server.getLedgerEntries`: (a) entry com balance → stroops corretos; (b) sem entry → `0n`.
- `WalletService.getBalance` — `spendable = balance − RESERVE_BUFFER`, clamp em 0.
- `DepositService.build` — (a) rejeita `valor > spendable` com `BadRequest`; (b) **não** chama `fundClient` (atualizar `deposit.service.spec.ts`); (c) chama `vault.buildDeposit` no caminho feliz.
- `WithdrawService.submit` — chama `ledger.recordWithdraw` após submit.

**Frontend:**
- `MoveDrawer` — `[max]` preenche `spendable`/posição; preview de rendimento calcula certo; mode `deposit`/`withdraw` chama a fn correta de `useStellarTx`; erro renderiza `TxErrorBox`; sucesso chama `onSuccess`.
- `MoneyPanel` — render dos dois lados; estado de saldo indisponível. Atualizar `dashboard.test.tsx`.

**Integração (`apps/api/test`):**
- `deposit.integration-spec` — deposit sem `fundClient`; rejeição por saldo insuficiente.
- `/wallet/balance` — retorna `{ balance, spendable }`.
- `withdraw.integration-spec` — saque grava no ledger.

**Manual (testnet):**
- ⚠️ Sem `fundClient`, a carteira do cliente **precisa de XLM antes**: friendbot ou um Payment único do sponsor.
- Aportar valor pequeno (ex. 10 XLM) → posição do vault sobe ~valor → saldo da carteira cai ~valor → Sacar → volta pra carteira.

---

## 8. Fora de escopo (agora)

- On-ramp real (como a carteira recebe fundos em mainnet).
- Conversão de cotação XLM→BRL/USD (mantém fiat cosmético 1:1).
- USDC / multi-asset.
- Histórico/extrato de movimentações dedicado.
- MCP da DeFindex (não conectado nesta sessão; SDK `@defindex/sdk` já integrado; docs via context7 se necessário).

---

## 9. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Carteira sem fundos em testnet (sem `fundClient`) | Fund manual único (friendbot/sponsor) antes de testar. Documentado no passo manual. |
| `RESERVE_BUFFER` errado → aporte falha por reserva | Buffer ≈1.5 XLM cobre a reserva base; ajustar se a simulação DeFindex exigir mais. |
| `getLedgerEntries` parsing do `AccountEntry` quebra entre versões do SDK | Pinar uso à API atual do `@stellar/stellar-sdk` do repo; cobrir com unit test e mock fiel. |
| `ledger.recordWithdraw` ausente no schema | Verificar `LedgerService` na implementação; adicionar simétrico a `recordDeposit` se faltar. |
| Saldo lido (RPC) defasado vs estado pós-tx | Refetch após sucesso; backend re-valida no build (gate real, não confia no front). |

---

## 10. Segurança

- `FEE_SPONSOR_SECRET_KEY` permanece server-side; nunca exposto ao front. Sponsor paga só fee-bump, nunca o valor do aporte.
- Não-custodial preservado: a chave do cliente é responsabilidade do Privy; o backend nunca a toca.
- `submit` (deposit e withdraw) valida que `dto.stellarAddress` bate com a wallet registrada da empresa (anti-spoof) — manter.
- Pré-check de saldo no backend é o gate real; o `[max]` do front é só UX.
