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
   `shared_merchant_key` é criado com `CREATE INDEX CONCURRENTLY` na migration
   `20261030150000_expense_shared_key_index_concurrent`.
2. API.
3. Conferir `GET /health` (responde `{ "status": "ok" }`, sem consultar o banco)
   e um `GET /expenses?month=YYYY-MM`.
4. Web.
5. Backfill das chaves, só num Postgres local cujo nome contém `test`:
   `pnpm backfill:expense-keys` simula; `pnpm backfill:expense-keys -- --apply`
   grava em lotes. O comando recusa host remoto, `?host=`, `?hostaddr=` e socket.

Rollback, na ordem inversa. Os `down.sql` ficam ao lado de cada `migration.sql`
e são manuais (o Prisma não os executa):

1. Parar o backfill se ainda estiver rodando.
2. Voltar o web.
3. Voltar a API.
4. No banco, fora de uma transação quando o arquivo pedir:
   `20261030150000_expense_shared_key_index_concurrent/down.sql`,
   depois `20261030143000_expense_fixed_manual/down.sql`,
   depois `20261030120000_expense_precomputed_keys/down.sql`.

Quem já aplicou `20261030120000` com o `CREATE INDEX` antigo precisa atualizar o
checksum dessa migration no `_prisma_migrations` antes do próximo `migrate deploy`.
O índice em si passa a ser responsabilidade da migration concorrente
(`IF NOT EXISTS` não recria um índice que já existe).
