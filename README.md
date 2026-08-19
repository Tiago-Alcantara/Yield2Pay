# Yield2Pay

> **O rendimento do seu dinheiro paga suas assinaturas. E o dinheiro continua sendo seu.**

Ferramenta de pagamento **não-custodial** na rede Stellar (Soroban). Você deposita, o dinheiro
rende num cofre DeFi, e **só o rendimento** paga suas mensalidades (Netflix, Spotify, ChatGPT,
academia…). O **principal permanece 100% seu** e pode ser sacado a qualquer momento.

![Status](https://img.shields.io/badge/status-MVP%20testnet%20%2B%20prot%C3%B3tipo%20fam%C3%ADlias-2ea44f)
![Rede](https://img.shields.io/badge/rede-Stellar%20%C2%B7%20Soroban-1e40af)
![Stack](https://img.shields.io/badge/stack-NestJS%2011%20%C2%B7%20Next.js%2016-3b82f6)
![Custódia](https://img.shields.io/badge/arquitetura-100%25%20n%C3%A3o--custodial-6d28d9)

*Yield2Pay nasceu como `FixEarn` e foi renomeado em todo o monorepo (marca, pacotes, infra, banco).*

> **Reestruturação em curso.** O projeto começou 100% B2B (tesouraria corporativa paga o SaaS
> da empresa). Estamos abrindo uma vertical de **liberdade financeira para pessoas físicas,
> casais e famílias** — o mesmo motor de rendimento, agora pagando as assinaturas do dia a dia.
> A vertical famílias passa a **liderar** o produto; o B2B original vira produto **complementar**
> (ver [Bloco 3](#bloco-3--produto-original-tesouraria-corporativa-b2b)). Os dois compartilham a
> mesma infraestrutura não-custodial: Privy + Etherfuse Ramp + DeFindex.

---

# Bloco 1 — Liberdade Financeira (vertical famílias)

## 1.1. A tese

Todo mês você paga um monte de mensalidade (streaming, IA, academia, apps). Esse dinheiro sai e
não volta. A proposta é simples: em vez de gastar o dinheiro, você **deposita** e deixa ele
render num cofre DeFi. **Só o rendimento** paga as assinaturas — o valor depositado (o principal)
nunca é gasto e pode ser sacado quando quiser.

É uma ferramenta de **pagamento**, não um investimento com promessa de retorno: o objetivo é que
o rendimento do seu próprio dinheiro cubra suas contas recorrentes. Não-custodial — a carteira é
sua (chaves via Privy), a plataforma nunca tem controle isolado sobre o dinheiro.

Público: pessoas físicas, casais e famílias brasileiras. Complementar ao produto B2B original
(tesouraria corporativa).

## 1.2. Percentual de Liberdade (a métrica central)

Quanto das suas contas mensais o **rendimento sozinho** já cobre. É o KPI que a pessoa acompanha:
de 0% (não cobre nada) a 100% (as assinaturas se pagam sozinhas).

Matemática (em reais, front puro — ver [`familyMath.ts`](apps/web/src/app/family/_lib/familyMath.ts)):

```
rendimento_mensal   = (deposito × taxa_anual) / 12
deposito_necessario = (mensalidade × 12) / taxa_anual
percentual          = min(100, round(rendimento_mensal / mensalidade × 100))
```

**Exemplo:** assinaturas de R$ 400/mês, o rendimento cobre R$ 120/mês → **Percentual de
Liberdade = 30%**. Para chegar a 100% (cobrir os R$ 400/mês) a uma taxa de 8% a.a., seria preciso
depositar **R$ 60.000** — que continuam sendo seus.

Só o rendimento paga as contas. A lista de assinaturas é ordenada por prioridade: o rendimento do
mês cobre de cima para baixo, e uma conta só entra como "coberta" quando o acumulado até ela cabe
dentro do rendimento mensal.

## 1.3. Fluxo do usuário

1. **Login social** (Google/Apple) → carteira criada automaticamente, sem seed phrase.
2. **Depósito via PIX** → convertido em **USDC** → alocado no cofre **DeFindex** (Soroban).
3. **Cadastro das assinaturas** (nome, valor, dia de vencimento).
4. **Calculadora reversa** — quanto ainda falta depositar para cobrir cada conta / chegar a 100%.
5. **Dashboard** — Percentual de Liberdade, saldo, rendimento e histórico.

## 1.4. As telas `/family` (estado atual: protótipo)

As telas da vertical vivem em [`apps/web/src/app/family/`](apps/web/src/app/family/) e já formam um
**protótipo navegável bilíngue (PT/EN)**:

- `page.tsx` — landing: hero, calculadora de liberdade, como funciona, o que está por trás, lista
  de espera, rodapé.
- `onboarding/` · `deposito/` · `dashboard/` (+ `dashboard/[subId]/` detalhe da assinatura) ·
  `saque/` · `conceitos/`.
- `configuracoes/` — perfil, segurança, carteira, PIX, assinaturas, notificações, privacidade (LGPD).
- `_lib/` — `familyMath` (Percentual de Liberdade), `familyI18n` (PT/EN), `familyStore`,
  `FamilyProvider`, `familyTheme`, `familyFormat` (+ testes).
- `_components/` — `FamilyUI`, `DashboardHeader`, `PixDepositCard`.

> **Importante — o que ainda NÃO está ligado.** Estas telas são **front puro**: os números são
> calculados no cliente, **sem DeFindex/Privy/PIX por trás** nesta vertical, e a lista de espera
> ainda **não está integrada** (só valida e mostra estado "enviado"). O backend real
> (auth, depósito, saque, bills, ledger) já roda em testnet para o produto B2B — **falta plugar as
> telas famílias nele** (ver [Bloco 4](#bloco-4--a-fazer-revisar-testar-e-implementar)).

## 1.5. Decisões de produto

- **Moeda única: USDC.** Descartados XLM e USDT para **não expor o usuário ao câmbio** — quem
  guarda em reais quer previsibilidade, e o dólar-stablecoin único simplifica o mental model.
- **Sem conta compartilhada / cofre familiar no MVP.** Custódia compartilhada (várias pessoas
  numa mesma carteira/cofre) foi **adiada** pela complexidade de custódia e assinatura.
- **Campo "autor" em cada movimentação desde já.** Mesmo sem cofre familiar agora, toda
  movimentação guarda **quem** a fez — assim a migração futura para contas familiares não exige
  reescrever o histórico.

---

# Bloco 2 — Arquitetura do projeto

## 2.1. Visão geral: monorepo pnpm

Monorepo gerenciado por **pnpm workspaces** (`pnpm@10.33.2`). Três membros: dois apps
(`apps/*`) e um pacote de contrato compartilhado (`packages/*`).

```
FixEarn/
├── apps/
│   ├── api/          → Backend NestJS 11 + Prisma + Postgres
│   └── web/          → Frontend Next.js 16 (App Router) — inclui a vertical /family
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
├── wallet/            → registro 1:1 do endereço Stellar; cria e financia a conta on-chain
│                         se ainda não existir (StellarService.ensureAccountFunded)
├── vault/             → wrapper do SDK DeFindex (build deposit/withdraw, APY, posição)
├── stellar/           → StellarService: fee-bump sponsor, criação de conta, saldo on-chain,
│                         submit + polling na Soroban RPC, funding de testnet para clientes
├── deposit/           → fluxo de depósito (funde cliente → build XDR → assina → submete)
├── withdraw/          → fluxo de saque (espelho do depósito)
├── bills/             → CRUD de assinaturas recorrentes (escopo por company)
├── ledger/            → estado financeiro: principal, valor real do cofre, yield gastável,
│                         saldo nativo da carteira (lido via Soroban RPC)
├── jobs/              → cron diário (snapshot do estado de cada company às 2h)
├── health/            → GET /health para health check
└── common/            → utilitários puros (parse-money em base units, filtro de exceções)
```

**Decisões e porquês:**
- **Módulos por domínio** em vez de uma pasta `services/` única: cada fluxo (deposit,
  withdraw, bills) é independente, com seu próprio `.spec.ts`. Facilita testar e evoluir.
- **`config/` com Zod**: o app **falha no boot** se faltar uma env (`DATABASE_URL`,
  `PRIVY_APP_*`, `DEFINDEX_*`, `VAULT_ADDRESS`, `FEE_SPONSOR_SECRET_KEY`, etc.), evitando
  erro silencioso em produção.
- **Não-custodial por design**: o backend só **monta** a transação (XDR) e **submete** a
  assinatura que veio do cliente (`stellar/`). A chave privada nunca passa pelo servidor.
- **Fee-bump sponsor**: `StellarService` mantém um par de chaves sponsor. Toda transação do
  cliente é embrulhada em `FeeBumpTransaction` — o cliente nunca precisa de XLM para pagar
  gas. O sponsor também cria a conta Stellar do cliente no primeiro registro de carteira.
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

> A vertical famílias, quando plugada ao backend, reaproveita esse mesmo núcleo (wallet,
> deposit/withdraw, bills, ledger). O **campo "autor" por movimentação** (decisão 1.5) entra no
> modelo de dados nessa etapa, preparando a futura conta familiar.

### Testes (backend)

**Vitest** (migrado do Jest, com `unplugin-swc` para os decorators do Nest). Specs unitários
por serviço/guard + testes de integração **opt-in** (`RUN_INTEGRATION=1`) que batem no testnet
real para fixar as incógnitas de terceiros (conversão de shares do DeFindex, caminho de submit
da Soroban).

## 2.3. `apps/web` — Frontend (Next.js 16, App Router)

```
apps/web/src/
├── app/
│   ├── page.tsx           → Landing pública (marketing, bilíngue EN/PT)
│   ├── login/             → Login (Google OAuth via Privy)
│   ├── family/            → Vertical Liberdade Financeira (protótipo — ver Bloco 1.4)
│   │   ├── page.tsx           → Landing famílias + calculadora de liberdade
│   │   ├── onboarding/ deposito/ dashboard/ saque/ conceitos/ configuracoes/
│   │   ├── _lib/              → familyMath, familyI18n (PT/EN), familyStore, familyTheme…
│   │   └── _components/       → FamilyUI, DashboardHeader, PixDepositCard
│   ├── tokens/            → Design tokens em CSS custom properties (--fx-*)
│   └── (app)/             → Route group autenticado B2B (AuthGate + LangProvider)
│       ├── dashboard/     → Visão geral: MoneyPanel (carteira+vault real), StatCards,
│       │                    barra de rendimento, catálogo de serviços, cartão virtual
│       ├── deposit/       → Wizard de 3 passos (valor → ferramentas → confirmar)
│       └── withdraw/      → Fluxo de saque
├── components/            → Primitivas UI (MetalCard, Button, Input, Badge, ErrorDialog…)
├── lib/                   → api.ts (client fetch+JWT), money.ts, hooks (useWallet,
│                            useStellarTx, useIsMobile), i18n, validateAmount, errors
└── providers/            → Providers, PrivyProviderWrapper, AuthGate, ErrorDialogProvider
```

**Decisões e porquês:**
- **App Router + route group `(app)`**: agrupa dashboard/deposit/withdraw sob um único
  layout com `AuthGate`. A landing (`/`), o login e a vertical `/family` ficam **fora** do gate.
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

**Testes:** Vitest + Testing Library cobrindo hooks, utils (money, validação, i18n),
componentes, páginas de erro e a matemática/telas da vertical `/family`.

## 2.4. `packages/shared` — Camada de contrato

Pacote sem runtime (só tipos TS): `BillType`, `Bill`, `CreateBillDto`, `RegisterWalletDto`,
`BuildTxResponse`, `SubmitTxDto`, `SpendableView`. **Por quê?** Definir o contrato uma vez e
consumir nos dois lados garante segurança de tipo de ponta a ponta sem publicar um SDK.

## 2.5. `design/` — Design system

Source-of-truth visual **engenheirado a partir da landing real** (não é export de Figma vivo):
`tokens/` (CSS `--fx-*`), `components/` (primitivas React + descrições), `ui_kits/` (telas HTML
de alta fidelidade), `guidelines/` (specimens), `reference/` (HTML exportado), `nemPages/`
(telas de erro), `docs/` (filosofia "private bank, digital"). **Por que separado do app?**
Mantém a referência de design versionada e iterável sem acoplar ao build do frontend (fica fora
do contexto Docker via `.dockerignore`).

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

# Bloco 3 — Produto original: Tesouraria corporativa (B2B)

> Onde o projeto começou e o que segue de pé como produto **complementar**. Mesma
> infraestrutura não-custodial da vertical famílias — muda o público (empresas) e o tamanho
> do colateral.

## 3.1. A tese OpEx Zero

Empresas de tecnologia queimam caixa todo mês em mensalidades de SaaS e APIs (gateways de
pagamento, dados, autenticação, IA). Esse dinheiro **sai do balanço** e vira despesa pura.

O Yield2Pay propõe **OpEx Zero**: em vez de pagar a mensalidade com o caixa, a empresa **trava
um colateral** em stablecoins num cofre DeFi. Só o **rendimento** quita a assinatura; o capital
principal nunca é gasto — fica disponível para resgate integral via Pix no cancelamento.

Resumo: **"o seu caixa ocioso paga o seu software, e o caixa continua sendo seu."**

## 3.2. A matemática do colateral

Colateral mínimo pela equivalência entre a mensalidade fixa e o rendimento anual:

```
C = (M × 12) / Y_anual
```

**Exemplo:** API de R$ 500/mês (R$ 6.000/ano) com APY conservador de 12% a.a. → colateral
**C = R$ 50.000**. O rendimento de R$ 6.000/ano cobre as 12 mensalidades; os R$ 50.000 ficam
intactos. (Mesma lógica do Percentual de Liberdade da vertical famílias, do lado empresa.)

## 3.3. Ciclos de vida

**Entrada (Pix → cofre):** o app pede um *quote* e cria uma *order* na **Etherfuse** → cliente
paga o **Pix** → a Etherfuse entrega o **USDC** na carteira Privy via *claimable balance* → o
cliente assina **uma** tx que faz `ChangeTrust` + `ClaimClaimableBalance` → **auto-depósito** no
cofre DeFindex.

**Distribuição do yield (pagamento da API):** no vencimento, o protocolo resgata **só o lucro**
do período, faz o split de receita (95% provedor da API / 5% taxa Yield2Pay) e aciona o
**Off-Ramp Etherfuse** (saca o USDC → cliente assina a `burnTransaction` → Etherfuse envia o
**Pix** ao provedor). O principal não é tocado.

**Saída (cancelamento):** cliente assina `cancel_subscription` → o cofre devolve o principal →
cálculo pro-rata do rendimento dos dias usados → Pix de devolução para o CNPJ. O acesso à API é
revogado lendo o evento on-chain.

> No **MVP atual** o backend implementa o núcleo desse fluxo B2B end-to-end na testnet:
> depósito/saque direto no cofre DeFindex, cálculo de *spendable = valor atual do cofre −
> principal*, criação e financiamento automático de contas Stellar e patrocínio de gas via
> fee-bump. O contrato escrow próprio (`claim_yield`/split/`cancel`) e a rampa fiat Etherfuse
> continuam **especificados mas não codados** — ver Bloco 4.

---

# Bloco 4 — A fazer: revisar, testar e implementar

> **Estado atual:** o produto B2B roda **end-to-end na testnet Stellar** (auth Privy, criação e
> financiamento de conta Stellar, fee-bump, deposit/withdraw reais no cofre DeFindex, saldo
> on-chain, catálogo de serviços, bills, snapshot diário, UI). A vertical **famílias** é um
> **protótipo de frontend** (PT/EN) ainda sem backend ligado. Falta plugar as telas famílias,
> fechar o contrato escrow, a rampa fiat e os testes que dependem de credenciais.

## 4.1. Vertical famílias

- [ ] **Plugar as telas `/family` no backend real** — reusar auth/deposit/withdraw/bills/ledger
      (já rodando em testnet) por trás da calculadora, do dashboard e do cadastro de assinaturas.
- [ ] **Persistir o Percentual de Liberdade** no backend (hoje é calculado só no cliente).
- [ ] **Campo "autor" em cada movimentação** (decisão 1.5) — adicionar ao modelo de dados desde
      já, para viabilizar contas familiares no futuro sem reescrever histórico.
- [ ] **Integrar a lista de espera** da landing famílias (hoje só valida e mostra "enviado").
- [ ] **Onboarding social Google/Apple** ligado ao Privy na vertical famílias.

## 4.2. On-chain e rampa (compartilhado com o B2B)

- [ ] **Contrato escrow próprio do Yield2Pay (Soroban)** — hoje o backend usa o cofre DeFindex
      direto. `deposit_collateral`, `claim_yield` (com **split** 95/5), `cancel_subscription` e
      os eventos (`DepositCollateral`, `YieldClaimed`, `SubscriptionCanceled`) **ainda não
      existem no repo**.
- [ ] **Rampa fiat via Etherfuse (On/Off-Ramp BRL↔USDC via PIX)** — **design aprovado e
      verificado** contra a doc oficial (`docs/superpowers/specs/2026-06-26-etherfuse-ramp-design.md`)
      e com **plano task-a-task** (`docs/superpowers/plans/2026-06-26-etherfuse-ramp-mvp.md`).
      Ainda **não codado**. Escopo: módulo `apps/api/src/ramp/` (`EtherfuseClient` +
      `EtherfuseService` + `RampService` + `ramp.webhook.controller`), on-ramp (quote → order →
      PIX → claim → auto-depósito), off-ramp (`burnTransaction` → PIX payout), KYC/KYB **hosted**,
      modelo `RampOrder` + campos Etherfuse na `Company`, webhook `POST /ramp/webhook` com
      **X-Signature HMAC** (RFC 8785 / JCS), envs `ETHERFUSE_*`/`RAMP_*`.
- [ ] **Motor de cobrança automatizado** — job que aciona `claim_yield` no vencimento, faz o
      split e dispara o Off-Ramp para o provedor.
- [ ] **Cálculo pro-rata no cancelamento** e revogação de acesso por evento on-chain (B2B).

## 4.3. Testar

- [ ] **Testes de integração opt-in** (`RUN_INTEGRATION=1`) com credenciais reais — fixam 3
      incógnitas de terceiros: (1) campo de retorno do `verifyAuthToken` do
      `@privy-io/server-auth`; (2) conversão **shares → USDC** em `getPositionValue` (DeFindex);
      (3) caminho real de `prepare`/`submit` na Soroban RPC (`attachAndSubmit`).
- [ ] **Teste deferido** em `apps/api/test/vault.integration-spec.ts` (trocar a asserção de
      `dfTokens` por `underlyingBalance[0]` quando a matemática do cofre fechar).
- [ ] **E2E do depósito** (`build → sign → submit → assert position`) — depende de credenciais
      Privy + setup de testnet.
- [ ] **Verificação visual por tela (Playwright)** contra o `design/`.

## 4.4. Revisar

- [ ] **Segurança de CORS**: sem `CORS_ORIGIN`, o backend reflete **qualquer origem** (marcado
      "MVP only" em `main.ts`). Fixar a origem da Vercel antes de produção.
- [ ] **Segredos de produção** no Render/Vercel: `PRIVY_*`, `DEFINDEX_API_KEY`, `VAULT_ADDRESS`,
      `USDC_ADDRESS`, `CORS_ORIGIN`, `NEXT_PUBLIC_*` e os da rampa Etherfuse (ver `docs/DEPLOY.md`).
- [ ] **Carteira/cofre on-chain reais**: hoje aponta para **testnet**; migrar para mainnet exige
      cofre DeFindex financiado, **chave de produção Etherfuse** (KYB aprovado) e
      `STELLAR_NETWORK=public`.

---

## Como rodar (dev)

```bash
pnpm install
pnpm db:up            # sobe Postgres local (porta 5433)
pnpm db:migrate       # aplica as migrations
pnpm dev:app          # web + api em paralelo
```

Configure `apps/api/.env` e `apps/web/.env.local` a partir dos respectivos `*.example`.
Sem `NEXT_PUBLIC_PRIVY_APP_ID` só as páginas públicas renderizam. A vertical famílias
(`/family`) é front puro e roda sem backend/credenciais.

## Documentação

**Técnica**
- `docs/Yield2Pay_Documentacao_Tecnica.md` — spec técnica e de negócios (§8: status
  implementado em testnet vs. planejado).
- `docs/FAQ.md` — perguntas frequentes (inclui a vertical famílias, `/family`).
- `docs/DEPLOY.md` — guia de deploy (Vercel + Render).
- `docs/diagrams/arquitetura-geral.excalidraw` — mapa de áreas do projeto (negócio + produto).
- `docs/superpowers/specs/2026-06-26-etherfuse-ramp-design.md` — design da rampa fiat Etherfuse.
- `docs/superpowers/plans/` — planos de implementação task-a-task.

**Negócio & produto**
- `docs/PITCH.md` — pitch do projeto.
- `docs/GTM.md` — estratégia go-to-market.
- `docs/GUIA-DO-USUARIO.md` — guia de onboarding para o cliente final.
- `docs/PROMPT-PITCH-SLIDES.md` — prompt para gerar o pitch deck no design system.
