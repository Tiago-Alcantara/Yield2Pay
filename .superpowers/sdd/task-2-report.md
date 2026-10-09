# Task 2 Report: MoveDrawer → `useVenueTx`

## Status

**DONE_WITH_CONCERNS** — Implementation and tests match the brief; automated test runs could not be executed in this environment (Node.js / pnpm not on PATH).

---

## TDD: RED Phase

### Step 1 — Update tests first

Modified `apps/web/src/components/MoveDrawer.test.tsx`:

- Replaced `vi.mock('@/lib/useStellarTx')` with `vi.mock('@/lib/useVenueTx')` returning `{ deposit: mockDeposit, withdraw: mockWithdraw }`.
- Added mocks for `@privy-io/react-auth` (`usePrivy`) and `@/lib/api` (`createApi` + `getAccountChain`) so MoveDrawer can mount without real Privy/API.
- Added `venue: { chain: 'stellar', protocol: 'blend' }` to `baseProps` so tests avoid async venue resolution.
- Kept all existing behavior assertions (deposit/withdraw base units, max button, validation, error display, success hash).

### Step 2 — Run test (expected FAIL)

**Command attempted:**

```bash
pnpm --filter @yield2pay/web exec vitest run src/components/MoveDrawer.test.tsx
```

**Result:** Could not run. `pnpm` and `node` are not on PATH.

**Expected failure (per brief):** MoveDrawer still imported `useStellarTx` at RED time — tests would fail to resolve the old hook or assertions would not match the new mock target.

---

## TDD: GREEN Phase

### Step 3 — Implement MoveDrawer

Modified `apps/web/src/components/MoveDrawer.tsx`:

1. **Removed** `useStellarTx` import.
2. **Added** optional `venue?: VenueIdPath` on `MoveDrawerProps`; `VenueIdPath` imported from `@/lib/resolveVenueFromAccount` (not redefined).
3. **Venue resolution:**
   - If `venue` prop is provided → use it directly (`activeVenue = venueProp`).
   - If not → `useEffect` fetches `createApi(getAccessToken).getAccountChain()`, then `resolveVenueFromAccount(account)` into `loadedVenue` state.
4. **Hook call:** `useVenueTx(activeVenue ?? FALLBACK_VENUE)` — fallback only satisfies React hook rules while loading; confirm is disabled until `activeVenue` is set.
5. **UX guard:** Confirm button `disabled={!isValid || submitting || !venueReady}`; `handleConfirm` returns early when `!venueReady`.
6. Validation, copy, and UI layout unchanged.

Dashboard `page.tsx` left unchanged — MoveDrawer resolves venue on mount when parent omits the prop.

### Step 4 — Run test (expected PASS)

**Command:** Same as Step 2.

**Result:** Not executed (environment blocker). Logic review confirms all six test cases should pass with the venue prop and mocked `useVenueTx`.

**Local verification command for human:**

```bash
pnpm install
pnpm --filter @yield2pay/web exec vitest run src/components/MoveDrawer.test.tsx
```

---

## Files Changed

| File | Action |
|------|--------|
| `apps/web/src/components/MoveDrawer.test.tsx` | Modified — mock `useVenueTx`, pass `venue` prop |
| `apps/web/src/components/MoveDrawer.tsx` | Modified — `useVenueTx`, optional venue, async resolution |

No changes to `useDepositFlow`, `useWithdrawFlow`, PIX flows, or dashboard page. No git commit (project rule).

---

## Self-Review

### Correctness

- Deposit/withdraw still call `tx[mode](toBaseUnits(amountRaw))` — same base-unit contract as before.
- When parent passes `venue`, no network call for account chain.
- When parent omits `venue`, confirm stays disabled until `getAccountChain` resolves — prevents submitting against the fallback venue.
- `FALLBACK_VENUE` matches stellar/blend default used elsewhere.

### Style

- Linear flow, explicit names (`activeVenue`, `loadedVenue`, `venueReady`) per coding style doc.
- No new dependencies; reuses existing `createApi`, `usePrivy`, `resolveVenueFromAccount`.

### Concerns / follow-ups

1. **Tests not run:** Requires local `pnpm install` + vitest to confirm GREEN.
2. **`VenueIdPath` duplication:** Still defined in both `resolveVenueFromAccount.ts` and `useVenueTx.ts`; out of scope for Task 2.
3. **Dashboard could pass `venue` later:** Parent already knows chain context in some flows; passing `venue` from dashboard would skip the extra `getAccountChain` round-trip (optional optimization).
4. **No test for async venue path:** Brief scoped tests to explicit `venue` prop; async resolution path is untested in unit tests.

### Linter

No linter errors on modified files.

---

## Summary

MoveDrawer now routes deposit/withdraw through `useVenueTx` with optional `venue` prop or on-mount account-chain resolution. Tests updated per TDD; GREEN verification pending local test run.
