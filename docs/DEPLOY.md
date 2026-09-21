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

## 2. Backend → Render (`apps/api`)

Blueprint no repo. Depois do primeiro deploy, no dashboard:

1. Postgres **não** pode ficar `free`. Conferir plano `basic-256mb` (ou maior) e backups automáticos ligados. Fazer um restore de teste uma vez.
2. Web service **não** pode ficar `free` (dorme e o `/health` falha no despertar). Plano `starter` / `0.5c-512mb` ou maior.
3. Env obrigatória:
   - `APP_ENV=production` (o blueprint já manda isso; conferir se um override antigo ficou `staging`)
   - `CORS_ORIGIN=https://<dominio-vercel>` (sem barra no fim; várias origens separadas por vírgula)
   - `PRIVY_APP_ID`, `PRIVY_APP_SECRET`
   - `DATABASE_URL` (Render injeta)
   - Segredos web3 que o `loadEnv` ainda exige no boot (`DEFINDEX_*`, `VAULT_ADDRESS`, `USDC_ADDRESS`, `FEE_SPONSOR_SECRET_KEY`, `STELLAR_NETWORK`, `SOROBAN_RPC_URL`) — valores de testnet servem para o processo subir; este plano não liga mainnet.
4. Confirmar `GET https://<api>/health` → `{"status":"ok"}` com o banco no ar. Parar o Postgres de staging uma vez e ver o health virar 503.

### Alternative: Railway / Fly / any container host

The image is `apps/api/Dockerfile` with **build context = repo root**:

```bash
docker build -f apps/api/Dockerfile -t yield2pay-api .
```

Provide a Postgres `DATABASE_URL` and the same env vars as above. Railway and
Fly auto-detect the Dockerfile; point the build context at the repo root.

---

## 3. Frontend → Vercel + Privy

Além do `NEXT_PUBLIC_PRIVY_APP_ID` e `NEXT_PUBLIC_API_BASE_URL`:

- `NEXT_PUBLIC_APP_ENV=production` em Production (sem isso o default do front é `development`).
- No dashboard Privy: origem `https://<dominio-vercel>` e previews `https://*.vercel.app` se forem usar login em preview.
- `CORS_ORIGIN` da API tem que ser **o mesmo** origin do Privy (scheme + host, sem path).

---

## 4. Legal (humano)

Rascunho de `/termos` e `/privacidade` está no repo. Advogado revisa antes de anúncio público. Pedidos LGPD: `GET /account/export` e `DELETE /account` (este último recusa se houver depósito).

---

## 5. Human gate (não automatizar)

O implementer (humano) marca à mão:

- [ ] Render Postgres pago + backup
- [ ] Render API não-free
- [ ] `CORS_ORIGIN` preenchido
- [ ] `APP_ENV=production` na API
- [ ] `NEXT_PUBLIC_APP_ENV=production` na Vercel
- [ ] Origens Privy
- [ ] `/health` ok no domínio real
- [ ] Advogado viu termos/privacidade
