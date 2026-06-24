# FixEarn — Design do MVP (Ciclo 1)

**Data:** 2026-06-24
**Status:** Aprovado para escrever plano de implementação

---

## 1. Produto

FixEarn é uma fintech B2B. A empresa faz **um depósito de capital**, a FixEarn coloca esse
capital para render, e o **rendimento paga as assinaturas de software** da empresa (ferramentas
de IA e SaaS). A empresa nunca gasta o próprio caixa nessas ferramentas — só o rendimento
trabalha. O capital continua sendo da empresa, sacável a qualquer momento.

**As três promessas da marca:** você não gasta nada · seu dinheiro continua seu · saque quando quiser.

**Escopo do que o rendimento paga.** O posicionamento de marca e a comunicação do MVP são
**software-first** (*"seu capital paga seu software"*) — narrativa afiada e ponta de entrada. Mas o
**backend é genérico desde já**: o rendimento pode cobrir qualquer **conta recorrente** (software,
conta de luz, internet, outros serviços mensais). Software é apenas uma **categoria**, não o
conceito todo. Isso permite ampliar o mercado e pivotar o posicionamento depois — com dados — sem
refazer a arquitetura. O motor de "gastável" é agnóstico ao tipo de conta.

---

## 2. Decisões de arquitetura (travadas)

| Decisão | Escolha | Motivo |
|---|---|---|
| Motor de rendimento | **DeFindex** (vault Soroban na Stellar) | Yield real on-chain; SDK TypeScript pronto |
| Custódia | **Não-custodial via Privy** (embedded wallet) | Cliente nem sabe que existe carteira; FixEarn nunca segura fundos |
| Tipo de carteira | **Embedded EOA** na Stellar (Privy, TEE + Shamir) | Privy na Stellar é EOA, não smart account (ERC-4337 é só EVM). UX idêntica |
| Frontend | **Next.js + React + TypeScript** | SDK Privy first-class; ecossistema |
| Backend | **NestJS + TypeScript** | Mesma linguagem; SDKs Stellar/DeFindex/Privy em JS; estrutura modular |
| Ativo | **USDC** na Stellar | Suportado pelo DeFindex; estável |

---

## 3. Princípio central — "gastável"

O vault DeFindex tem **principal** (depositado) e **valor atual** (principal + valorização).

> **Gastável = valor atual − principal.** Só o rendimento é usável para pagar software.
> O principal nunca é tocado e fica sacável pela empresa a qualquer hora.

**"Gastável" é um número calculado, não um saldo movido para fora.** Os fundos só saem do vault
no momento exato em que uma assinatura é paga (fase 2), e só o valor exato. O rendimento que **não
for gasto continua no vault rendendo (compõe juros)** — nunca há um "pool separado" para onde
voltar, porque nunca saiu. Resultado: principal intacto **e** rendimento não-gasto segue compondo.

---

## 4. Fronteiras do MVP (fora de escopo — de propósito)

As duas pontes fiat são o pedaço mais pesado e regulado do projeto inteiro. **Não** entram no Ciclo 1:

- **On-ramp (BRL → USDC para fundear):** o MVP assume a carteira já fundeada em USDC
  (ou opera em testnet). Conversão fiat de entrada = fase 2.
- **Off-ramp / pagamento real das contas:** o MVP mostra o rendimento como **"crédito"** e o
  cadastro de contas recorrentes (software, luz, etc.). Pagamento real = **concierge manual** no
  Ciclo 1. Motor de pagamento automático por trilho (boleto/PIX para contas BRL, cartão virtual
  USD para SaaS) = **fase 2**.

**O que o MVP prova:** `onboard → depósito no DeFindex → rendimento visível → saque do principal`.

---

## 5. Arquitetura

```
Next.js (Privy SDK)  ──auth/login──>  cliente nem vê a wallet
   │  assina txs (Privy embedded EOA Stellar)
   ▼
NestJS API  ──@defindex/sdk──>  monta tx deposit/withdraw, lê saldo + APY
   │
   ├─ Postgres   (empresas, wallets, depósitos, snapshots de rendimento, assinaturas)
   ├─ Job/cron   (snapshot diário: valor atual − principal = gastável)
   └─ Stellar RPC / DeFindex API
```

Fluxo de assinatura de transação: o backend monta a transação (deposit/withdraw) com o
`@defindex/sdk`; o frontend pede a assinatura à carteira embedded Privy; a tx assinada é
submetida à rede. A FixEarn nunca detém a chave.

---

## 6. Backend — módulos NestJS

Cada módulo tem propósito único e interface clara:

- **auth** — valida o token de sessão Privy, mapeia para a empresa. Sem senha própria.
- **wallet** — provisiona/lê a embedded wallet Privy do cliente (`privyId`, `stellarAddress`).
- **vault** — wrapper fino do `@defindex/sdk`. Interface: `deposit(amount)`, `withdraw(amount)`,
  `getBalance()`, `getApy()`. Esconde detalhes do SDK do resto do sistema.
- **ledger** — registra principal vs rendimento; persiste snapshots diários; calcula gastável.
  Fonte de verdade dos números mostrados no dashboard.
- **bills** — CRUD das **contas recorrentes** que o cliente quer cobrir, genérico por `type`
  (`software | utility | other`). **Só cadastro no MVP**; o engine de pagamento é um stub
  documentado (fase 2). UI do MVP destaca a categoria `software` (branding software-first).
- **jobs** — cron de snapshot diário de rendimento.

Limites: o `vault` é a única parte que conhece o DeFindex; o `ledger` é a única fonte dos números;
trocar o protocolo de yield no futuro toca só o `vault`.

---

## 7. Frontend — telas (reaproveitando o design system existente)

O design já existe em `design/` no padrão protótipo `.dc.html`. O MVP porta para componentes
React de produção, mantendo os tokens (`--fx-*`), o material metal escovado e o bilíngue EN/PT.

- **Landing** (já desenhada) → componentes React de produção.
- **Auth** → login via Privy.
- **Onboarding / Depósito** (3 passos, já desenhado) → depósito real no vault DeFindex.
- **Dashboard** → capital, rendimento acumulado, crédito gastável, assinaturas cadastradas, APY.

---

## 8. Modelo de dados (núcleo)

- `Company` — empresa cliente.
- `Wallet` — `privyId`, `stellarAddress`, FK para `Company`.
- `Deposit` — `amount`, `txHash`, data, FK para `Company`.
- `YieldSnapshot` — `date`, `vaultValue`, `principal`, `spendable` (calculado), FK para `Company`.
- `RecurringBill` — `vendor`, `monthlyCost`, `status`, `type` (`software | utility | other`).
  Só cadastro no MVP. Software é uma categoria; o modelo já aceita outras contas recorrentes.

---

## 9. Estratégia de testes

- **Unit:** cálculo de gastável (principal vs valorização, casos de borda: valor < principal,
  zero, múltiplos depósitos); wrapper `vault` com SDK mockado.
- **Integração:** fluxo deposit/withdraw real contra **DeFindex testnet**.
- **E2E:** onboard → depósito → dashboard mostra rendimento corretamente.

---

## 10. Riscos e questões abertas

- **On/off-ramp fiat** (fase 2) é o item mais regulado; decisão Stripe Issuing/Bridge vs PIX
  depende de disponibilidade no Brasil — pesquisar antes da fase 2.
- **Disponibilidade de USDC fundeado no MVP:** definir se o cliente-piloto fundeia manualmente ou
  se roda em testnet para a demonstração.
- **APY/valorização do DeFindex:** confirmar como o SDK expõe valor atual vs principal por
  carteira para o cálculo de gastável.

### 10.1. Backend MVP — status e tickets de fase 2

O backend do Ciclo 1 está implementado (NestJS 11 + Prisma 7, 13 tarefas, suíte unit verde,
app sobe). Itens deliberadamente adiados, a fechar antes de ir a produção/mainnet:

- **3 pontos de integração não fixados** (sem credenciais ainda; testes `*.integration-spec.ts`
  guardados por `RUN_INTEGRATION=1`):
  1. `verifyAuthToken` da Privy — campo `.userId` confirmado para `@privy-io/server-auth@1.32.5`.
  2. **Conversão shares→USDC do DeFindex** — `VaultService.getPositionValue` hoje retorna `dfTokens`
     (shares) como **placeholder**; candidato real `underlyingBalance[0]`. `getPositionValue` lança
     erro se `STELLAR_NETWORK=public`, pra placeholder nunca virar valor real em mainnet.
  3. **Submit Soroban** — `attachAndSubmit` pode precisar de `prepareTransaction`; `sendTransaction`
     volta `PENDING`, precisa de polling `getTransaction` antes de registrar o depósito.
- **TICKET I1 — confiança no `POST /deposit/submit`:** hoje `amount` e `txHash` vêm do cliente e são
  gravados sem reconciliar com o XDR que o backend montou. Risco de `principal` errado (corrompe
  `gastável`). Fase 2: vincular o valor gravado ao XDR construído no `build` (persistir por hash),
  não confiar no echo do cliente.
- **TICKET — reconciliação de saque no principal:** saque não baixa o `principal` (soma de depósitos);
  após saque real, `principal` fica inflado e `gastável` subestima. Definir tratamento.
- **Hardening pré-deploy:** `ValidationPipe` global já adicionado + parsing de dinheiro com
  `BadRequestException`; falta endurecer schemas de DTO (class-validator) e polling de finalidade.

---

## 11. Sequência de fases

1. **Ciclo 1 (este spec):** loop on-chain — onboard, depósito DeFindex, rendimento visível, saque.
   Pagamento de SaaS = concierge.
2. **Fase 2:** ponte fiat — on-ramp (BRL→USDC) e motor de pagamento automático de contas
   recorrentes, sem tocar o principal. Trilho por tipo de conta:
   - `utility`/`other` (luz, internet, boletos BRL) → **boleto/PIX** — nativo do Brasil, mais viável.
   - `software` (SaaS cobrado em USD) → **cartão virtual USD** (Stripe Issuing/Bridge) — mais pesado.

   Generalizar para contas recorrentes **destrava** a fase 2 no Brasil: o trilho boleto/PIX é mais
   simples que emissão de cartão USD.
