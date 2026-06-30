# Checklist — Testes & Integrações (Yield2Pay / FixEarn)

> Levantado em 2026-06-28. Ordem é **por dependência**: cada item destrava o
> próximo. Resolva de cima para baixo — tentar um item adiante sem o anterior
> trava ou dá falso-verde.
>
> Estado atual da bateria:
> - Web (`apps/web`): **87/87 passando** ✅
> - API (`apps/api`): **54/55** — 1 falha (`prisma.service.spec`) por falta de
>   Postgres vivo, não por bug.
> - e2e + integração (`apps/api/test/*`): **0 rodam** — sem runner ligado.

---

## P0 — Fundação (sem isto, nada de teste/integração roda confiável)

### [x] 1. Subir o Postgres local antes de testar a API ✅ (2026-06-28 — 55/55)
- **Problema:** `apps/api/src/prisma/prisma.service.spec.ts` faz `SELECT 1`
  contra um banco real. Sem o container, `pnpm api:test` falha em
  `Can't reach database server at 127.0.0.1:5433`.
- **Fazer:** `pnpm db:up` (sobe o `postgres:16` do `docker-compose.yml`, porta
  host **5433**), depois `pnpm db:migrate` para aplicar as migrations.
- **Verificar:** `pnpm api:test` deve sair **55/55**.
- **Destrava:** itens 2, 3, 6.

### [x] 2. Decidir o que fazer com o teste que exige banco ✅ (2026-06-28)
- **Resolvido (opção a):** o spec de conectividade saiu de
  `src/prisma/prisma.service.spec.ts` e virou
  `test/prisma.integration-spec.ts`, com guard `RUN_DB_TESTS=1`
  (`describe.skip` quando ausente). A suíte unit `src/**/*.spec.ts` agora é
  **hermética: 54/54 com o Postgres parado**.
- **Como rodar o smoke de banco:** `pnpm db:up` e então
  `RUN_DB_TESTS=1 ... test:e2e` (runner vem no item 3). Guard próprio
  (`RUN_DB_TESTS`, não `RUN_INTEGRATION`) porque só precisa de Postgres local,
  sem credencial on-chain → roda no CI com service container.
- **Destrava:** 7.

---

## P1 — Ligar os testes que hoje não rodam + credenciais de integração

### [x] 3. Dar um runner aos specs de `test/` (e2e + integração órfãos) ✅ (2026-06-28)
- **Resolvido:**
  - Criado `apps/api/vitest.config.e2e.ts` incluindo `test/**/*.e2e-spec.ts` +
    `test/**/*.integration-spec.ts`.
  - Script `test:e2e` em `apps/api/package.json`
    (`vitest run --config vitest.config.e2e.ts`).
  - Comentários `jest` obsoletos dos specs de integração trocados pelo comando
    vitest correto.
- **Verificado (com `pnpm db:up`):**
  - `pnpm --filter @yield2pay/api test:e2e` → **2 passam** (`bootstrap.e2e`,
    `health.e2e`) + 3 skip.
  - `RUN_DB_TESTS=1 ... test:e2e` → **3 passam** (+ `prisma.integration`).
  - `deposit`/`vault` integration seguem em skip (guard `RUN_INTEGRATION`) até
    credenciais de testnet → itens 4/6.
  - Unit segue hermética (54/54).
- **Destrava:** 4, 5, 7.

### [ ] 4. Trocar VAULT_ADDRESS e USDC_ADDRESS dummy por contratos reais (testnet)
- **Problema:** hoje `apps/api/.env` tem `VAULT_ADDRESS=C_DUMMY...` e
  `USDC_ADDRESS=C_DUMMY...`. Todo fluxo on-chain (deposit, withdraw, posição do
  vault, snapshot job) quebra. No log de teste o `SnapshotJob` já falha com
  `snapshot failed for co_1: Error: rpc`.
- **Fazer:** obter o endereço real do vault DeFindex em **testnet** + o contrato
  USDC de testnet e preencher `.env` (e os env vars do Render — hoje `sync:false`).
- **Verificar:** `getPositionValue` deixa de cair no RPC dummy; snapshot roda.
- **Depende de:** ter conta DeFindex (a `DEFINDEX_API_KEY` no `.env` já parece
  real: `sk_...`). **Destrava:** 5, 6.

### [ ] 5. Implementar `getPositionValue` de verdade (tirar o PLACEHOLDER)
- **Problema:** `apps/api/src/vault/vault.service.ts:111` retorna dfTokens
  (shares) crus e **se recusa a reportar em mainnet** ("shares→USDC conversion
  not yet implemented"). O valor de saldo no dashboard é placeholder.
- **Fazer:** usar a conversão shares→USDC subjacente do SDK
  (`sdk.getVaultBalance(...).underlyingBalance[0]` ou método dedicado), conforme
  o cabeçalho de `test/vault.integration-spec.ts`.
- **Verificar:** rodar `vault.integration-spec` com `RUN_INTEGRATION=1` contra o
  vault de testnet seedado — deve passar.
- **Depende de:** 3 (runner) + 4 (vault real).

### [ ] 6. Credenciais + conta financiada para os testes de integração
- **Problema:** `deposit.integration-spec` precisa de uma conta testnet
  **financiada** e do mapeamento company→wallet. Variáveis exigidas:
  `TEST_SECRET_KEY` (conta Stellar financiada), `TEST_COMPANY_ID`,
  `TEST_USER_ADDRESS`, além de `VAULT_ADDRESS`/`USDC_ADDRESS`/`DEFINDEX_API_KEY`.
- **Fazer:** gerar keypair de testnet, financiar via friendbot, seedar uma
  company com wallet apontando para essa conta, exportar as vars.
- **Verificar:** `RUN_INTEGRATION=1 pnpm --filter @yield2pay/api test:e2e` passa o
  fluxo deposit build→sign→submit→assert.
- **Depende de:** 1, 3, 4. **Destrava:** confiança no fluxo on-chain ponta-a-ponta.

### [ ] 7. Pipeline de CI (não existe `.github/workflows/`)
- **Problema:** nenhum CI. Quebra entra na `main` sem trava (hoje já há 1 teste
  vermelho local). Deploys (Render/Vercel) sobem sem gate de teste.
- **Fazer:** workflow no push/PR que rode: `pnpm install --frozen-lockfile`,
  lint, **unit** (`api:test` hermético + web `test`), e `build` das duas apps.
  Opcional: job separado de e2e com Postgres como service container.
- **Verificar:** PR de teste mostra os checks verdes.
- **Depende de:** 2 (unit hermético) e idealmente 3.

---

## P2 — Configuração para produção / deploy

### [ ] 8. Confirmar o PRIVY_APP_SECRET (parece placeholder)
- **Problema:** `apps/api/.env` tem `PRIVY_APP_SECRET=privy_...`. Não é o literal
  do `.env.example`, mas o prefixo levanta dúvida. `verifyAuthToken` (auth guard)
  depende dele — se for inválido, **todo endpoint autenticado rejeita** em prod.
- **Fazer:** validar contra o painel Privy; rodar `bootstrap.e2e-spec`/`health`
  com um token real. Garantir que o `PRIVY_APP_ID` casa com o do front
  (`NEXT_PUBLIC_PRIVY_APP_ID`).

### [ ] 9. Origens permitidas no painel Privy + CORS de produção
- **Fazer:** adicionar os domínios Vercel (`https://<app>.vercel.app` + previews)
  nas allowed origins do Privy (senão o SDK não inicializa em prod) e setar
  `CORS_ORIGIN` no Render para a origem web. Ver `docs/DEPLOY.md` §1 e §3.
- **Depende de:** 8.

### [ ] 10. Segredos do Render preenchidos (`sync:false`)
- **Fazer:** no painel Render, preencher `PRIVY_APP_ID`, `PRIVY_APP_SECRET`,
  `DEFINDEX_API_KEY`, `VAULT_ADDRESS`, `USDC_ADDRESS`, `FEE_SPONSOR_SECRET_KEY`,
  `CORS_ORIGIN` — todos marcados `sync:false` no `render.yaml`, ou seja, **não
  vão no deploy automático**. Migrations rodam sozinhas no start do container.
- **Depende de:** 4, 8.

---

## P3 — Higiene (não bloqueia, mas vale)

### [ ] 11. README do `apps/web` ainda é boilerplate do create-next-app
- Substituir pelo setup real (envs, `pnpm dev:web`, link pro `docs/DEPLOY.md`).

### [ ] 12. Variáveis Google no `.env` sem documentação
- `apps/api/.env` e `apps/web/.env.local` têm `GOOGLE_CLIENT_ID` /
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` que **não estão** nos `.env.example` nem no
  `env.ts` (schema zod). Decidir: documentar e validar no schema, ou remover.

---

### Caminho crítico (resumo)
`1 (DB up)` → `2 (unit hermético)` / `3 (runner e2e)` → `4 (vault real)` →
`5 (getPositionValue)` + `6 (conta financiada)` → `7 (CI)` → `8–10 (prod)`.
