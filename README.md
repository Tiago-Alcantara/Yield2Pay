# Yield2Pay

> Protocolo de infraestrutura financeira **Web2.5** na rede Stellar (Soroban). Empresas
> alocam um colateral em stablecoins; o **rendimento** desse colateral paga assinaturas de
> software/APIs em tempo real; o **principal volta 100%** ao cliente no cancelamento.
> Arquitetura **não-custodial** (sem chaves administrativas sobre o dinheiro do cliente).

*Yield2Pay nasceu como `FixEarn` e foi renomeado em todo o monorepo (marca, pacotes, infra, banco).*

---

# Bloco 1 — O que é o projeto, para que serve e como funciona

## 1.1. O problema (e a tese)

Empresas de tecnologia queimam caixa todo mês em mensalidades de SaaS e APIs (gateways de
pagamento, dados, autenticação, IA). Esse dinheiro **sai do balanço** e vira despesa pura.

O Yield2Pay propõe **OpEx Zero**: em vez de pagar a mensalidade com o caixa, a empresa
**trava um colateral** em stablecoins num cofre DeFi. Só o **rendimento** desse colateral é
usado para quitar a assinatura. O capital principal nunca é gasto — fica disponível para
resgate integral via Pix quando a empresa cancelar o serviço.

Resumo: **"o seu caixa ocioso paga o seu software, e o caixa continua sendo seu."**

## 1.2. Foco do MVP

- **Nicho:** assinaturas B2B de valor mensal fixo para **DevTools e APIs** (software-first).
- **Trilha:** Soroban DeFi, RWA & Web2.5 (hackathon Stellar).
- **Modelo:** 100% não-custodial — nem a plataforma nem os parceiros têm controle isolado
  sobre os fundos.

## 1.3. O tripé Web2.5 (esconder a blockchain atrás da Web2)

| Pilar | Tecnologia | Papel |
|---|---|---|
| **Identidade & Carteira** | **Privy** | Embedded wallet via login Google/e-mail corporativo. Sem seed phrase, sem extensão (Freighter). Chave fragmentada por SSS — só o usuário assina. |
| **Rampa Bancária (fiat ⇄ cripto)** | **Stellar Anchors (SEP-24)** | Cliente paga um **Pix** tradicional; o Anchor liquida o fiat e emite a stablecoin (BRZ/USDC) na carteira. KYC/AML é do Anchor licenciado. |
| **Motor de Rendimento** | **DeFindex (Soroban)** | O colateral é direcionado a cofres indexados que capturam o melhor APY da rede. |

## 1.4. A matemática do colateral

O colateral mínimo é calculado pela equivalência entre a mensalidade fixa e o rendimento anual:

```
C = (M × 12) / Y_anual
```

**Exemplo:** API de R$ 500/mês (R$ 6.000/ano) com APY conservador de 12% a.a.
→ colateral **C = R$ 50.000**. O rendimento de R$ 6.000/ano cobre as 12 mensalidades; os
R$ 50.000 permanecem intactos.

Mecanismos de robustez previstos na especificação:
- **Ajuste por taxas de rampa** (spread/slippage do Anchor embutido no QR do Pix).
- **Margem de colateral reativa**: se o APY cair abaixo do equilíbrio, o protocolo avisa
  subcolaterização e cobra a diferença residual via Pix/boleto em vez de travar o serviço.

## 1.5. Ciclos de vida

**Entrada (Pix → cofre):** o app gera um canal On-Ramp SEP-24 → cliente paga o Pix → o
Anchor emite stablecoins na carteira Privy → duas transações pré-assinadas (allowance +
deposit) movem o colateral para o cofre DeFindex.

**Distribuição do yield (pagamento da API):** no vencimento, o protocolo resgata **só o
lucro** do período, faz o split de receita (95% provedor da API / 5% taxa Yield2Pay) e
aciona o Off-Ramp (Anchor queima a stablecoin e envia Pix ao provedor). O principal não é
tocado.

**Saída (cancelamento):** cliente assina `cancel_subscription` → o cofre devolve o principal
→ cálculo pro-rata do rendimento dos dias usados → Pix de devolução para o CNPJ da empresa.
O acesso à API é revogado lendo o evento on-chain.

> No **MVP atual** o backend implementa o núcleo desse fluxo de forma simplificada:
> depósito/saque direto no cofre DeFindex e cálculo de *spendable = valor atual do cofre −
> principal*. O contrato escrow próprio do Yield2Pay com `claim_yield`/split/`cancel` e as
> rampas fiat (Anchor/Pix) são pontos **de integração ainda não codados** — ver o Bloco 3.

---

# Bloco 2 — Arquitetura do projeto

## 2.1. Visão geral: monorepo pnpm

Monorepo gerenciado por **pnpm workspaces** (`pnpm@10.33.2`). Três membros: dois apps
(`apps/*`) e um pacote de contrato compartilhado (`packages/*`).

```
FixEarn/
├── apps/
│   ├── api/          → Backend NestJS 11 + Prisma + Postgres
│   └── web/          → Frontend Next.js 16 (App Router)
├── packages/
│   └── shared/       → Tipos/DTOs compartilhados entre api e web (@yield2pay/shared)
├── design/           → Design system (tokens, componentes, UI kits, referência Figma)
├── docs/             → Documentação técnica, deploy e planos de implementação
├── docker-compose.yml→ Postgres local (porta 5433)
├── render.yaml       → Blueprint de produção (Postgres + API em Docker)
├── pnpm-workspace.yaml
└── package.json      → Scripts raiz (dev:app, db:*, etc.)
```

**Por que monorepo?** Frontend, backend e os tipos do contrato evoluem juntos. Um único
`packages/shared` garante que cliente e servidor falem exatamente o mesmo formato de DTO em
tempo de compilação, sem versionar um SDK à parte.

## 2.2. `apps/api` — Backend (NestJS 11)

Arquitetura em camadas **Controller → Service → (Prisma ORM / SDK externo)**, com módulos
por domínio. Cada pasta = um módulo coeso e testável isoladamente.

```
apps/api/src/
├── main.ts            → bootstrap: porta, CORS, ValidationPipe global, shim BigInt.toJSON
├── app.module.ts      → módulo raiz
├── config/            → validação de env com Zod (falha cedo se faltar variável)
├── prisma/            → PrismaService (ciclo de conexão, adapter Postgres)
├── auth/              → AuthGuard: verifica JWT do Privy e faz upsert da Company no login
├── company/           → ciclo de vida da Company (upsert idempotente por privyUserId)
├── wallet/            → registro 1:1 do endereço Stellar (valida chave Ed25519)
├── vault/             → wrapper do SDK DeFindex (build deposit/withdraw, APY, posição)
├── stellar/           → assina hash + submete na Soroban RPC e faz polling do resultado
├── deposit/           → fluxo de depósito (build XDR → assina → submete → grava no ledger)
├── withdraw/          → fluxo de saque (espelho do depósito)
├── bills/             → CRUD de assinaturas recorrentes (escopo por company)
├── ledger/            → estado financeiro: principal, valor do cofre, yield gastável
├── jobs/              → cron diário (snapshot do estado de cada company às 2h)
├── health/            → GET /health para health check
└── common/            → utilitários puros (parse-money em base units)
```

**Decisões e porquês:**
- **Módulos por domínio** em vez de uma pasta `services/` única: cada fluxo (deposit,
  withdraw, bills) é independente, com seu próprio `.spec.ts`. Facilita testar e evoluir.
- **`config/` com Zod**: o app **falha no boot** se faltar uma env (`DATABASE_URL`,
  `PRIVY_APP_*`, `DEFINDEX_*`, `VAULT_ADDRESS`, etc.), evitando erro silencioso em produção.
- **Não-custodial por design**: o backend só **monta** a transação (XDR) e **submete** a
  assinatura que veio do cliente (`stellar/`). A chave privada nunca passa pelo servidor.
- **`auth/` faz upsert da Company no login**: primeiro acesso já cria o registro,
  idempotente, tolerando logins concorrentes (constraint única em `privyUserId`).
- **`jobs/` (cron)**: snapshot diário materializa o estado para histórico/gráficos sem
  recalcular tudo on-the-fly; usa execução paralela por company.

### Modelo de dados (Prisma + Postgres)

| Modelo | Para que serve | Campos-chave |
|---|---|---|
| **Company** | Conta da empresa (1:1 com usuário Privy) | `privyUserId` (único) |
| **Wallet** | Endereço Stellar da company (1:1) | `stellarAddress` (único) |
| **Deposit** | Histórico de depósitos no cofre | `amount` (BigInt), `txHash` (único), índice em `companyId` |
| **RecurringBill** | Assinaturas (software/utility/other) | `vendor`, `monthlyCost` (BigInt), `type`, `status` |
| **YieldSnapshot** | Estado diário (cofre, principal, gastável) | `vaultValue`, `principal`, `spendable` (BigInt), índice `(companyId, createdAt)` |

**Por que `BigInt` em base units (7 casas)?** Dinheiro nunca em `float`. Valores são
guardados como inteiros na menor unidade da stablecoin (7 decimais, padrão Stellar/USDC),
eliminando erro de ponto flutuante. Um shim `BigInt.prototype.toJSON` serializa para string
no JSON da API.

### Testes (backend)

**Vitest** (migrado do Jest, com `unplugin-swc` para os decorators do Nest). ~14 specs
unitários por serviço/guard + testes de integração **opt-in** (`RUN_INTEGRATION=1`) que batem
no testnet real para fixar as incógnitas de terceiros (conversão de shares do DeFindex,
caminho de submit da Soroban).

## 2.3. `apps/web` — Frontend (Next.js 16, App Router)

```
apps/web/src/
├── app/
│   ├── page.tsx           → Landing pública (marketing, bilíngue EN/PT)
│   ├── login/             → Login (Google OAuth via Privy)
│   ├── tokens/            → Design tokens em CSS custom properties (--fx-*)
│   └── (app)/             → Route group autenticado (AuthGate + LangProvider)
│       ├── dashboard/     → Visão geral: capital, retornos, gráfico, serviços, cartão
│       ├── deposit/       → Wizard de 3 passos (valor → ferramentas → confirmar)
│       └── withdraw/      → Fluxo de saque
├── components/            → Primitivas UI (MetalCard, Button, Input, Badge, BrandHeader...)
├── lib/                   → api.ts (client fetch+JWT), money.ts, hooks (useWallet,
│                            useStellarTx, useIsMobile), i18n, validateAmount, errors
└── providers/            → Providers, PrivyProviderWrapper, AuthGate
```

**Decisões e porquês:**
- **App Router + route group `(app)`**: agrupa dashboard/deposit/withdraw sob um único
  layout com `AuthGate`. A landing (`/`) e o login ficam **fora** do gate — públicos e leves.
- **Privy para auth + carteira**: login Google; a embedded wallet Stellar é criada no cliente
  (`useWallet`) e só o **endereço** é registrado no backend. Assinatura via `useSignRawHash`
  — chave nunca sai do Privy.
- **`lib/` como camada de borda**: `api.ts` é uma fábrica que injeta o JWT do Privy no header
  de toda chamada; hooks (`useStellarTx`) orquestram build→assina→submete reusando o backend.
- **Sem Tailwind / sem lib de gráfico**: estilo via **design tokens** (CSS custom properties)
  + estilos inline. Estética "private bank": monocromático preto/prata, superfícies
  brushed-metal, dark mode. O gráfico do dashboard é CSS puro.
- **Tipos do `@yield2pay/shared`**: `SpendableView`, `Bill`, DTOs de tx — mesmo contrato do
  backend, zero divergência cliente/servidor.
- **i18n próprio (EN/PT)** e `useIsMobile` (breakpoint 768px) para responsividade.

**Testes:** Vitest + Testing Library (~19 arquivos) cobrindo hooks, utils (money, validação,
i18n), componentes e páginas.

## 2.4. `packages/shared` — Camada de contrato

Pacote sem runtime (só tipos TS): `BillType`, `Bill`, `CreateBillDto`, `RegisterWalletDto`,
`BuildTxResponse`, `SubmitTxDto`, `SpendableView`. **Por quê?** Definir o contrato uma vez e
consumir nos dois lados garante segurança de tipo de ponta a ponta sem publicar um SDK.

## 2.5. `design/` — Design system

Source-of-truth visual **engenheirado a partir da landing real** (não é export de Figma vivo):
`tokens/` (CSS `--fx-*`), `components/` (primitivas React + descrições), `ui_kits/` (telas HTML
de alta fidelidade — ex.: `yield2pay-dashboard/index.html`), `guidelines/` (specimens),
`reference/` (HTML exportado), `docs/` (filosofia "private bank, digital"). **Por que separado
do app?** Mantém a referência de design versionada e iterável sem acoplar ao build do
frontend (fica fora do contexto Docker via `.dockerignore`).

## 2.6. Infraestrutura e deploy

| Arquivo | Papel | Porquê |
|---|---|---|
| `docker-compose.yml` | Postgres 16 local (porta **5433**) | Banco de dev isolado, sem conflitar com Postgres do host (5432). |
| `apps/api/Dockerfile` | Build multi-stage, roda `prisma migrate deploy` no start | Imagem portátil; migrations aplicadas automaticamente no deploy. |
| `render.yaml` | Blueprint: Postgres gerenciado + API em Docker, health `/health` | Deploy do backend reproduzível em um clique no Render. |
| `docs/DEPLOY.md` | Frontend → **Vercel** (root `apps/web`), backend → **Render** | Deploy **split**: web estática/SSR na Vercel; API + banco em container host. |

Stack final: **NestJS 11 · Prisma 7 · Postgres 16 · Next.js 16 · React 19 · Privy · DeFindex
SDK · Stellar SDK · pnpm · Vitest**.

---

# Bloco 3 — A fazer: revisar, testar e implementar

> Estado atual: o **esqueleto Web2.5 está de pé** (auth Privy, registro de carteira,
> deposit/withdraw no cofre DeFindex, ledger/spendable, bills, snapshot diário, UI completa).
> Os commits recentes já fizeram o cleanup (padronização de tipos/lint, paralelização de I/O,
> migração de testes para Vitest, extração de utils/componentes, memoização). Falta fechar as
> integrações reais on-chain/fiat e os testes que dependem de credenciais.

## 3.1. Implementar

- [ ] **Contrato escrow próprio do Yield2Pay (Soroban)** — hoje o backend usa o cofre
      DeFindex direto. As funções `deposit_collateral`, `claim_yield` (com **split** 95/5),
      `cancel_subscription` e os eventos (`DepositCollateral`, `YieldClaimed`,
      `SubscriptionCanceled`) descritos na doc **ainda não existem no repo**.
- [ ] **Rampa fiat SEP-24 (On/Off-Ramp via Anchor)** — geração de QR Pix, emissão/queima de
      stablecoin, conta de spread/slippage no checkout. **Fora do escopo do MVP**, é a Fase 2.
- [ ] **Motor de cobrança automatizado** — job que aciona `claim_yield` no vencimento, faz o
      split e dispara o Off-Ramp para o provedor da API.
- [ ] **Margem de colateral reativa** — detecção de subcolaterização quando o APY cai e
      cobrança da diferença residual.
- [ ] **Cálculo pro-rata no cancelamento** e revogação de acesso à API por evento on-chain.
- [ ] **Substituir os placeholders da UI** por dados reais: saldos da landing, APY fixo (8.4%)
      no `deposit`, checklist de ativação estático, nome "Acme", cartão virtual e ferramentas
      hardcoded (OpenAI, Slack, etc.) no wizard de depósito.

## 3.2. Testar

- [ ] **Rodar os testes de integração opt-in** (`RUN_INTEGRATION=1`) com credenciais reais —
      eles fixam 3 incógnitas de terceiros ainda em aberto:
  1. campo de retorno do `verifyAuthToken` do `@privy-io/server-auth`;
  2. conversão **shares → USDC** em `getPositionValue` (DeFindex);
  3. caminho real de `prepare`/`submit` na Soroban RPC (`attachAndSubmit`).
- [ ] **Concluir o teste deferido** em `apps/api/test/vault.integration-spec.ts` (trocar a
      asserção de `dfTokens` por `underlyingBalance[0]` quando a matemática do cofre fechar).
- [ ] **E2E completo do depósito** (`build → sign → submit → assert position`) — depende de
      credenciais Privy + setup de testnet, ainda fora do CI.
- [ ] **Verificação visual por tela (Playwright)** contra o `design/` — adiada até o app rodar
      localmente com credenciais.

## 3.3. Revisar

- [ ] **Segurança de CORS**: hoje, sem `CORS_ORIGIN`, o backend reflete **qualquer origem**
      (marcado "MVP only" em `main.ts`). Fixar a origem da Vercel antes de produção.
- [ ] **Segredos de produção** no Render/Vercel: `PRIVY_*`, `DEFINDEX_API_KEY`,
      `VAULT_ADDRESS`, `USDC_ADDRESS`, `CORS_ORIGIN`, `NEXT_PUBLIC_*` (ver `docs/DEPLOY.md`).
- [ ] **Carteira/cofre on-chain reais**: hoje aponta para **testnet**; migrar para mainnet
      exige cofre DeFindex financiado, chave do Anchor e `STELLAR_NETWORK=public`.
- [ ] **Confirmar o plano de cleanup** (`docs/superpowers/plans/2026-06-25-yield2pay-cleanup.md`):
      os checkboxes do arquivo estão vazios, mas os commits indicam execução — validar item a
      item e marcar/ajustar o que ficou.

---

## Como rodar (dev)

```bash
pnpm install
pnpm db:up            # sobe Postgres local (porta 5433)
pnpm db:migrate       # aplica as migrations
pnpm dev:app          # web + api em paralelo
```

Configure `apps/api/.env` e `apps/web/.env.local` a partir dos respectivos `*.example`.
Sem `NEXT_PUBLIC_PRIVY_APP_ID` só a landing pública renderiza.

## Documentação

- `docs/Yield2Pay_Documentacao_Tecnica.md` — spec técnica e de negócios completa.
- `docs/DEPLOY.md` — guia de deploy (Vercel + Render).
- `docs/superpowers/plans/` — planos de implementação (backend MVP, frontend MVP, cleanup).
</content>
</invoke>
