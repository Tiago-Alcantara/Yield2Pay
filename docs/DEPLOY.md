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
   `20261030150000` só faz `CREATE INDEX IF NOT EXISTS`, também dentro da
   transação do Prisma. Não use `COMMIT`/`BEGIN` no meio do arquivo: o migrate
   deixa `finished_at` nulo e o próximo deploy (o restart do contêiner) cai em
   **P3009**, inclusive com a imagem antiga.
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
