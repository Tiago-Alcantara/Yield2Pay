# FixEarn — Deploy guide

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
     (e.g. `https://fixearn-api.onrender.com`). Omit for a landing-only deploy.
5. In the **Privy dashboard**, add your Vercel domains (`https://<app>.vercel.app`
   and any preview/custom domains) to the allowed origins, or Privy refuses to
   initialize in production.

`@fixearn/shared` resolves via `transpilePackages` + the tsconfig path alias;
`packageManager` is pinned so Vercel uses the right pnpm.

---

## 2. Backend → Render (`apps/api`) via the blueprint

1. Render → New → **Blueprint**, point at this repo. `render.yaml` provisions a
   free Postgres (`fixearn-db`) and a Docker web service (`fixearn-api`) with a
   `/health` check. `DATABASE_URL` is wired from the database automatically.
2. After the first deploy, set the secret env vars in the Render dashboard
   (marked `sync: false`): `PRIVY_APP_ID`, `PRIVY_APP_SECRET`,
   `DEFINDEX_API_KEY`, `VAULT_ADDRESS`, `USDC_ADDRESS`, and `CORS_ORIGIN`
   (= your Vercel web origin, e.g. `https://fixearn.vercel.app`).
3. Migrations run automatically on each deploy (`prisma migrate deploy` in the
   container start command). The app listens on Render's injected `PORT`.

### Alternative: Railway / Fly / any container host

The image is `apps/api/Dockerfile` with **build context = repo root**:

```bash
docker build -f apps/api/Dockerfile -t fixearn-api .
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
