# Revisão do backend: core, problemas e redundâncias (2026-10-22)

Análise feita por leitura do código em `apps/api/src`, cruzando com as rotas que o `apps/web` chama. Não houve execução de testes.

## Classificação dos arquivos

**Motores (core):** fluxo de dinheiro `auth → ramp/etherfuse → stellar → vault → ledger` (+ `deposit`, `withdraw`) e controle de gastos `household → expenses/statements → summary.math`. Mais `prisma/schema.prisma`.

**Suporte de domínio:** `statements/parse-*.ts`, `expenses/classify.ts`, `summary/summary.service.ts`, `wallet/wallet.service.ts`, `company/company.service.ts`, `jobs/snapshot.job.ts`, `config/env.ts`, `common/all-exceptions.filter.ts`, `bills/`, `lessons/`.

**Helpers/infra:** `common/*` (parse-money, format-amount, reserve, error-id), `expenses/parse-amount.ts`, `*.errors.ts`, controllers, modules, `main.ts`, `prisma.service.ts`, `health/`.

## Uso real

Todos os módulos críticos estão em uso. Código morto ou legado:

- `StellarService.fundClient()`: não é chamado em lugar nenhum.
- `/wallet/balance`: lê o saldo XLM nativo, mas o cofre hoje é USDC.
- `RampService.markKycApproved`, o campo `amountMxn` e os parâmetros `email`/`displayName` de `startOnboarding`: não usados ou mantidos só por compatibilidade.

## Problemas

| Gravidade | Arquivo | Problema |
|---|---|---|
| Alta | `deposit.service.ts`, `withdraw.service.ts` | `submit` grava no ledger o `dto.amount` enviado pelo cliente, não o valor da transação. Isso permite manipular `principal` e `spendable` |
| Alta | `stellar.service.ts` `attachAndSubmit` | Não confere se o XDR enviado é o que o servidor montou: o sponsor paga taxa de qualquer transação |
| Alta | `auth.guard.ts` | `console.log` imprime prefixo do bearer token em toda requisição |
| Média | `auth.guard.ts` | Chama `privy.getEmail` (HTTP) e faz upsert em toda requisição |
| Média | `expenses.service.ts` `patch` | Não valida `category` (coluna `String` aceita qualquer valor) |
| Média | `withdraw.service.ts` | Sem limite máximo nem checagem contra a posição |
| Média | `ramp.controller.ts` | `onramp/simulate` não é bloqueado fora do sandbox; `startOnramp` usa `'0'` quando o valor não vem |
| Média | `household.service.ts` | `create`/`acceptInvite` sem transação; quando o dono sai sozinho, família e convites ficam órfãos |
| Baixa | `statements.service.ts` | Uma consulta por linha do extrato (N+1); CSV/OFX vazio cria extrato e bloqueia reimportação |
| Baixa | `ramp.service.ts` | Mensagem fixa "conta MXN" com moeda configurável |
| Baixa | `vault.service.ts` | `console.warn` em vez de `Logger`; comentários falam de XLM |
| Baixa | `snapshot.job.ts` | Concorrência sem limite |

## Redundâncias

- `deposit.service` × `withdraw.service`: `build`/`submit` quase idênticos.
- `ramp.service`: claim × burn (get/submit), início de `startOnramp` × `startOfframp`, objeto do `createOrder` montado duas vezes.
- Checagem "endereço == carteira registrada → `attachAndSubmit`" repetida em 4 lugares.
- `requireMembership` + `household.findUnique` separados (household, expenses, summary, statements).
- Três helpers de início do mês: `utcMonthRange`, `utcMonthStart`, `monthStartUtc`.
- Lista de categorias escrita à mão em `expenses.service.create`.
- `try/catch` + `instanceof` em todos os controllers (centralizar no `all-exceptions.filter`).

## Prioridade sugerida

1. Segurança e dinheiro: valor do ledger derivado da transação, validar XDR antes do fee bump, remover log de token, bloquear `simulate` em produção.
2. Bugs: validar categoria no `patch`, transações em household, saída do dono.
3. Limpeza: remover código morto, unificar depósito/saque e claim/burn.
