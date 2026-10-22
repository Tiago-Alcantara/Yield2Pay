# Yield2Pay — Documentação completa

> Índice central do projeto. Este documento descreve **o que existe no código hoje** e aponta para os
> documentos especializados (FAQ, pitch, deploy, spec técnica) sem repetir o conteúdo deles.

**Sumário**

1. [Visão geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Modelo de dados](#3-modelo-de-dados)
4. [Referência da API](#4-referência-da-api)
5. [Frontend](#5-frontend)
6. [Regras de negócio](#6-regras-de-negócio)
7. [Integrações externas](#7-integrações-externas)
8. [Erros e idioma](#8-erros-e-idioma)
9. [Rodar, testar e publicar](#9-rodar-testar-e-publicar)
10. [Integração Family ↔ Rendimento](#10-integração-family--rendimento)
11. [Glossário](#11-glossário)

---

## 1. Visão geral

O Yield2Pay tem duas verticais sobre a mesma infraestrutura não-custodial:

| Vertical | Pergunta que responde | Onde vive |
|---|---|---|
| **Rendimento** | "Quanto das minhas contas o rendimento do meu dinheiro já paga?" | `apps/web/src/app/(app)` + módulos `deposit`, `withdraw`, `ledger`, `bills`, `ramp`, `vault`, `wallet` |
| **Family** | "Quanto a casa gasta, e quantos meses a reserva aguenta?" | `apps/web/src/app/family` + módulos `household`, `expenses`, `statements`, `summary`, `lessons` |

- **Rendimento:** o usuário deposita USDC (via PIX, pela rampa Etherfuse) num cofre DeFindex na
  Stellar/Soroban. Só o rendimento (`spendable`) paga as assinaturas; o principal pode ser sacado a
  qualquer momento.
- **Family:** a casa (`Household`) reúne várias pessoas, importa extratos ou lança gastos à mão,
  vê o painel de gastos por categoria e o tempo de liberdade da reserva, e faz as aulas de cripto.

Hoje as duas verticais **compartilham a conta** (`Company`, ligada ao usuário Privy) mas **não
compartilham dinheiro**: a Family ainda não lê o cofre. A proposta para unir as duas está na
[seção 10](#10-integração-family--rendimento).

## 2. Arquitetura

Monorepo `pnpm`:

```
apps/
  web/        Next.js (App Router) — telas B2B em (app)/ e vertical /family
  api/        NestJS + Prisma + Postgres
packages/
  shared/     Tipos compartilhados (contratos da API) — ex.: household.ts
design/       Design system (tokens, componentes, kits de UI)
docs/         Documentação
```

```
Navegador ──(JWT Privy)──▶ API NestJS ──▶ Postgres (Prisma)
   │                          │
   │ assina tx (embedded)     ├──▶ Stellar / Soroban (DeFindex SDK) — cofre, saldos, APY
   └──────────────────────────┤
                              └──▶ Etherfuse Ramp — PIX ⇄ USDC, KYC
```

- **Autenticação:** o front obtém o token do Privy; a API valida em `auth/privy.service.ts` e
  resolve (ou cria) a `Company` correspondente.
- **Assinatura de transações:** a API **monta** a transação (`/deposit/build`, `/withdraw/build`),
  o usuário assina na carteira embutida do Privy e a API **submete** (`/.../submit`). A plataforma
  nunca guarda a chave.
- **Jobs:** `jobs/snapshot.job.ts` grava um `YieldSnapshot` diário por conta.

Diagrama: [`docs/diagrams/arquitetura-geral.png`](diagrams/arquitetura-geral.png).

## 3. Modelo de dados

Definido em [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma). Valores on-chain
em `BigInt` (unidades do token); valores em reais da Family em `Int` de **centavos**.

### Núcleo e Rendimento

| Modelo | Papel | Campos-chave |
|---|---|---|
| **Company** | Conta do usuário (1:1 com Privy) | `privyUserId` (único) |
| **PersonName** | Nome de exibição da pessoa | `companyId` (PK) |
| **Wallet** | Endereço Stellar (1:1) | `stellarAddress` (único) |
| **Deposit** | Depósitos no cofre | `amount` (BigInt), `txHash` (único), `rampOrderId?` |
| **RecurringBill** | Assinaturas pagas pelo rendimento | `vendor`, `monthlyCost` (BigInt), `type`, `status` |
| **YieldSnapshot** | Fotografia diária do cofre | `vaultValue`, `principal`, `spendable` |
| **EtherfuseCustomer** | Cliente na rampa | `customerId`, `kycStatus`, `bankAccountId` |
| **RampOrder** | Ordem de on/off-ramp | `orderId` (único), `type`, `status`, `amountFiat` |

### Family

| Modelo | Papel | Campos-chave |
|---|---|---|
| **Household** | A casa; guarda o perfil do onboarding | `ownerCompanyId` (único), `monthlyIncomeCents`, `reserveCents`, `goalMonths`, `priorities` |
| **HouseholdMember** | Pessoa na casa | `companyId` (único — uma casa por pessoa), `role` (`owner`/`member`) |
| **HouseholdInvite** | Convite por e-mail | `email`, `status` (`pending`…) |
| **Statement** | Extrato importado | `format`, `contentHash` (único por casa — evita importar duas vezes) |
| **Expense** | Gasto | `spentOn`, `merchant`, `category`, `fixed`, `amountCents`, `addedByCompanyId`, `statementId?` |
| **LessonProgress** | Progresso nas aulas de cripto | `companyId`, `lessonId`, `completed` |

O campo **`addedByCompanyId`** em `Expense`/`Statement` já cumpre, na Family, a decisão de produto
"campo autor desde já". Em `Deposit` e `RampOrder` ele ainda não existe.

## 4. Referência da API

Todas as rotas (exceto `/health`) exigem `Authorization: Bearer <token Privy>`.

### Rendimento

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/health` | Health check (Render) |
| `POST` | `/wallet` | Cria/garante a carteira Stellar da conta |
| `GET` | `/wallet/balance` | Saldo da carteira |
| `POST` | `/deposit/build` · `/deposit/submit` | Monta e submete o depósito no cofre |
| `POST` | `/withdraw/build` · `/withdraw/submit` | Monta e submete o saque |
| `GET` | `/dashboard` | `SpendableView`: valor no cofre, principal, rendimento disponível, APY |
| `GET` · `POST` · `DELETE` | `/bills` · `/bills/:id` | Assinaturas pagas pelo rendimento |
| `GET` | `/ramp/status` · `/ramp/assets` · `/ramp/orders` · `/ramp/order/:orderId` | Estado da rampa e ordens |
| `POST` | `/ramp/setup` · `/ramp/kyc-approved` | Cadastro e KYC na Etherfuse |
| `POST` | `/ramp/onramp/start` · `/ramp/offramp/start` | Inicia PIX → USDC / USDC → PIX |
| `POST` | `/ramp/onramp/simulate` | Simula o pagamento PIX (sandbox) |
| `GET` · `POST` | `/ramp/order/:orderId/claim` · `/burn` | Monta/submete claim e burn |

### Family

| Método | Rota | O que faz |
|---|---|---|
| `GET` · `PATCH` | `/account` | Dados da conta (`AccountView`) e nome de exibição |
| `POST` | `/account/data` | Apaga só os gastos (`expenses`) ou tudo (`all`) — LGPD |
| `POST` | `/households` | Cria a casa |
| `GET` · `PATCH` | `/households/current` | Casa atual (com convites pendentes) / renomear |
| `GET` | `/households/current/people` | Pessoas e convites |
| `POST` | `/households/current/leave` | Sair da casa |
| `DELETE` | `/households/current/members/:id` | Remover pessoa (dono) |
| `POST` | `/households/current/invites` | Convidar por e-mail |
| `POST` | `/households/invites/:id/accept` · `/revoke` | Aceitar / revogar convite |
| `GET` · `PUT` · `PATCH` | `/household/profile` | Perfil do onboarding |
| `POST` | `/household/profile/skip` | Pular o onboarding |
| `GET` | `/household/summary` | `HouseholdSummary`: totais, categorias, 6 meses, ritmo diário, liberdade |
| `GET` · `POST` | `/expenses` | Lista paginada (`ExpensePage`) / cria gasto |
| `GET` | `/expenses/months` | Meses com gastos |
| `PATCH` · `DELETE` | `/expenses/:id` | Edita / apaga gasto |
| `POST` | `/statements` | Importa extrato (multipart); devolve `imported`/`skipped` |
| `DELETE` | `/statements/:id` | Apaga o extrato e os gastos dele |
| `GET` | `/lessons` · `/lesson-progress` | Catálogo e progresso das aulas |
| `PUT` · `DELETE` | `/lesson-progress/:id` · `/lesson-progress` | Marca aula / zera progresso |

Os contratos de resposta da Family estão em
[`packages/shared/src/household.ts`](../packages/shared/src/household.ts); o cliente HTTP do front
é [`householdApi.ts`](../apps/web/src/app/family/_lib/householdApi.ts).

## 5. Frontend

### Rendimento — `apps/web/src/app/(app)`

| Rota | Tela |
|---|---|
| `/login` | Login Privy |
| `/dashboard` | `MoneyPanel` (cofre, principal, rendimento) + `ServiceCatalog` (assinaturas) |
| `/deposit` · `/withdraw` | Fluxo PIX unificado (`useDepositFlow`, `useWithdrawFlow`, `useStellarTx`) |

O grupo `(app)` fica atrás do `AuthGate`, que exige sessão Privy **e** cria a carteira Stellar.

### Family — `apps/web/src/app/family`

| Rota | Tela | Backend |
|---|---|---|
| `/family` | Landing + calculadora de liberdade | — |
| `/family/onboarding` | Perfil da casa (tamanho, renda, reserva, meta, experiência com cripto) | ✅ `household/profile` |
| `/family/dashboard` | **Painel de gastos da casa**: filtros, gráficos, importação de extrato | ✅ `expenses`, `statements`, `summary` |
| `/family/dashboard/[subId]` | Detalhe de assinatura | cliente |
| `/family/conta` | Conta e pessoas da casa (também como modal no painel) | ✅ `account`, `households` |
| `/family/aprender` | Aulas de cripto (7 aulas em `public/aulas-cripto/`) | ✅ `lessons` |
| `/family/conceitos` | Carteira, moeda estável, rendimento + FAQ | — |
| `/family/deposito` · `/family/saque` | Depósito PIX / saque do principal | ⏳ ainda no cliente |
| `/family/configuracoes` | Perfil, segurança, carteira, PIX, assinaturas, notificações, privacidade | parcial |

O `FamilySessionGate` exige sessão Privy **sem** criar carteira Stellar. Sem
`NEXT_PUBLIC_PRIVY_APP_ID` configurado, ele deixa passar — útil para navegar no protótipo, mas as
telas que chamam a API vão falhar sem backend.

## 6. Regras de negócio

### 6.1 Percentual de Liberdade (Rendimento)

Em [`familyMath.ts`](../apps/web/src/app/family/_lib/familyMath.ts) — **só no cliente** hoje:

```
rendimento_mensal  = depósito × taxa_anual ÷ 12
depósito_necessário = conta_mensal × 12 ÷ taxa_anual
liberdade (%)      = rendimento_mensal ÷ conta_mensal × 100   (máx. 100%)
```

As assinaturas são cobertas em ordem de prioridade: uma conta só conta como coberta quando o total
acumulado até ela cabe no rendimento do mês (`coverageRows`).

### 6.2 Tempo de liberdade da reserva (Family)

Em [`summary.math.ts`](../apps/api/src/summary/summary.math.ts), no backend:

```
meses_de_liberdade = reserva ÷ gasto_médio_mensal
quanto_falta       = meta_meses × gasto_médio − reserva
prazo_meses        = quanto_falta ÷ (renda − gasto_médio)
```

Retorna `null` se faltar renda, reserva, meta ou histórico de gastos.

> **Atenção:** são **duas métricas diferentes** com nome parecido. A 6.1 mede quanto o *rendimento*
> paga das contas; a 6.2 mede quantos meses a *reserva* aguenta. A seção 10 propõe mostrar as duas
> lado a lado.

### 6.3 Importação de extratos

O `POST /statements` calcula o `contentHash` do arquivo; o índice único
`(householdId, contentHash)` impede importar o mesmo extrato duas vezes. Linhas já existentes
voltam em `skipped`.

## 7. Integrações externas

| Serviço | Papel | Código |
|---|---|---|
| **Privy** | Login e carteira embutida (chave fragmentada; só o usuário assina) | `apps/api/src/auth`, `apps/web/src/providers` |
| **DeFindex / Soroban** | Cofre que gera o rendimento; saldo e APY | `apps/api/src/vault`, `apps/api/src/stellar` |
| **Etherfuse Ramp** | PIX ⇄ USDC, KYC hospedado. Sem API key, entra em *mock mode* | `apps/api/src/ramp` |

Checklist de testes das integrações: [`CHECKLIST-TESTES-INTEGRACOES.md`](CHECKLIST-TESTES-INTEGRACOES.md).

## 8. Erros e idioma

- A API devolve erros num formato padronizado; o front traduz em
  [`apps/web/src/lib/errors.ts`](../apps/web/src/lib/errors.ts) / `errorCopy.ts` e mostra pelo
  `ErrorDialogProvider`, `ErrorPage`, `error.tsx` e `not-found.tsx`.
- Idioma: PT/EN em `apps/web/src/lib/i18n.ts` e, na Family, `familyI18n.ts`.

## 9. Rodar, testar e publicar

```bash
pnpm install
pnpm db:up        # Postgres local na porta 5433
pnpm db:migrate
pnpm dev:app      # web (3000) + api em paralelo
pnpm test         # todos os testes
```

Variáveis: `apps/api/.env` e `apps/web/.env.local` a partir dos `*.example`. Deploy (Vercel +
Render): [`DEPLOY.md`](DEPLOY.md).

## 10. Integração Family ↔ Rendimento

### Situação hoje

| | Rendimento | Family |
|---|---|---|
| Dono dos dados | `Company` | `Household` (várias `Company`) |
| Dinheiro | `Deposit`, `YieldSnapshot`, cofre on-chain | Nenhum — só registra gastos |
| "Liberdade" | rendimento ÷ contas (cliente) | reserva ÷ gasto médio (API) |
| Depósito/saque | API real | Telas ainda no cliente |

### Proposta em 4 fases

**Fase 1 — A casa enxerga o cofre (só leitura).**
Novo `GET /household/yield` que soma `vaultValue`, `principal` e `spendable` dos membros via o
`LedgerService` existente. No painel Family, um card "Seu dinheiro rendendo" ao lado dos gastos.
Sem migration, sem mexer em dinheiro. **Recomendada como primeiro passo.**

**Fase 2 — Gastos fixos viram contas pagas pelo rendimento.**
`Expense` com `fixed = true` e categoria `subscriptions` vira sugestão de `RecurringBill` ("pagar
com rendimento"). `RecurringBill` ganha `householdId` opcional. O painel passa a mostrar as duas
métricas: **liberdade da reserva** (6.2) e **liberdade do rendimento** (6.1).

**Fase 3 — Depósito e saque reais em `/family`.**
`/family/deposito` e `/family/saque` usam `useDepositFlow`/`useWithdrawFlow` e a rampa Etherfuse.
`Deposit` e `RampOrder` ganham `authorCompanyId`, igual ao `addedByCompanyId` da Family.

**Fase 4 — Uma fórmula só, persistida.**
Mover `freedomPercent`/`coverageRows` para `packages/shared` (mesma função no front e na API) e
gravar o histórico no snapshot diário por casa.

**Fora do escopo:** cofre familiar compartilhado (multisig). Cada pessoa mantém a própria carteira;
a casa apenas **soma**. Continua adiado, não descartado.

## 11. Glossário

| Termo | Significado |
|---|---|
| **Principal** | O que o usuário depositou; nunca é gasto |
| **Spendable** | Rendimento disponível para pagar contas |
| **APY** | Rendimento anual do cofre (variável, pode ser zero) |
| **Cofre / vault** | Contrato DeFindex na Soroban onde o USDC rende |
| **On-ramp / off-ramp** | PIX → USDC / USDC → PIX |
| **Household / casa** | Grupo de pessoas que divide o controle de gastos |
| **Liberdade da reserva** | Meses que a reserva cobre os gastos médios |
| **Percentual de Liberdade** | % das contas que o rendimento já paga |
