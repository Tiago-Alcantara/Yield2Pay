# Yield2Pay — FAQ

> Perguntas frequentes sobre o produto, o modelo de negócio e o código.
> Atualizado em 17/08/2026. Fonte: `README.md`, `docs/Yield2Pay_Documentacao_Tecnica.md`,
> `docs/GTM.md`, `docs/PITCH.md`, `docs/GUIA-DO-USUARIO.md`, `docs/DEPLOY.md`,
> `docs/CHECKLIST-TESTES-INTEGRACOES.md` e o código em `apps/`.

**Índice**

1. [Produto: o que é e para quem](#1-produto-o-que-é-e-para-quem)
2. [Como o dinheiro funciona](#2-como-o-dinheiro-funciona)
3. [Segurança, custódia e regulação](#3-segurança-custódia-e-regulação)
4. [Riscos e casos-limite](#4-riscos-e-casos-limite)
5. [Negócio: preço, ICP e mercado](#5-negócio-preço-icp-e-mercado)
6. [Vertical Famílias (`/family`)](#6-vertical-famílias-family)
7. [Arquitetura e stack](#7-arquitetura-e-stack)
8. [Backend em detalhe](#8-backend-em-detalhe)
9. [Frontend em detalhe](#9-frontend-em-detalhe)
10. [Integrações externas](#10-integrações-externas)
11. [Rodar e testar localmente](#11-rodar-e-testar-localmente)
12. [Deploy e ambientes](#12-deploy-e-ambientes)
13. [Estado atual, lacunas e roadmap](#13-estado-atual-lacunas-e-roadmap)

---

## 1. Produto: o que é e para quem

### O que é o Yield2Pay em uma frase?

Um protocolo de infraestrutura financeira Web2.5 na Stellar (Soroban) em que a empresa trava
um colateral em stablecoin, o **rendimento** desse colateral paga assinaturas de software/API,
e o **principal volta 100%** ao cliente no cancelamento.

Slogan: *"Seu caixa ocioso paga o seu software. E o caixa continua sendo seu."*

### Que problema resolve?

Mensalidade de SaaS/API é despesa pura — o dinheiro sai do balanço e não volta. Ao mesmo tempo,
a tesouraria dessas empresas tem caixa parado rendendo abaixo da inflação. O Yield2Pay conecta
os dois: **OpEx Zero**. A empresa troca uma despesa recorrente por um capital preservado que
continua sendo dela.

### Por que o nome do repositório é `FixEarn`?

O projeto nasceu como **FixEarn** e foi renomeado para **Yield2Pay** em todo o monorepo
(marca, pacotes `@yield2pay/*`, infra, banco) no commit `eb85c8f`. Só o diretório local ficou
com o nome antigo.

### Qual é o nicho do MVP?

Assinaturas B2B de **valor mensal fixo** para **DevTools e APIs** (software-first). Valor fixo
é fácil de modelar matematicamente; consumo variável fica para a Fase 2.

### Existem quantas verticais no produto?

Duas, hoje:

- **B2B (empresas)** — rotas `/`, `/login`, `/(app)/dashboard|deposit|withdraw`. É a vertical
  ligada ao backend real (Privy + DeFindex + Etherfuse).
- **Famílias** — rotas `/family/*`. Telas completas, mas **front puro com dados mock**
  (ver [seção 6](#6-vertical-famílias-family)).

### Preciso entender de cripto para usar?

Não. Login com Google, depósito por Pix, resgate por Pix. Toda a blockchain fica atrás da
camada Web2 — o usuário não vê seed phrase, extensão de navegador nem paga gas.

---

## 2. Como o dinheiro funciona

### Qual é a fórmula do colateral?

```
C = (M × 12) / Y_anual
```

Onde `C` = colateral mínimo, `M` = mensalidade e `Y_anual` = APY do cofre.

**Exemplo:** API de R$ 500/mês (R$ 6.000/ano) com APY conservador de 12% a.a.
→ colateral de **R$ 50.000**. O rendimento de R$ 6.000/ano cobre as 12 mensalidades; os
R$ 50.000 ficam intactos.

### Como funciona o fluxo de entrada (Pix → cofre)?

1. O app pede um **quote** e cria uma **order** na Etherfuse.
2. O cliente paga o **Pix** tradicional pelo banco dele.
3. A Etherfuse liquida o fiat e entrega **USDC** na carteira Privy via *claimable balance*.
4. O cliente assina **uma** tx que faz `ChangeTrust` + `ClaimClaimableBalance`.
5. **Auto-depósito** no cofre DeFindex (segunda assinatura).

São **2 assinaturas** no total: claim + deposit.

### Como funciona o pagamento da assinatura?

No vencimento, o protocolo resgata **só o lucro** do período, faz o split de receita
(95% provedor da API / 5% Yield2Pay) e aciona o **Off-Ramp** Etherfuse: saca o USDC do cofre →
cliente assina a `burnTransaction` → a Etherfuse envia o Pix ao provedor. O principal nunca é
tocado.

> **Atenção:** esse motor de cobrança automatizado ainda **não está implementado** — depende do
> contrato escrow próprio. Ver [seção 13](#13-estado-atual-lacunas-e-roadmap).

### E o cancelamento?

O cliente assina `cancel_subscription` → o cofre devolve o principal → cálculo pro-rata do
rendimento dos dias usados → Pix de devolução para o CNPJ da empresa. O acesso à API é revogado
lendo o evento `SubscriptionCanceled` on-chain. Também **ainda não implementado**.

### O que é o "spendable"?

O rendimento disponível para gastar. O backend calcula em tempo real:

```
spendable = vaultValue − principal
```

`vaultValue` vem do DeFindex (`VaultService.getPositionValue`); `principal` é a soma agregada
dos registros de `Deposit` da company (saques entram como lançamento negativo).

### Em que moeda o colateral fica?

**USDC** — stablecoin lastreada em dólar. Entrada e saída em BRL via Pix; internamente o
protocolo opera em USDC na Stellar.

### Quem paga as taxas de rede (gas)?

A plataforma. Toda transação do cliente é embrulhada em `FeeBumpTransaction` assinada por uma
conta *sponsor* (`FEE_SPONSOR_SECRET_KEY`). O mesmo sponsor também **cria e financia** a conta
Stellar do cliente no primeiro registro de carteira (`StellarService.ensureAccountFunded`).
O usuário nunca precisa comprar XLM.

### Quanto custa para o cliente?

Nada. Sem mensalidade e sem taxa de uso. A plataforma retém **5% do rendimento gerado**; os
outros 95% pagam o provedor do serviço. Se o cofre não render, a plataforma não recebe.

---

## 3. Segurança, custódia e regulação

### O Yield2Pay tem custódia do dinheiro do cliente?

Não. A arquitetura é **100% não-custodial**, em três camadas:

| Camada | Como |
|---|---|
| **Chaves** | Privy fragmenta a chave privada por SSS (Shamir Secret Sharing). Nem a plataforma nem o Privy assinam sozinhos — só a autenticação forte do usuário final produz assinatura. |
| **Fiat** | O Yield2Pay não toca em BRL. Pix, KYC/AML e emissão de stablecoin são todos da Etherfuse, Instituição de Pagamento regulada pelo Banco Central. |
| **Fundos on-chain** | O contrato funciona como escrow sem permissão. **Não existem admin keys** que permitam desviar, travar ou sacar o colateral. |

### A chave privada passa pelo servidor?

Nunca. O backend só **monta** a transação (XDR) e **submete** a assinatura que veio do cliente.
No frontend, a assinatura é feita via `useSignRawHash` do Privy — a chave não sai do Privy.

### Por que isso descaracteriza intermediação financeira?

Porque a plataforma não recebe, não guarda e não movimenta recursos de terceiros: o fiat é
processado por instituição licenciada, e os fundos on-chain só se movem com assinatura do
titular. O enquadramento pretendido é **SaaS puro** (fornecimento de software).

### O KYC/KYB é feito onde?

Na Etherfuse, no modelo **hosted** (presigned URL). No modelo sandbox/org atual, o KYB do org
está aprovado e a wallet do usuário é registrada com `claimOwnership=true`, virando `approved`
na hora — sem KYC por usuário.

---

## 4. Riscos e casos-limite

### E se o APY cair e o rendimento não cobrir a mensalidade?

Está previsto na spec como **Margem de Colateral Reativa**: o protocolo detecta a
subcolaterização, avisa o cliente antes do vencimento e — em vez de travar o serviço —
liquida o yield disponível e cobra a diferença residual via Pix/boleto. O cliente pode
alternativamente depositar mais colateral ou pausar assinaturas. **O principal nunca é usado
para cobrir mensalidade.** Ainda não implementado.

### E se as pools do DeFindex não tiverem liquidez na hora do resgate?

Mitigação prevista: alocação exclusiva em cofres de stablecoins emparelhadas de alta
rotatividade e liquidez profunda (BRZ/USDC), evitando ativos voláteis e pools rasas.

### O rendimento é garantido?

Não. É variável e pode ser zero. Todas as telas exibem estimativas condicionais, nunca
promessas — a vertical Famílias explicita isso no rodapé de cada tela de simulação.

### E o custo de oportunidade de imobilizar caixa?

É a principal objeção comercial. A resposta do GTM: o alvo são empresas com **caixa ocioso
rendendo abaixo do CDI**, para quem o colateral é ativo (não despesa) — ganho tributário e
preservação de capital. Empresas com caixa abaixo de R$ 100k estão explicitamente fora do ICP.

### Saques parciais têm impacto?

Sim: reduzem o rendimento mensal. Se o rendimento cair abaixo do total das assinaturas ativas,
o cliente recebe notificação para ajustar o colateral ou pausar serviços.

---

## 5. Negócio: preço, ICP e mercado

### Qual é o modelo de receita?

**5% do yield gerado**, deduzido no `claim_yield` (split on-chain 95/5). Sem custo fixo para o
cliente — a plataforma só ganha se o colateral render. Incentivo alinhado por construção.

### Unit economics?

| Cenário | Colateral | Yield anual (12% a.a.) | Receita Y2P (5%) |
|---|---|---|---|
| Startup pequena | R$ 50k | R$ 6.000 | R$ 300/ano |
| Startup média | R$ 500k | R$ 60.000 | R$ 3.000/ano |
| Scale-up | R$ 5M | R$ 600.000 | R$ 30.000/ano |

100 clientes médios ≈ R$ 300k/ano. 1.000 clientes ≈ R$ 3M/ano, sem custo marginal relevante
(o split é on-chain).

### Quem é o ICP primário?

Startups tech Series A/B no Brasil: 20–200 funcionários, R$ 2M–50M ARR, R$ 200k–5M de caixa
ocioso, R$ 5k–80k/mês de pilha SaaS. Decisor: CFO, Head of Finance ou cofundador com papel
financeiro.

### Quem evitar (por ora)?

Empresas com caixa < R$ 100k, empresas tradicionais sem pilha SaaS expressiva, e crypto-natives
(seriam early adopters, mas não a massa crítica).

### Qual é a North Star metric?

**TVL** (soma do colateral ativo). Secundárias: clientes ativos, yield gerado mensal, receita
do fee. Saúde: tempo de onboarding, NPS, churn de colateral.
Meta de 12 meses: R$ 5M em TVL, 100 clientes ativos, < 5% churn mensal de colateral.

### Existe concorrente direto?

Segundo a varredura no Stellar Community Fund e no Ecosystem Directory: **não** no ecossistema
Stellar. Os projetos próximos focam em infraestrutura pura (DeFindex, Blend) ou antecipação de
recebíveis (RWA). O Yield2Pay atua na ponta de consumo, captando TVL estável do mundo real.

### Quais canais de aquisição estão planejados?

- **Fase 1 (0–50 clientes):** founder-led sales, warm intros, comunidades de startups, LinkedIn
  do founder, parceiros contábeis. Explicitamente **sem** ads pagos nem PR.
- **Fase 2 (50–500):** integração com plataformas financeiras (Conta Simples, Cora, Stark Bank),
  programa de parceiros contábeis, SEO, calculadora pública de colateral.
- **Fase 3 (500+):** parcerias com VCs, expansão LATAM (México via Etherfuse), whitelabel para
  bancos digitais.

---

## 6. Vertical Famílias (`/family`)

### O que é a vertical de famílias?

Uma adaptação da mesma tese para pessoa física: a família deposita uma quantia, o rendimento
paga Netflix, Spotify, academia, escola de inglês; o principal continua da família e pode ser
sacado a qualquer momento por Pix.

### Ela está ligada ao backend?

**Não.** É front puro. O store (`_lib/familyStore.ts`) é um módulo externo lido com
`useSyncExternalStore` e persistido em `localStorage` sob a chave `y2p:family:v1`. Privy e
DeFindex entram depois — quando entrarem, o store passa a hidratar da API e as telas não mudam.

### O que é o "Percentual de Liberdade"?

A métrica central da vertical: quanto das assinaturas da casa o rendimento do depósito já cobre.

```
freedomPercent = min(100, round(rendimentoMensal / totalMensal × 100))
```

Implementado em [`familyMath.ts`](../apps/web/src/app/family/_lib/familyMath.ts).

### Como funciona a cobertura conta a conta?

A lista de assinaturas é **ordenada por prioridade**. O rendimento cobre de cima para baixo:
uma conta só é marcada como "coberta" quando o **acumulado até ela** cabe dentro do rendimento
mensal (`coverageRows`). Há tolerância de R$ 0,005 para evitar que arredondamento de centavo
marque como descoberta uma conta que fecha exatamente no rendimento.

Para cada linha, a tela também mostra `cumNeeded` (depósito que cobre essa conta e as acima) e
`missing` (quanto ainda falta depositar).

### Quais telas existem?

| Rota | O que é |
|---|---|
| `/family` | Landing com hero, calculadora de liberdade, "como funciona" em 3 passos, waitlist |
| `/family/onboarding` | Login + primeiro depósito |
| `/family/dashboard` | Painel: percentual de liberdade, movimentações, lista de assinaturas |
| `/family/dashboard/[subId]` | Detalhe de uma assinatura: coberta ou quanto falta |
| `/family/deposito` | Depósito por Pix |
| `/family/saque` | Saque |
| `/family/conceitos` | "Entenda como funciona": 3 conceitos em acordeão + FAQ |
| `/family/configuracoes` | Perfil, acesso e segurança, carteira, Pix, assinaturas, notificações, privacidade |

### Que cenários de rendimento a calculadora oferece?

Três, escolhidos pelo usuário: **6%, 8% ou 10% a.a.** (default 8). Toda tela de simulação carrega
a nota "cenário escolhido por você, não é promessa de resultado".

### Quais são os defaults do mock?

Assinaturas: Netflix R$ 59,90 (dia 5), Spotify Família R$ 34,90 (dia 8), ChatGPT R$ 107 (dia 12),
Academia R$ 129,90 (dia 10). Depósito semeado no fim do onboarding sem valor digitado:
`SEED_DEPOSIT = R$ 30.000`.

### A vertical Famílias é bilíngue?

Sim, PT/EN, via [`familyI18n.ts`](../apps/web/src/app/family/_lib/familyI18n.ts). O PT é cópia
literal do design (`design/nemPages/Yield2Pay Famílias*.dc.html`); as telas internas só existem
em PT no design, e a versão EN segue o mesmo tom.

---

## 7. Arquitetura e stack

### Qual é a estrutura do monorepo?

```
FixEarn/
├── apps/
│   ├── api/          → Backend NestJS 11 + Prisma + Postgres
│   └── web/          → Frontend Next.js 16 (App Router)
├── packages/
│   └── shared/       → Tipos/DTOs compartilhados (@yield2pay/shared)
├── design/           → Design system (tokens, componentes, UI kits, referência)
├── docs/             → Documentação técnica, deploy, planos
├── docker-compose.yml→ Postgres local (porta 5433)
├── render.yaml       → Blueprint de produção
└── pnpm-workspace.yaml
```

Gerenciado por **pnpm workspaces** (`pnpm@10.33.2`).

### Por que monorepo?

Frontend, backend e os tipos do contrato evoluem juntos. `packages/shared` garante que cliente e
servidor falem o mesmo formato de DTO em tempo de compilação, sem versionar um SDK à parte.

### Qual é a stack completa?

**NestJS 11 · Prisma 7 · Postgres 16 · Next.js 16 · React 19 · Privy · DeFindex SDK ·
Stellar SDK · pnpm · Vitest**.

### O que tem em `packages/shared`?

Só tipos TS, sem runtime: `BillType`, `Bill`, `CreateBillDto`, `RegisterWalletDto`,
`BuildTxResponse`, `SubmitTxDto`, `SpendableView`.

### O que tem em `design/`?

O design system, engenheirado a partir da landing real (não é export de Figma vivo):
`tokens/` (CSS `--fx-*`), `components/`, `ui_kits/` (telas HTML de alta fidelidade),
`guidelines/`, `reference/`, `docs/` (filosofia "private bank, digital"). Fica fora do contexto
Docker via `.dockerignore`.

---

## 8. Backend em detalhe

### Como o backend está organizado?

Camadas **Controller → Service → (Prisma / SDK externo)**, com um módulo por domínio:

| Módulo | Papel |
|---|---|
| `config/` | Validação de env com Zod — o app **falha no boot** se faltar variável |
| `prisma/` | `PrismaService` (ciclo de conexão, adapter Postgres) |
| `auth/` | `AuthGuard`: verifica JWT do Privy e faz upsert da Company no login |
| `company/` | Ciclo de vida da Company (upsert idempotente por `privyUserId`) |
| `wallet/` | Registro 1:1 do endereço Stellar; cria e financia a conta on-chain |
| `vault/` | Wrapper do SDK DeFindex (build deposit/withdraw, APY, posição) |
| `stellar/` | Fee-bump sponsor, criação de conta, saldo on-chain, submit + polling na Soroban RPC |
| `deposit/` | Fluxo de depósito (funde cliente → build XDR → assina → submete) |
| `withdraw/` | Fluxo de saque (espelho do depósito) |
| `ramp/` | Integração Etherfuse: onboarding, on-ramp, off-ramp, claim, burn |
| `bills/` | CRUD de assinaturas recorrentes, escopo por company |
| `ledger/` | Estado financeiro: principal, valor do cofre, spendable, saldo nativo |
| `jobs/` | Cron diário (snapshot do estado de cada company às 2h UTC) |
| `health/` | `GET /health` |
| `common/` | Utilitários puros (parse-money em base units) |

### Quais são os endpoints da API?

| Método | Rota | Módulo |
|---|---|---|
| `GET` | `/health` | health |
| `GET` | `/dashboard` | ledger |
| `POST` / `GET` / `DELETE :id` | `/bills` | bills |
| `POST` | `/wallet` | wallet |
| `GET` | `/wallet/balance` | wallet |
| `POST` | `/deposit/build`, `/deposit/submit` | deposit |
| `POST` | `/withdraw/build`, `/withdraw/submit` | withdraw |
| `GET` | `/ramp/status`, `/ramp/assets`, `/ramp/orders`, `/ramp/order/:orderId` | ramp |
| `POST` | `/ramp/setup`, `/ramp/kyc-approved` | ramp |
| `POST` | `/ramp/onramp/start`, `/ramp/onramp/simulate` | ramp |
| `POST` | `/ramp/offramp/start` | ramp |
| `GET`/`POST` | `/ramp/order/:orderId/claim`, `/ramp/order/:orderId/burn` | ramp |

### Qual é o modelo de dados?

| Modelo | Para que serve | Campos-chave |
|---|---|---|
| `Company` | Conta da empresa (1:1 com usuário Privy) | `privyUserId` (único) |
| `Wallet` | Endereço Stellar da company (1:1) | `stellarAddress` (único) |
| `Deposit` | Histórico de depósitos/saques | `amount` (BigInt, negativo = saque), `txHash` (único), `rampOrderId` |
| `RecurringBill` | Assinaturas (software/utility/other) | `vendor`, `monthlyCost` (BigInt), `type`, `status` |
| `YieldSnapshot` | Estado diário | `vaultValue`, `principal`, `spendable` (BigInt) |
| `EtherfuseCustomer` | Vínculo company ↔ Etherfuse | `customerId`, `bankAccountId`, `walletId`, `kycStatus` |
| `RampOrder` | Order de on/off-ramp | `orderId` (único), `type`, `status`, `amountFiat`, `amountToken`, `burnTransaction` |

### Por que `BigInt` em vez de float?

Dinheiro nunca em ponto flutuante. Valores são inteiros na menor unidade da stablecoin
(**7 decimais**, padrão Stellar/USDC). Um shim `BigInt.prototype.toJSON` em `main.ts` serializa
para string no JSON da API.

### Como funciona o snapshot diário?

`jobs/` roda um cron às **2h UTC** que materializa o estado de cada company (vaultValue,
principal, spendable) em `YieldSnapshot`, em execução paralela por company. Serve para
histórico e gráficos sem recalcular tudo on-the-fly.

### O que é o `DEMO_YIELD_BPS`?

Uma env opcional (default 0) que injeta rendimento **sintético** no `LedgerService` para demo.
Com `DEMO_YIELD_BPS > 0`, o dashboard mostra yield mesmo sem rendimento real no cofre.
`DEMO_RETURNS_CHANGE_PERCENT` (default `3.2`) controla a variação exibida vs. mês anterior.

### Quais envs o backend exige?

Obrigatórias (validadas por Zod em `config/env.ts`): `DATABASE_URL`, `PRIVY_APP_ID`,
`PRIVY_APP_SECRET`, `DEFINDEX_API_KEY`, `DEFINDEX_BASE_URL`, `VAULT_ADDRESS`, `USDC_ADDRESS`,
`STELLAR_NETWORK` (`testnet` | `public`), `SOROBAN_RPC_URL`, `FEE_SPONSOR_SECRET_KEY`.

Opcionais: `PORT` (3000), `CORS_ORIGIN`, `DEMO_YIELD_BPS` (0), `DEMO_RETURNS_CHANGE_PERCENT`,
`ETHERFUSE_API_KEY`, `ETHERFUSE_BASE_URL` (sandbox), `ETHERFUSE_CUSTOMER_ID`,
`ETHERFUSE_FIAT_CURRENCY` (`BRL` | `MXN`, default `BRL`).

---

## 9. Frontend em detalhe

### Como as rotas estão organizadas?

```
apps/web/src/app/
├── page.tsx        → Landing pública B2B (bilíngue EN/PT)
├── login/          → Login (Google OAuth via Privy)
├── tokens/         → Design tokens em CSS custom properties (--fx-*)
├── (app)/          → Route group autenticado (AuthGate + LangProvider)
│   ├── dashboard/  → MoneyPanel, StatCards, barra de rendimento, catálogo, cartão virtual
│   ├── deposit/    → Wizard de 3 passos (valor → ferramentas → confirmar)
│   └── withdraw/   → Fluxo de saque
└── family/         → Vertical de famílias (mock, ver seção 6)
```

A landing e o login ficam **fora** do gate — públicos e leves.

### Por que não tem Tailwind?

Estilo via **design tokens** (CSS custom properties) + estilos inline. Estética "private bank":
monocromático preto/prata, superfícies brushed-metal, dark mode. Até o gráfico do dashboard é
CSS puro — não há biblioteca de gráficos.

### Como a autenticação funciona no cliente?

Privy: login Google cria a embedded wallet Stellar no cliente (`useWallet`), e só o **endereço**
é registrado no backend. `lib/api.ts` é uma fábrica que injeta o JWT do Privy no header de toda
chamada. Assinatura via `useSignRawHash`.

### Como uma transação é montada e enviada?

O hook `useStellarTx` orquestra **build → assina → submete**, reusando o backend: pede o XDR em
`/deposit/build` (ou `/withdraw/build`), coleta a assinatura no Privy e envia para
`/deposit/submit`. Hooks derivados: `useDepositFlow`, `useWithdrawFlow`.

### Quais serviços existem no catálogo?

| Serviço | Categoria | Custo mensal (USDC) |
|---|---|---|
| OpenAI | IA | $49.90 |
| Anthropic Claude | IA | $99.00 |
| Midjourney | IA | $59.00 |
| Notion | Produtividade | $24.90 |
| Slack | Produtividade | $9.50 |
| Figma | Produtividade | $39.90 |
| GitHub | Dev | $21.00 |
| Linear | Dev | $16.00 |

Definidos em `serviceCatalog.ts`; a ativação cria um `RecurringBill` via API.

### O frontend é responsivo e bilíngue?

Sim. i18n próprio EN/PT e `useIsMobile` (breakpoint 768px), incluindo drawer de depósito/saque
in-page no mobile.

---

## 10. Integrações externas

### O que cada integração faz?

| Integração | Papel |
|---|---|
| **Privy** | Identidade + embedded wallet. Login Google/e-mail corporativo, chave fragmentada por SSS. Sem seed phrase, sem Freighter. |
| **Etherfuse Ramp API** | Rampa bancária BRL ↔ USDC via Pix. Quote → order → Pix → claimable balance. KYC/KYB hosted. |
| **DeFindex (Soroban)** | Motor de rendimento. Cofres indexados que capturam o melhor APY da rede. |
| **Stellar / Soroban RPC** | Rede base. Criação de conta, fee-bump, submit + polling de transações. |

### Por que Stellar?

É a rede que entrega os três pilares de forma nativa: rampa fiat regulada via Pix, DeFi de
stablecoin de baixo custo (Soroban + DeFindex) e taxas desprezíveis — essenciais para um modelo
que faz micro-resgates de yield todo mês.

### A integração Etherfuse já existe no código?

Sim — o módulo `apps/api/src/ramp/` está implementado (`etherfuse.client.ts`, `ramp.service.ts`,
`ramp.controller.ts`), com o commit `2e898a0` unificando depósito/saque num fluxo Pix.
**O README ainda descreve a rampa como "não codada" — está desatualizado nesse ponto.**

### O que acontece se `ETHERFUSE_API_KEY` não estiver definida?

O cliente entra em **mock mode** automático: loga um warning, devolve `mock-customer`,
`mock-wallet`, `mock-bank` e simula a progressão de status da order localmente
(`POST /ramp/onramp/simulate` avança para `funded`). Permite rodar o fluxo inteiro sem
credencial real.

### O ramp suporta México?

Sim, parcialmente: `ETHERFUSE_FIAT_CURRENCY` aceita `BRL` (Pix) ou `MXN` (SPEI). O campo
`depositClabe` do `RampOrder` é herança do modelo MX-cêntrico da API da Etherfuse.

### Que eventos on-chain o contrato próprio vai emitir?

Especificados (ainda não implementados):

```
DepositCollateral(client: Address, amount: u128)
YieldClaimed(provider: Address, provider_share: u128, protocol_share: u128)
SubscriptionCanceled(client: Address, principal_returned: u128)
```

---

## 11. Rodar e testar localmente

### Como subo o projeto?

```bash
pnpm install
pnpm db:up            # Postgres local (porta 5433)
pnpm db:migrate       # aplica as migrations
pnpm dev:app          # web + api em paralelo
```

Configure `apps/api/.env` e `apps/web/.env.local` a partir dos respectivos `*.example`.
Sem `NEXT_PUBLIC_PRIVY_APP_ID`, só a landing pública renderiza.

### Por que a porta do Postgres é 5433?

Para não conflitar com um Postgres do host rodando na 5432.

### Quais scripts existem na raiz?

`dev:web`, `dev:api`, `dev:app`, `db:up`, `db:down`, `db:generate`, `db:migrate`, `db:studio`,
`api:dev`, `api:test`.

### Qual runner de teste é usado?

**Vitest** nos dois apps. No backend, migrado do Jest com `unplugin-swc` para suportar os
decorators do Nest. No frontend, Vitest + Testing Library.

### Qual é o estado da bateria de testes?

Última medição registrada (`docs/CHECKLIST-TESTES-INTEGRACOES.md`, 28/06/2026 — reconfira antes
de citar como número atual):

- **Web:** 87/87 passando.
- **API (unit):** 54/54 — a suíte `src/**/*.spec.ts` é **hermética**, passa com o Postgres
  parado.
- **API (e2e/integração):** `apps/api/vitest.config.e2e.ts` + script `test:e2e`, cobrindo
  `test/**/*.e2e-spec.ts` e `test/**/*.integration-spec.ts`.

### Como rodo os testes que dependem de infra?

Por *guards* de env:

| Guard | O que destrava |
|---|---|
| `RUN_DB_TESTS=1` | Smoke de conectividade com Postgres (`test/prisma.integration-spec.ts`) — só precisa de banco local |
| `RUN_INTEGRATION=1` | Testes contra a testnet real (`deposit`, `vault`) — precisam de credenciais e conta financiada |

Exemplo: `RUN_DB_TESTS=1 pnpm --filter @yield2pay/api test:e2e`.

### O que os testes de integração servem para fixar?

Três incógnitas de terceiros ainda em aberto:

1. Campo de retorno do `verifyAuthToken` do `@privy-io/server-auth`;
2. Conversão **shares → USDC** em `getPositionValue` (DeFindex) — já implementada via
   `underlyingBalance[0]`, falta confirmar contra o cofre real;
3. Caminho real de `prepare`/`submit` na Soroban RPC (`attachAndSubmit`).

### Existe CI?

**Não.** Não há `.github/workflows/`. É o item 7 do checklist de integrações — quebra entra na
`main` sem trava, e os deploys sobem sem gate de teste.

---

## 12. Deploy e ambientes

### Como o deploy está dividido?

**Split:** frontend na **Vercel** (root directory `apps/web`), backend + Postgres num container
host (**Render** via `render.yaml`; o Dockerfile é portátil para Railway/Fly/qualquer host).

### O que o blueprint do Render provisiona?

Um Postgres gerenciado (`yield2pay-db`) e um serviço Docker (`yield2pay-api`) com health check
em `/health`. `DATABASE_URL` é ligada automaticamente. As migrations rodam sozinhas no start do
container (`prisma migrate deploy`).

### Que segredos preciso preencher manualmente?

No Render (marcados `sync: false`, ou seja, não vão no deploy automático): `PRIVY_APP_ID`,
`PRIVY_APP_SECRET`, `DEFINDEX_API_KEY`, `VAULT_ADDRESS`, `USDC_ADDRESS`,
`FEE_SPONSOR_SECRET_KEY`, `CORS_ORIGIN`.

Na Vercel: `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_API_BASE_URL`.

### Preciso configurar algo no painel do Privy?

Sim — adicionar os domínios da Vercel (`https://<app>.vercel.app` + previews e domínios
customizados) nas *allowed origins*, senão o SDK do Privy se recusa a inicializar em produção.

### O CORS está seguro?

**Não, hoje não.** Sem `CORS_ORIGIN` definido, o backend reflete **qualquer origem** — marcado
como "MVP only" em `main.ts`. Fixar a origem da Vercel antes de produção.

### O que falta para migrar para mainnet?

Cofre DeFindex financiado em mainnet, chave de produção Etherfuse (KYB aprovado +
`ETHERFUSE_BASE_URL=https://api.etherfuse.com`) e `STELLAR_NETWORK=public`.

---

## 13. Estado atual, lacunas e roadmap

### O que já funciona?

O produto roda **end-to-end na testnet Stellar**:

| Componente | Status |
|---|---|
| Autenticação Privy + embedded wallet | ✅ |
| Criação automática de conta Stellar | ✅ |
| Patrocínio de gas via fee-bump | ✅ |
| Depósito / saque no cofre DeFindex | ✅ Testnet |
| Saldo real da carteira on-chain | ✅ |
| Valor real do cofre (DeFindex SDK) | ✅ |
| Ledger financeiro (principal / spendable) | ✅ |
| Catálogo de 8 serviços + CRUD de assinaturas | ✅ |
| Snapshot diário (cron) | ✅ |
| Dashboard Web2 completo, bilíngue e responsivo | ✅ |
| Módulo de ramp Etherfuse (on/off, mock mode) | ✅ Sandbox |
| Telas da vertical Famílias | ✅ Mock (front puro) |

### O que ainda falta implementar?

- **Contrato escrow próprio (Soroban)** — `deposit_collateral`, `claim_yield` com split 95/5,
  `cancel_subscription` e os eventos. Hoje o backend usa o cofre DeFindex direto.
- **Motor de cobrança automatizado** — job que aciona `claim_yield` no vencimento e dispara o
  off-ramp para o provedor. Depende do contrato escrow.
- **Margem de colateral reativa** — detecção de subcolaterização e cobrança residual.
- **Cálculo pro-rata no cancelamento** e revogação de acesso à API por evento on-chain.
- **Ligar a vertical Famílias** ao Privy/DeFindex (hoje é mock em localStorage).
- **Substituir placeholders da UI** por dados reais: saldos da landing, APY fixo (8.4%) na tela
  de depósito, checklist de ativação estático, nome "Acme", cartão virtual e ferramentas
  hardcoded no wizard.

### Quais são as lacunas técnicas conhecidas?

| Lacuna | Onde | Impacto |
|---|---|---|
| CORS reflete **qualquer** origem quando `CORS_ORIGIN` não está definida | [`main.ts:34`](../apps/api/src/main.ts#L34) | Risco de segurança em produção; hoje o `.env` local não define a variável |
| Sem pipeline de CI (não existe `.github/workflows/`) | — | Quebra entra na `main` sem trava; deploys sobem sem gate de teste |
| `DEMO_YIELD_BPS=320` ativo no `.env` local | `apps/api/.env` | O dashboard mostra rendimento **sintético**, não o real do cofre — zerar antes de medir números de verdade |
| Vars `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` fora do `.env.example` e do schema Zod | `.env` / `config/env.ts` | Indefinição: documentar e validar, ou remover |
| README descreve a rampa Etherfuse como "não codada" | `README.md` | Desatualizado — o módulo `apps/api/src/ramp/` existe e está funcional |
| Checklist de integrações marca itens 4 e 5 como abertos | `docs/CHECKLIST-TESTES-INTEGRACOES.md` | Desatualizado — `VAULT_ADDRESS`/`USDC_ADDRESS` já são contratos reais e `getPositionValue` já usa `underlyingBalance[0]` |
| Vertical Famílias sem backend | `apps/web/src/app/family/` | Todo o estado vive em `localStorage`; não há persistência nem carteira real |

### Qual é o caminho crítico do checklist de integrações?

`1 (DB up)` → `2 (unit hermético)` / `3 (runner e2e)` → `4 (vault real em testnet)` →
`5 (getPositionValue de verdade)` + `6 (conta financiada)` → `7 (CI)` → `8–10 (prod)`.

O arquivo marca 1–3 como concluídos, mas o código já avançou além disso: **4 e 5 também estão
feitos** (o `.env` aponta para contratos reais e `getPositionValue` retorna
`underlyingBalance[0]`). Aberto de verdade: **6** (conta financiada para integração),
**7** (CI) e **8–10** (config de produção).

### Qual é o roadmap de produto?

- **Fase 1 — hoje:** assinaturas B2B de valor fixo (DevTools e APIs).
- **Fase 2 — 6 meses:** cobrança variável *pay-as-you-go* (consumo de IA, nuvem) via oráculos
  ou webhooks de faturamento. Yield excedente é reinvestido no colateral; yield insuficiente
  gera débito residual automatizado.
- **Fase 3 — 12 meses:** contas de consumo do mundo real (energia, água, telecom) para
  indústrias, franquias e condomínios, via integração com ERPs e concessionárias.

### Qual é o roadmap de go-to-market?

- **T1–T2 (jul–dez/2026) — Validação:** 10 clientes pagando em mainnet, NPS > 50. Lançar mainnet
  com rampa Etherfuse; onboarding manual acompanhado pelo founder.
- **T3–T4 (jan–jun/2027) — Tração:** 100 clientes ativos, R$ 5M em TVL. Programa de parceiros,
  cadastro self-serve, catálogo para 20+ serviços (AWS, Vercel, Stripe).
- **T5–T6 (jul–dez/2027) — Escala:** 500 clientes, R$ 25M em TVL, Fase 2 (pay-as-you-go),
  expansão México via corredor MXN da Etherfuse.

---

## Convenções do repositório

- **Commits:** não commitar por conta própria — só quando solicitado explicitamente. Agrupar em
  commits maiores em vez de muitos pequenos. **Nunca** adicionar trailer de co-autoria.
- **Idioma:** documentação e comentários de código em português; código, identificadores e
  mensagens de commit em inglês quando for a convenção do arquivo.
- **Dinheiro:** sempre `BigInt` em base units de 7 decimais. Nunca float.
