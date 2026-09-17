# Task 7 Report: Solana mock after unlock gate + readiness check

## Status

**DONE** — Existing tests cover the Solana unlock→select→mock deposit gate with `venueId`; no code changes required. Full test suites **not executed** (`node_modules` missing, `pnpm` not on PATH).

---

## Coverage verification (read-only)

| Area | File | Finding |
|------|------|---------|
| API unlock + select + kamino mock | `apps/api/src/venue/venue.service.spec.ts` | `unlock + select libera kamino mock` — unlocks solana, selects, `buildDeposit` returns `transactionBase64`, submit yields `solana-mock-*` txHash; ledger called with `venueId: 'solana:kamino'`. Locked-chain rejection also covered. |
| Web Solana path | `apps/web/src/lib/useVenueTx.test.tsx` | `solana:kamino submits the unsigned envelope (mock)` — passes `transactionBase64` through to `submitVenueDeposit` without hash signing. |
| Account chains gate | `packages/venue-core/src/account-chains.test.ts` | Defaults stellar; blocks locked / unlocked-not-selected; allows after unlock+select; rejects select on locked chain. |
| Related gate tests (exist, not run) | see below | Registry boot, MoveDrawer, ChainUnlockPanel, family pages, ledger venueId — all present from prior tasks. |

**No assertion gap found** — brief’s “base64 envelope” and `venueId` expectations are already asserted in `venue.service.spec.ts` (lines 103–114) and `useVenueTx.test.tsx` (lines 69–94).

---

## Changes

None. No git commit (project rule).

Suggested commit message for human (when ready): `test: multichain venue product gate`

---

## Test commands (NOT executed)

Prerequisites: `pnpm install` from repo root.

```bash
pnpm --filter @yield2pay/api test
pnpm --filter @yield2pay/web test
```

Optional targeted smoke:

```bash
pnpm --filter @yield2pay/api exec vitest run src/venue/venue.service.spec.ts src/ledger/ledger.service.spec.ts
pnpm --filter @yield2pay/web exec vitest run src/lib/useVenueTx.test.tsx src/components/ChainUnlockPanel.test.tsx src/components/MoveDrawer.test.tsx
pnpm --filter @yield2pay/venue-core exec vitest run src/account-chains.test.ts
```

---

## Manual readiness checklist (human)

- [ ] **New company → stellar selected** — onboarding creates company with `selectedChain: stellar`, `unlockedChains: ['stellar']`.
- [ ] **Unlock solana → select → mock deposit** — ChainUnlockPanel unlocks solana; select switches active chain; invest/MoveDrawer build returns base64 `transactionBase64` envelope; submit completes with mock tx ref.
- [ ] **PIX deposit page still loads** — `/family` or PIX deposit flow unaffected by venue changes.
- [ ] **Legacy `/deposit` build still works** — app `(app)/deposit` route still builds/submits via legacy Stellar path.

---

## Summary

Task 7 is a verification gate: API, web, and venue-core tests already encode the Solana mock path after unlock+select with correct `venueId` ledger wiring. Automated suites could not run locally; human should run the commands above and complete the manual checklist before shipping.
