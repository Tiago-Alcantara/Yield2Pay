# MultChain unit-test gate — results

**Date:** 2026-09-17  
**Plan:** `docs/superpowers/plans/2026-09-17-multichain-unit-gate.md`  
**Branch:** `MultChain`

## Toolchain

- Installed Node.js LTS 24.19.0 via winget
- Installed pnpm 10.33.2 via `npm install -g pnpm`
- `pnpm install` OK
- `prisma generate` needs `DATABASE_URL` in env (used example URL; no `.env` committed)

## MultChain focused gate — GREEN

| Slice | Result |
|-------|--------|
| venue-core (`account-chains`, `mode`) | **12/12 passed** |
| API MultChain specs (venue, ledger, deposit, env, module) | **40/40 passed** |
| Web MultChain specs (resolveVenue, useVenueTx, money, validateAmount, MoveDrawer, ChainUnlockPanel, VenueMoveForm, family pages) | **49/49 passed** |

### Fix applied during gate

- `MoveDrawer.test.tsx`: mock `@/lib/api` with `importOriginal` so `ApiError` remains available to `getErrorMessage`.

## Full package suites

| Package | Result |
|---------|--------|
| `@yield2pay/api` full | **123/123 passed** |
| `@yield2pay/web` full | **218/218 passed** (after follow-up fixes) |

### Follow-up fixes (web full suite)

- Landing/login/dashboard tests: default lang is **PT**
- `MoveDrawer` / dashboard / ServiceCatalog: `ApiError` via `importOriginal` on `@/lib/api` mock
- **Windows case clash:** renamed `serviceCatalog.ts` → `catalogServices.ts` (collided with `ServiceCatalog.tsx`)
- Dashboard vault assertion: `$1.08` (MoneyPanel prefixes `$`)

## Migration

Not applied in this run (DB may be down). Command for human:

```bash
# with DATABASE_URL set (see apps/api/.env.example)
pnpm db:up   # if using compose
pnpm --filter @yield2pay/api exec prisma migrate dev
```

Migration file present: `apps/api/prisma/migrations/20260917120000_deposit_venue/`

## Manual smoke checklist

- [ ] `GET /account/chain` → stellar default
- [ ] Unlock + select Solana → kamino deposit/build returns base64
- [ ] `/family/investir` loads or Privy message (no crash)
- [ ] `/family/deposito` PIX still loads
- [ ] Legacy B2B `/deposit` still loads

## Verdict

**Option A MultChain unit gate: PASS**  
**Full web + API Vitest: PASS** (218 web / 123 api)

Still human: Docker migrate + manual smoke checklist.
