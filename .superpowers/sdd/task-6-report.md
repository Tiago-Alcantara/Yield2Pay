# Task 6 Report: Stellar live path smoke + docs note

## Status

**DONE_WITH_CONCERNS** — Live wiring verified in code; registry smoke test added; docs updated. Vitest not run (`pnpm` not on PATH).

---

## Verification (read-only)

| File | Finding |
|------|---------|
| `venue.module.ts` | `VENUE_REGISTRY` factory calls `resolveVenueMode('stellar', venueModeEnv(config))`; passes `StellarDefindexLiveAdapter` as `live` only when mode is `'live'`. |
| `stellar-live.adapter.ts` | `StellarDefindexLiveAdapter` delegates to `VaultService` + `StellarService` (DeFindex build + fee-bump submit). |
| `env.ts` | Parses `VENUE_MODE`, `STELLAR_VENUE_MODE`, `SOLANA_VENUE_MODE`; `venueModeEnv()` maps to plugin env dict. |

**Existing coverage (no change):**

- `packages/venue-core/src/mode.test.ts` — `resolveVenueMode` (global + per-chain override).
- `apps/api/src/config/env.spec.ts` — parse defaults + overrides.

**Gap filled:** module factory did not assert live adapter injection → `venue.module.spec.ts`.

---

## Changes

| File | Action |
|------|--------|
| `apps/api/src/venue/venue.module.spec.ts` | Created — mirrors boot factory; mock default; live via `STELLAR_VENUE_MODE=live` and `VENUE_MODE=live`. |
| `docs/APPLY-VENUES.md` | Modified — section **Produto (family vs PIX)**: family invest/sacar-cofre + MoveDrawer use venues; PIX + `/deposit`/`/withdraw` stay legacy. |

No git commit (project rule).

Suggested commit message for human: `docs: note family venue path vs PIX`

---

## Test command (not executed)

```bash
pnpm --filter @yield2pay/api exec vitest run \
  src/venue/venue.module.spec.ts \
  src/config/env.spec.ts \
  ../../packages/venue-core/src/mode.test.ts
```

---

## Concerns / follow-ups

1. **Tests not run locally** — requires `pnpm` on PATH.
2. **Smoke only** — no end-to-end against Soroban/DeFindex; live path assumes `VaultService` + env secrets are valid.
3. **Solana live** — Kamino still has no live adapter in this cut; `SOLANA_VENUE_MODE=live` would fail at runtime until adapter exists.

---

## Summary

Confirmed `VenueModule` wires `StellarDefindexLiveAdapter` when `STELLAR_VENUE_MODE=live` or `VENUE_MODE=live`; without env, Stellar stays mock. Added registry boot smoke test. Documented family/MoveDrawer venue path vs PIX and legacy deposit routes.
