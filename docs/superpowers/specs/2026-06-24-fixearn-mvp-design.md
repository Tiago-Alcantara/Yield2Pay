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
- **Off-ramp / pagamento real do SaaS:** o MVP mostra o rendimento como **"crédito de software"**
  e o cadastro de assinaturas. Pagamento real = **concierge manual** no Ciclo 1. Motor de
  pagamento automático (cartão virtual via Stripe Issuing/Bridge, ou payout PIX) = **fase 2**.

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
- **subscriptions** — CRUD das assinaturas que o cliente quer cobrir. **Só cadastro no MVP**; o
  engine de pagamento é um stub documentado (fase 2).
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
- `Subscription` — `vendor`, `monthlyCost`, `status`. Só cadastro no MVP.

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

---

## 11. Sequência de fases

1. **Ciclo 1 (este spec):** loop on-chain — onboard, depósito DeFindex, rendimento visível, saque.
   Pagamento de SaaS = concierge.
2. **Fase 2:** ponte fiat — on-ramp (BRL→USDC) e motor de pagamento automático de assinaturas
   (cartão virtual ou payout PIX), sem tocar o principal.
