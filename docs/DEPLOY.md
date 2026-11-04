# Yield2Pay — Deploy guide

Monorepo: `apps/web` (Next.js frontend) deploys to **Vercel**; `apps/api`
(NestJS backend) + Postgres deploys to a container host (**Render** blueprint
included; the Dockerfile is portable to **Railway / Fly / any** host).

---

## 1. Frontend → Vercel (`apps/web`)

1. Push the repo to GitHub (`git push origin main`).
2. Vercel → New Project → import the repo.
3. **Root Directory = `apps/web`** (critical — it's a monorepo). Framework
   preset **Next.js** and **pnpm** are auto-detected. Build command default
   (`next build`).
4. Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_PRIVY_APP_ID` — your real Privy app id (without it, only the
     public landing renders; login + authed screens need it).
   - `NEXT_PUBLIC_API_BASE_URL` — the deployed backend URL from step 2 below
     (e.g. `https://yield2pay-api.onrender.com`). Omit for a landing-only deploy.
5. In the **Privy dashboard**, add your Vercel domains (`https://<app>.vercel.app`
   and any preview/custom domains) to the allowed origins, or Privy refuses to
   initialize in production.

`@yield2pay/shared` resolves via `transpilePackages` + the tsconfig path alias;
`packageManager` is pinned so Vercel uses the right pnpm.

---

## 2. Backend → Render (`apps/api`) via the blueprint

1. Render → New → **Blueprint**, point at this repo. `render.yaml` provisions a
   free Postgres (`yield2pay-db`) and a Docker web service (`yield2pay-api`) with a
   `/health` check. `DATABASE_URL` is wired from the database automatically.
2. After the first deploy, set the secret env vars in the Render dashboard
   (marked `sync: false`): `PRIVY_APP_ID`, `PRIVY_APP_SECRET`,
   `DEFINDEX_API_KEY`, `VAULT_ADDRESS`, `USDC_ADDRESS`, and `CORS_ORIGIN`
   (= your Vercel web origin, e.g. `https://yield2pay.vercel.app`).
3. Migrations run automatically on each deploy (`prisma migrate deploy` in the
   container start command). The app listens on Render's injected `PORT`.

### Alternative: Railway / Fly / any container host

The image is `apps/api/Dockerfile` with **build context = repo root**:

```bash
docker build -f apps/api/Dockerfile -t yield2pay-api .
```

Provide a Postgres `DATABASE_URL` and the same env vars as above. Railway and
Fly auto-detect the Dockerfile; point the build context at the repo root.

---

## 3. After both are up

- Set the frontend's `NEXT_PUBLIC_API_BASE_URL` to the backend URL and redeploy
  (Vercel redeploys on push).
- Set the backend's `CORS_ORIGIN` to the Vercel web origin so browser calls are
  allowed.
- For real on-chain flows you still need: a funded Stellar wallet/vault, a real
  DeFindex API key + vault address, and the deferred integration points pinned
  (see the spec §10.1). Until then, money figures on the dashboard are the
  documented placeholders.

---

## 4. Painel de gastos — ordem e rollback

Subida, nesta ordem:

1. Migrations (`prisma migrate deploy` na API). O índice de
   `shared_merchant_key` nasce em `20261030120000` com `CREATE INDEX` normal.
   `20261030150000` só faz `CREATE INDEX IF NOT EXISTS`. O Prisma não abre
   transação em volta do arquivo (ver "Transação" na seção 5). Não use
   `COMMIT`/`BEGIN` no meio do arquivo para fugir de uma transação: se algo
   falhar, o migrate deixa `finished_at` nulo e o próximo deploy (o restart do
   contêiner) cai em **P3009**, inclusive com a imagem antiga.
2. API.
3. Conferir `GET /health` (responde `{ "status": "ok" }`, sem consultar o banco)
   e um `GET /expenses?month=YYYY-MM`.
4. Web.
5. Backfill das chaves no banco local de teste. O comando do repositório só
   aceita host loopback, porta 5432 ou 5433 e nome terminando em `_test`.
   `pnpm backfill:expense-keys` só lê e imprime a simulação.
   `pnpm backfill:expense-keys -- --apply` grava em lotes. `--batch-size` muda
   o tamanho (padrão 100). Cada lote usa `lock_timeout` de 4 s (sessão, sem
   `LOCAL`) e `statement_timeout` de 60 s. O comando não muda `fixed=true`
   para false. Não grava carimbo nem snapshot.
   Em produção o backfill é passo manual do Tiago, na hora de publicar. O
   comando recusa `--confirm-production`.

### P3009

Se `prisma migrate deploy` disser que há migration falha
(`20261030150000_expense_shared_key_index_concurrent` com `finished_at` nulo):

```bash
pnpm exec prisma migrate resolve --rolled-back 20261030150000_expense_shared_key_index_concurrent
pnpm exec prisma migrate deploy
```

Rode o `deploy` de novo em seguida. Os dois têm de terminar sem erro e toda
linha nova de `_prisma_migrations` precisa de `finished_at` preenchido.

Quem aplicou `20261030120000` no texto sem o `CREATE INDEX` (checksum
`dfc2ba02fa0fd94c935c031cb05ba3068781860bb576d5d50b4b701651ea7cfc`) volta o
checksum ao arquivo original antes do próximo deploy:

```sql
UPDATE _prisma_migrations
SET checksum = '160c7a5bd5f4a93ea459a10f7612f34bc4d979f748be3e34ab83e2cfae2f190c'
WHERE migration_name = '20261030120000_expense_precomputed_keys'
  AND checksum = 'dfc2ba02fa0fd94c935c031cb05ba3068781860bb576d5d50b4b701651ea7cfc';
```

Quem aplicou `20261030143000` numa revisão anterior alinha o checksum ao
arquivo atual (`SET lock_timeout`, sem `LOCAL`) antes do próximo deploy, ou
deixa o Prisma aplicar `20261030160000`. Os dois caminhos deixam o fixo antigo
marcado à mão. `20261030160000` grava `fixed_manual=true` em todo `fixed=true`
que ainda estava automático. Isso permanece. A decisão de produto é do Tiago.

```sql
UPDATE _prisma_migrations
SET checksum = 'bce82c96266070fa2ef3c94bd2042c1d31c0ee8fcf1e18061978db3d438a8055'
WHERE migration_name = '20261030143000_expense_fixed_manual'
  AND checksum <> 'bce82c96266070fa2ef3c94bd2042c1d31c0ee8fcf1e18061978db3d438a8055'
  AND finished_at IS NOT NULL;

UPDATE _prisma_migrations
SET checksum = 'a864e8c48dc122d1cfca576278923881cfdc1ec5f66b4ffbdc4d940e0c20b80b'
WHERE migration_name = '20261030160000_expense_fixed_manual_fill'
  AND checksum <> 'a864e8c48dc122d1cfca576278923881cfdc1ec5f66b4ffbdc4d940e0c20b80b'
  AND finished_at IS NOT NULL;
```

### Índice INVALID

Um `CREATE INDEX CONCURRENTLY` interrompido deixa o índice inválido. Conferir e
recriar fora de transação:

```sql
SELECT c.relname, i.indisvalid
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname = 'expenses_household_id_shared_merchant_key_idx';

DROP INDEX CONCURRENTLY IF EXISTS "expenses_household_id_shared_merchant_key_idx";
CREATE INDEX CONCURRENTLY "expenses_household_id_shared_merchant_key_idx"
  ON expenses (household_id, shared_merchant_key);
```

### Rollback

Na ordem inversa. Os `down.sql` são manuais (o Prisma não os executa):

1. Se o backfill local ainda estiver rodando, pare o comando. Em produção o
   Tiago desfaz à mão o que ele aplicou na publicação.
2. Voltar o web.
3. Voltar a API.
4. No banco: `20261030160000_expense_fixed_manual_fill/down.sql`,
   `20261030150000_expense_shared_key_index_concurrent/down.sql`,
   `20261030143000_expense_fixed_manual/down.sql`,
   `20261030120000_expense_precomputed_keys/down.sql`.
5. Apagar essas linhas de `_prisma_migrations` para a imagem antiga não ver
   migration desconhecida nem falha:

```sql
DELETE FROM _prisma_migrations
WHERE migration_name IN (
  '20261030160000_expense_fixed_manual_fill',
  '20261030150000_expense_shared_key_index_concurrent',
  '20261030143000_expense_fixed_manual',
  '20261030120000_expense_precomputed_keys'
);
```

6. Subir a imagem anterior e rodar `prisma migrate deploy` de novo. Sem a linha
   falha, não há P3009.

---

## 5. Vários grupos (F1) — `20261101120000_household_multi_group`

O que a migration faz:

- `households.personal` (boolean, padrão `false`). Todo grupo que já existe vira
  `personal = true`: até aqui cada pessoa era dona de um grupo só. O grupo atual
  de cada dono vira o individual dele, com a família dentro: **o individual pode
  ter membros**. `personal` diz que é o individual do dono; para o membro, o
  mesmo grupo é um grupo dos outros. Por isso o limite de convidado da F3 conta
  só os grupos dos outros.
- O unique de `owner_company_id` vira o índice único parcial
  `households_owner_company_id_personal_key` (`owner_company_id`) `WHERE personal`:
  uma pessoa pode ser dona de vários grupos, mas de um só individual. O Prisma
  não expressa índice parcial; ele existe só no SQL.
- `household_members` perde o unique de `company_id` (vira índice comum) e
  continua com o unique de (`household_id`, `company_id`).
- `household_members.created_at`: desempata o grupo padrão de quem está em mais
  de um grupo não individual. As linhas antigas recebem a data da migration.
- CHECK `household_members_role_check` (`NOT VALID` seguido de
  `VALIDATE CONSTRAINT`): `role` só aceita `owner` ou `member`. Se o banco tiver
  outro valor, um bloco `DO` aborta a migration antes de qualquer DDL.
- `companies.guest_group_limit` (int, nulo vale 1). Esta coluna e `MAX_GROUPS` só
  passam a ser usados na F3; na F1 nenhum código os aplica.

O grupo individual de quem entrou pelo aceite antigo **não** nasce na migration.
Ele é criado só no `GET /account` **sem** o header `X-Household-Id`, dentro de
transação com `pg_advisory_xact_lock` e protegido pelo índice parcial. Nenhuma
outra rota cria grupo, nem um pedido com header.

Sem o header, o grupo ativo é o grupo **não individual** da pessoa: o membro da
família continua na família, igual à versão anterior, mesmo depois de ganhar o
individual. Com mais de um, vale a membership mais antiga (`created_at`, depois
`id`). O individual só vale se não houver outro grupo.

No convite e no aceite antigos, o individual próprio com membros bloqueia como antes; o individual vazio não bloqueia.

O `GET /account` continua devolvendo `household`, igual a `activeHousehold`, até
a F4. O campo está marcado como deprecated.

Quando a F4 passar a mandar o header, o web precisa limpar um `X-Household-Id`
velho ao receber 404 (a pessoa saiu do grupo ou foi removida) e voltar ao padrão.

### Transação

O `prisma migrate deploy` (Prisma 7.8) não abre transação própria em volta do
arquivo. Provado com `log_statement = 'all'` num Postgres local: nenhum `BEGIN`
sai do engine.

**Neste arquivo, uma falha não deixa estado parcial, com ou sem o `BEGIN`.** Ele
tem `$$`, então o engine o envia numa consulta só, com várias instruções, e o
Postgres desfaz a mensagem inteira quando uma delas falha. Testado também sem o
`BEGIN`/`COMMIT`: nada ficou aplicado.

O `BEGIN`/`COMMIT` fica como defesa: a forma de envio é do engine e não é
documentada. Um arquivo **sem** `$$` foi enviado comando a comando e deixou o que
já tinha rodado, então essa conclusão não vale para outras migrations.

Como cada falha aparece:

- **Role inválida** (o `DO`, antes do `BEGIN`): `P3018` com a mensagem
  `household_multi_group: há role fora de (owner, member)...`.
- **Lock preso em `household_members`** (o `DO` esperando): `P3018` com o código
  `55P03`.
- **Falha dentro do `BEGIN`** (lock preso em `households`, por exemplo): nada fica
  aplicado, mas o `BEGIN` mascara o erro: o deploy mostra só `current transaction
  is aborted`, porque o Prisma tenta gravar o log da falha na mesma conexão.
  Olhe o **primeiro** erro no log do Postgres; é ele que diz a causa.

Em todos os casos a linha de `_prisma_migrations` fica com `finished_at` nulo e o
próximo deploy cai em **P3009** até a recuperação abaixo.

`SET lock_timeout` fica de propósito antes do `BEGIN`, para valer também no `DO`.
Testado com ele só dentro do `BEGIN`: o `DO` ficou esperando até o lock preso em
`household_members` ser solto, sem falhar nos 4 s. Por ser `SET` sem `LOCAL`, o valor dura até a conexão do
deploy fechar, então pode alcançar uma migration seguinte no mesmo deploy.

O `VALIDATE CONSTRAINT` na mesma transação do `NOT VALID` não ganha nada: o lock
do `ADD CONSTRAINT` só é solto no `COMMIT`, então a tabela fica bloqueada durante
a validação de qualquer jeito. Para ganhar algo, o `VALIDATE` precisaria rodar em
outra transação. Isto só está registrado aqui; a migration não mudou nesse ponto.

### Antes do deploy

1. **Backup** do banco. Depois do primeiro `GET /account` de um membro antigo, é
   o único caminho de volta.
2. Confirmar no painel do Render **de qual branch o deploy sobe**. Só depois
   fazer o merge ou mudar a branch.
3. Nenhuma linha fora de `owner` e `member`:

   ```sql
   SELECT DISTINCT role FROM household_members;
   ```

4. Nenhuma transação longa nem lock nas tabelas da migration. Ela usa
   `lock_timeout` de 4 s e falha se não conseguir o lock:

   ```sql
   SELECT pid, state, now() - xact_start AS duracao, left(query, 80) AS consulta
   FROM pg_stat_activity
   WHERE xact_start IS NOT NULL
     AND pid <> pg_backend_pid()
     AND now() - xact_start > interval '30 seconds'
   ORDER BY xact_start;

   SELECT c.relname, l.pid, l.mode, l.granted, a.state,
          now() - a.xact_start AS duracao
   FROM pg_locks l
   JOIN pg_class c ON c.oid = l.relation
   LEFT JOIN pg_stat_activity a ON a.pid = l.pid
   WHERE c.relname IN ('households', 'household_members', 'companies')
     AND l.pid <> pg_backend_pid();
   ```

### Ordem do deploy

1. **API primeiro** (a migration roda no start). O web publicado continua
   funcionando, porque lê `household`.
2. Conferir `GET /health` e um `GET /account`.
3. **Web depois.** O web desta versão lê `activeHousehold`, que a API antiga não
   manda. Com o web novo na API antiga, todo mundo cairia no onboarding.

Para voltar, a ordem é a inversa: web primeiro, depois a API.

### Se a migration falhar no boot

O contêiner não sobe e reinicia em `P3009`. Nada da migration fica aplicado. Rode
contra o banco do deploy:

```bash
pnpm --filter @yield2pay/api exec prisma migrate status
```

Corrija a causa: o dado (`UPDATE household_members SET role = '...' WHERE ...;`)
ou o lock preso. Depois marque a falha e faça um novo deploy:

```bash
pnpm --filter @yield2pay/api exec prisma migrate resolve --rolled-back 20261101120000_household_multi_group
pnpm --filter @yield2pay/api exec prisma migrate deploy
```

Toda linha nova de `_prisma_migrations` precisa terminar com `finished_at`
preenchido.

### As duas versões convivem durante o deploy

O `prisma migrate deploy` roda no start do contêiner (comando de start do
Dockerfile). Então a migration é aplicada pela primeira instância nova enquanto
a instância antiga ainda atende. Nessa janela:

- A API antiga continua subindo com o schema novo, porque as colunas novas têm
  padrão. Mas as buscas por `company_id` dela **deixam de ser unívocas**: o
  unique saiu. Assim que alguém ganha o individual pela API nova, a API antiga
  pode ler qualquer uma das duas memberships dessa pessoa, e um `delete` por
  `company_id` (sair do grupo, remover membro) pode atingir as duas. Mantenha a
  janela curta.
- Um grupo criado pela API antiga nessa janela nasce com `personal = false`.
  Quem fez isso ganha, no primeiro `GET /account` da API nova, um grupo
  individual ("Meu grupo") e continua no grupo que criou, que é o não individual.
  Na F1 nenhum caminho da API nova cria grupo com `personal = false`, então toda
  linha desta consulta veio da janela de convivência:

  ```sql
  SELECT h.id, h.owner_company_id,
         EXISTS (
           SELECT 1 FROM households p
           WHERE p.owner_company_id = h.owner_company_id AND p.personal
         ) AS dono_ja_tem_individual
  FROM households h
  WHERE NOT h.personal;
  ```

  Com `dono_ja_tem_individual = false`, marcar à mão:
  `UPDATE households SET personal = true WHERE id = '<id>';`. Com `true`, o
  dono já ganhou o "Meu grupo"; a escolha de qual fica é manual e do Tiago.

### Rollback

**Limite:** o `down.sql` só vale antes do primeiro `GET /account` de um membro
antigo. Depois disso, a volta é **só com o backup**.

O `down.sql` é manual e roda numa transação só:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/migrations/20261101120000_household_multi_group/down.sql
```

Ele **aborta** (`RAISE EXCEPTION`, nada é desfeito) se alguma pessoa estiver em
dois ou mais grupos, ou for dona de dois ou mais. Isso acontece assim que um
membro antigo faz o primeiro `GET /account` na API nova e ganha o grupo
individual. Sem ninguém em dois grupos, ele volta os uniques de `company_id` e
`owner_company_id`, tira o CHECK, `personal`, `created_at` de `household_members`
e `guest_group_limit`.

Depois do down, apagar a linha da migration para a imagem antiga:

```sql
DELETE FROM _prisma_migrations
WHERE migration_name = '20261101120000_household_multi_group';
```

**Não confie no `prisma migrate status` entre os dois passos.** Depois do
`down.sql` e antes do `DELETE`, ele diz `up to date`, porque só lê
`_prisma_migrations` e não confere o schema. O banco já voltou, e o `status` só
fica certo depois do `DELETE`.

`prisma migrate resolve --rolled-back` **não** serve aqui: o Prisma só aceita em
migration que falhou. Numa migration aplicada ele recusa com `cannot be rolled
back because it is not in a failed state` (coberto em
`household-migration.spec.ts`). Ele é o comando de "Se a migration falhar no
boot", acima.

### Variáveis que mudaram de regra

Nenhuma variável nova. Duas regras ficaram mais fechadas:

- `DEV_LOCAL_SESSION=true` só é aceito com `APP_ENV` igual a `development` ou
  `test`. Qualquer outro valor, ou `APP_ENV` ausente, impede a API de subir.
- Sem `CORS_ORIGIN` e sem `APP_ENV`, o CORS só libera o localhost do web em dev,
  em vez de qualquer origem.

---

## 6. Entradas, gastos e carteira — `20261103120000_expense_kind_source` e `20261104120000_household_wallets`

As duas migrations vão no mesmo deploy, nessa ordem. Nenhuma variável nova.

- `20261103120000_expense_kind_source`: `expenses` ganha `kind`, `source` e
  `excluded_from_totals`, e `category` passa a aceitar nulo. O backfill marca
  `source = 'statement'` em quem tem `statement_id`.
- `20261104120000_household_wallets`: cria `household_wallets`, `wallet_movements`
  e `asset_price_daily`. Não muda nenhuma linha que já existe. Depois do deploy,
  o sync sob demanda grava linhas em `expenses` com `source = 'wallet'`.

### Ordem do deploy

1. **Backup** do banco.
2. Nenhuma transação longa nem lock em `expenses`, `households` ou `companies`
   (consultas da seção 5). As duas usam `lock_timeout` de 4 s.
3. **API primeiro.** Espere a instância antiga sair antes de publicar o web.
4. Conferir `GET /health` e um `GET /household/summary`.
5. **Web depois.** Só o web novo cria entrada e carteira. O web novo na API antiga
   não consegue importar extrato nem abrir as carteiras, porque as rotas não existem
   nela.

### Compatibilidade: não pode existir entrada enquanto a API antiga roda

A API anterior a estas migrations sobe com o schema novo, mas não conhece `kind` e
`excluded_from_totals`:

- ela **soma toda entrada como gasto**: resumo, gráficos, meses e fixos saem errados;
- ela responde **500 no `PATCH /expenses/:id` com `category` numa entrada**, porque o
  CHECK `expenses_kind_category_check` recusa a escrita;
- ela conta como gasto a linha marcada "transferência minha" e as linhas de gasto
  da carteira.

Por isso a API sobe antes do web, e **o rollback do código exige apagar essas linhas
antes**.

### Rollback do código

Faça nesta ordem. O passo 3 apaga dados que só voltam com o backup.

1. **Web primeiro.** Sem o web novo, ninguém cria entrada nem carteira, e o sync
   sob demanda para. Aba antiga ainda aberta pode gravar até a API voltar, então
   confira de novo no passo 3.
2. Conte o que será apagado e guarde o número:

   ```sql
   SELECT source, kind, excluded_from_totals, count(*)
   FROM expenses
   WHERE kind = 'income' OR source = 'wallet' OR excluded_from_totals
   GROUP BY 1, 2, 3;
   ```

3. Apague, numa transação só, imediatamente antes de trocar a imagem da API:

   ```sql
   BEGIN;
   DELETE FROM expenses WHERE kind = 'income';
   DELETE FROM expenses WHERE source = 'wallet' OR excluded_from_totals;
   COMMIT;
   ```

4. **API antiga.** O schema pode ficar como está: a API antiga ignora as tabelas
   novas, e as colunas novas têm padrão.
5. O schema só precisa voltar se a migration for removida do histórico. Nesse caso,
   siga "Rollback do schema", abaixo.

### Rollback do schema

Primeiro a carteira, depois os tipos. O `down.sql` de `expense_kind_source` **aborta**
enquanto houver entrada, linha `source = 'wallet'` ou linha fora dos totais. O da
carteira apaga as linhas `source = 'wallet'`, as carteiras e os movimentos. Os dois
são manuais e rodam numa transação só:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/migrations/20261104120000_household_wallets/down.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM expenses WHERE kind = 'income' OR excluded_from_totals;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/migrations/20261103120000_expense_kind_source/down.sql
```

Depois dos dois `down.sql`, apague as linhas das migrations para a imagem antiga:

```sql
DELETE FROM _prisma_migrations
WHERE migration_name IN (
  '20261104120000_household_wallets',
  '20261103120000_expense_kind_source'
);
```

**Não confie no `prisma migrate status` antes desse `DELETE`.** Depois do `down.sql` e
antes do `DELETE`, ele diz `up to date`, porque só lê `_prisma_migrations` e não confere
o schema. O banco já voltou, e o `status` só fica certo depois do `DELETE`.

`prisma migrate resolve --rolled-back` **não** serve aqui: o Prisma só aceita em
migration que falhou. Numa migration aplicada ele recusa com `not in a failed state`.
Ele é o comando de "Se a migration falhar no boot", abaixo.

### Se a migration falhar no boot

O contêiner não sobe e reinicia em `P3009`. Nada da migration que falhou fica aplicado:
as duas rodam entre `BEGIN` e `COMMIT`. Se a falha for na da carteira, a de tipos já
terminou e continua aplicada.

Como a falha aparece:

- **Lock preso** ou outra falha dentro do `BEGIN`: o `BEGIN` mascara o erro. O deploy
  mostra só `current transaction is aborted`, porque o Prisma tenta gravar o log da
  falha na mesma conexão. Olhe o **primeiro** erro no log do Postgres.
- **Próximo deploy:** `P3009`, citando a migration que falhou.

**O `prisma migrate status` não basta para achar qual falhou.** Com uma migration mais
nova pendente, ele lista só a pendente: se `expense_kind_source` falhar, o `status` cita
`household_wallets` e não diz nada da que falhou. Quem responde é a tabela:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM _prisma_migrations
WHERE finished_at IS NULL AND rolled_back_at IS NULL;
```

Corrija a causa, em geral o lock preso. Depois marque a falha com o nome que a consulta
devolveu e faça um novo deploy:

```bash
pnpm --filter @yield2pay/api exec prisma migrate resolve --rolled-back 20261103120000_expense_kind_source
pnpm --filter @yield2pay/api exec prisma migrate deploy
```

```bash
pnpm --filter @yield2pay/api exec prisma migrate resolve --rolled-back 20261104120000_household_wallets
pnpm --filter @yield2pay/api exec prisma migrate deploy
```

Toda linha nova de `_prisma_migrations` precisa terminar com `finished_at` preenchido.

Os dois caminhos estão cobertos em `postgres-expense-kind.spec.ts` e
`postgres-wallet-migration.spec.ts`.
