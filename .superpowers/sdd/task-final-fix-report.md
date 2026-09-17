# Final whole-branch review fixes

## Status

Implemented all requested Critical findings (C1-C3) and Important findings
(I1-I3). No git commit was created.

## Fixes

- Added venue-aware base-unit conversion and validation: Stellar uses 7
  decimals and Solana uses 6 in `MoveDrawer` and `VenueMoveForm`.
- Mock Stellar and Solana submissions now decode the signed mock operation and
  reject a client `amount` that differs from the transaction before writing the
  ledger.
- Unscoped principal/spendable calculations now default to `stellar:blend`, so
  the legacy Stellar dashboard cannot aggregate 6-decimal Kamino rows.
- Solana defaults to mock in `VenueModule` even when global `VENUE_MODE=live`;
  only `SOLANA_VENUE_MODE=live` enables live Solana.
- Account-chain loading failures are surfaced in both move UIs.
- `VenueMoveForm` reloads the account chain before confirmation. If the venue
  changed, it updates the venue and asks the user to confirm again.

## Tests and verification

- Added/updated unit coverage for venue decimal conversion, mock amount
  mismatch rejection, default Stellar principal filtering, and Solana mode
  isolation.
- Cursor diagnostics report no linter errors in the changed production files.
- Automated tests could not be executed because `pnpm` is not installed or
  available on `PATH` in this environment.
- Intended commands:
  - `pnpm --filter @yield2pay/web test -- src/lib/money.test.ts src/lib/validateAmount.test.ts src/components/MoveDrawer.test.tsx "src/app/family/_components/VenueMoveForm.test.tsx"`
  - `pnpm --filter @yield2pay/api test -- src/venue/venue.service.spec.ts src/ledger/ledger.service.spec.ts src/venue/venue.module.spec.ts`

## Remaining gap

Live Stellar and future live Solana submissions still trust the request amount
for ledger writes because parsing the amount from live XDR/serialized
transactions is not implemented in this cut. A TODO is present at the trust
boundary; mock submissions are verified.
