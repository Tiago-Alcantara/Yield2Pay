# Task 5 Report: Prisma Deposit.venueId + ledger scoping

## Status

**DONE_WITH_CONCERNS** — Schema, migration, ledger/venue wiring, and TDD specs implemented; `pnpm db:generate` / vitest not run (`pnpm` not on PATH).

---

## TDD: RED → GREEN

### Step 1 — Failing ledger tests (added)

| Test | File |
|------|------|
| `recordDeposit stores venueId` | `ledger.service.spec.ts` |
| `principal filters by venueId` | `ledger.service.spec.ts` |
| `principal omits venue filter when venueId not passed` | `ledger.service.spec.ts` |

Venue specs updated to assert `plugin.id` passed to `recordDeposit` (`stellar:blend`, `solana:kamino`).

### Step 2 — Run (expected FAIL)

Not executed — environment blocker.

### Step 3 — Migration

`apps/api/prisma/migrations/20260917120000_deposit_venue/migration.sql`:

```sql
ALTER TABLE "deposits" ADD COLUMN "venue_id" TEXT NOT NULL DEFAULT 'stellar:blend';
CREATE INDEX "deposits_company_id_venue_id_idx" ON "deposits"("company_id", "venue_id");
```

### Step 4 — Implementation

**Schema** — `Deposit.venueId String @default("stellar:blend") @map("venue_id")` + `@@index([companyId, venueId])`.

**LedgerService**

- `recordDeposit(companyId, amount, txHash, venueId = 'stellar:blend', rampOrderId?)` — stores `venueId`.
- `recordWithdraw(..., venueId = 'stellar:blend')` — negative rows tagged.
- `principal(companyId, venueId?)` — omit = all rows (legacy); with venue = filtered aggregate.
- `computeSpendable(companyId, venueId?)` — passes `venueId` into `principal`; vault read unchanged (Stellar).

**VenueService** — `submitDeposit` / `submitWithdraw` pass `plugin.id` as `venueId`.

**DepositService** (minimal compat) — legacy Stellar path passes `'stellar:blend'` + `rampOrderId` as 5th arg.

### Step 5 — Run tests (expected PASS)

**Command:**

```bash
pnpm db:generate
pnpm --filter @yield2pay/api exec vitest run \
  src/ledger/ledger.service.spec.ts \
  src/venue/venue.service.spec.ts
```

**Result:** Not executed — `pnpm` not on PATH.

---

## Files Changed

| File | Action |
|------|--------|
| `apps/api/prisma/schema.prisma` | Modified — `venueId` + index |
| `apps/api/prisma/migrations/20260917120000_deposit_venue/migration.sql` | Created |
| `apps/api/src/ledger/ledger.service.ts` | Modified — venue scoping |
| `apps/api/src/ledger/ledger.service.spec.ts` | Modified — TDD tests |
| `apps/api/src/venue/venue.service.ts` | Modified — pass `plugin.id` |
| `apps/api/src/venue/venue.service.spec.ts` | Modified — assert venueId |
| `apps/api/src/deposit/deposit.service.ts` | Modified — signature compat |
| `apps/api/src/deposit/deposit.service.spec.ts` | Modified — expect 5-arg call |

No git commit (project rule).

Suggested commit message for human: `feat(api): tag deposits with venueId`

---

## Concerns / follow-ups

1. **Tests not run locally** — requires `pnpm db:generate` + vitest.
2. **Per-venue vault read** — `computeSpendable` still uses Stellar `VaultService.getPositionValue` for all venues; Kamino spendable may be principal-only until chain-specific vault reads exist. Do not sum cross-chain vault values.
3. **Legacy dashboard** — `computeSpendable(companyId)` without `venueId` aggregates all deposit rows; per-venue UI should pass `venueId` explicitly.
4. **Apply migration** — run `pnpm db:migrate` (or project equivalent) against target DB before deploy.

---

## Summary

Deposits and withdraw ledger rows are tagged with `venueId`. Principal and spendable can filter by venue; legacy callers unchanged when `venueId` omitted. Venue submit paths wire `plugin.id`. Vault scoping deferred to a follow-up.
