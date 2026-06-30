# Yield2Pay

### Seu caixa ocioso paga o seu software. E o caixa continua sendo seu.

> **OpEx Zero para o mercado B2B.** Empresas travam um colateral em stablecoins; o
> *rendimento* desse colateral quita assinaturas de SaaS e APIs em tempo real; o
> *principal volta 100%* no cancelamento. Tudo sem chave privada, sem seed phrase e sem
> blockchain à vista — pura experiência Web2.
>
> **Rede:** Stellar (Soroban) · **Trilha:** Soroban DeFi, RWA & Web2.5

---

## O problema

Toda empresa de tecnologia queima caixa todo mês em mensalidade de SaaS e API: gateway de
pagamento, dados, autenticação, IA, nuvem. Esse dinheiro **sai do balanço** e vira despesa
pura — nunca mais volta.

Ao mesmo tempo, a tesouraria dessas mesmas empresas tem **caixa parado rendendo abaixo da
inflação**. Capital ocioso de um lado, despesa recorrente do outro. Ninguém conecta os dois.

## A sacada

E se a empresa nunca *gastasse* para pagar software — só emprestasse o caixa para si mesma?

O Yield2Pay faz exatamente isso:

1. A empresa **trava um colateral** em stablecoin num cofre DeFi.
2. Só o **rendimento** desse colateral paga a assinatura, mês a mês.
3. O **principal nunca é tocado** — fica disponível para resgate integral via Pix quando a
   empresa cancelar o serviço.

Resultado: a despesa de software deixa de ser custo afundado e vira **capital preservado**.
A empresa para de queimar caixa sem perder acesso a nenhuma ferramenta.

## A matemática (simples e auditável)

O colateral mínimo é a equivalência entre a mensalidade fixa e o rendimento anual:

```
Colateral = (Mensalidade × 12) / APY_anual
```

**Exemplo real:** uma API de **R$ 500/mês** (R$ 6.000/ano), com APY conservador de **12% a.a.**

→ colateral de **R$ 50.000**. O rendimento de R$ 6.000/ano cobre as 12 mensalidades.
**Os R$ 50.000 permanecem intactos** e voltam inteiros no cancelamento.

A empresa troca uma despesa anual de R$ 6.000 por um capital de R$ 50.000 que continua sendo
dela. Para uma tesouraria com caixa ocioso, é eficiência tributária e preservação de capital —
não um gasto.

---

## Por que isso só funciona agora (e por que na Stellar)

O segredo é **esconder a blockchain atrás da Web2** — o tripé Web2.5:

| Pilar | Como | O que resolve |
|---|---|---|
| **Identidade & Carteira** — *Privy* | Login com Google/e-mail corporativo cria uma carteira embutida. Chave fragmentada (SSS): só o usuário assina. | Zero seed phrase, zero extensão de navegador. O time financeiro entra como entra em qualquer SaaS. |
| **Rampa bancária** — *Stellar Anchors (SEP-24)* | Cliente paga um **Pix** comum; o Anchor licenciado converte fiat → stablecoin. | KYC/AML e contato com dinheiro fiduciário ficam 100% no Anchor regulado. A plataforma nunca toca em BRL. |
| **Motor de rendimento** — *DeFindex (Soroban)* | O colateral é direcionado a cofres indexados que capturam o melhor APY da rede. | Rendimento real, on-chain, sem o cliente precisar entender DeFi. |

A Stellar é a única rede que entrega os três de forma nativa: rampa fiat regulada via Pix
(Anchors/SEP-24), DeFi de stablecoin de baixo custo (Soroban + DeFindex) e taxas de transação
desprezíveis — essenciais para um modelo que faz micro-resgates de yield todo mês.

## Não-custodial por design (a blindagem)

Ninguém — nem a plataforma, nem o Privy, nem o Anchor — consegue mover o dinheiro do cliente
sozinho:

- **Chaves:** fragmentadas por SSS no Privy. A transação só existe com a autenticação do
  usuário final. Isso descaracteriza custódia.
- **Fiat:** o fluxo de Pix, emissão de stablecoin e KYC é todo do Anchor licenciado pelo
  Banco Central. Isso descaracteriza intermediação financeira.
- **Fundos on-chain:** o contrato é um escrow sem permissão (*trustless*). **Não existem admin
  keys** que permitam desviar, travar ou sacar o colateral.

O backend só **monta** a transação (XDR) e **submete** a assinatura que veio do cliente. A
chave privada nunca passa pelo servidor.

---

## Como funciona, ponta a ponta

**Entrada (Pix → cofre):** o app gera um canal On-Ramp SEP-24 → cliente paga o Pix → o Anchor
emite a stablecoin na carteira → duas transações pré-assinadas (allowance + deposit) movem o
colateral para o cofre DeFindex.

**Pagamento (o yield quita a API):** no vencimento, o protocolo resgata **só o lucro** do
período, faz o split de receita e aciona o Off-Ramp (o Anchor envia Pix ao provedor da API).
O principal não é tocado.

**Saída (cancelamento):** cliente assina o cancelamento → o cofre devolve o principal →
cálculo pro-rata do yield dos dias usados → Pix de devolução para o CNPJ da empresa. O acesso à
API é revogado lendo o evento on-chain.

---

## O diferencial: mercado em branco

Uma varredura no Stellar Community Fund e no Ecosystem Directory mostra que **não existe
concorrente executando isso no ecossistema**. Os projetos atuais focam em infraestrutura pura
(DeFindex, Blend) ou em antecipação de recebíveis (RWA).

O Yield2Pay atua na **ponta de consumo**: é uma camada que capta **TVL estável vinda do mundo
real** — o caixa de empresas de tecnologia — e a injeta no DeFi de Soroban. Cada cliente novo é
liquidez nova, durável e não-especulativa, para todo o ecossistema Stellar.

## Modelo de negócio

Monetização embutida no próprio contrato, no momento do `claim_yield`:

- **95%** do rendimento → carteira do provedor da API.
- **5%** → tesouraria do Yield2Pay.

Sem mensalidade para o cliente, sem custo de aquisição embutido: a plataforma só ganha quando o
colateral gera rendimento. Incentivo perfeitamente alinhado.

---

## O que já está construído (MVP do hackathon)

O esqueleto Web2.5 está **de pé e rodando**:

- ✅ Autenticação Privy + carteira embutida (login Google) e registro de endereço Stellar.
- ✅ Depósito e saque reais no cofre **DeFindex** (build XDR → assina no cliente → submete na
  Soroban RPC).
- ✅ Ledger financeiro: principal, valor do cofre e **yield gastável** (spendable).
- ✅ CRUD de assinaturas recorrentes, com escopo por empresa.
- ✅ Snapshot diário do estado (cron) para histórico e gráficos.
- ✅ UI completa, estética *private bank* (dashboard, wizard de depósito, saque), bilíngue
  EN/PT e responsiva.

**Stack:** NestJS 11 · Prisma 7 · Postgres 16 · Next.js 16 · React 19 · Privy · DeFindex SDK ·
Stellar SDK · pnpm · Vitest. Monorepo com contrato de tipos compartilhado ponta a ponta.

**Próximos passos (pós-MVP):** contrato escrow próprio com `claim_yield`/split/`cancel`,
rampa fiat SEP-24 (QR Pix), motor de cobrança automatizado e margem de colateral reativa.

---

## A visão

O DevTools/API é só a porta de entrada — o nicho de valor fixo, fácil de modelar.

- **Fase 1 — hoje:** assinaturas B2B de valor fixo (DevTools e APIs).
- **Fase 2 — 6 meses:** cobrança variável *pay-as-you-go* (consumo de IA, nuvem) via oráculos;
  yield excedente é reinvestido no colateral do cliente.
- **Fase 3 — 12 meses:** contas de consumo do mundo real — energia, água, telecom — para
  indústrias, franquias e condomínios. O maior caso de utilidade real e captação de TVL da
  história da rede Stellar.

> **Yield2Pay transforma o caixa ocioso do mercado de tecnologia em liquidez perpétua para o
> DeFi de Soroban — e devolve à empresa um custo que ela achava que nunca mais ia ver.**
