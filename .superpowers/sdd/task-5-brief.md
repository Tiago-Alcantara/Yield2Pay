### Task 5: Prisma `Deposit.venueId` + ledger scoping

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_deposit_venue/migration.sql`
- Modify: `apps/api/src/ledger/ledger.service.ts`
- Modify: `apps/api/src/ledger/ledger.service.spec.ts`
- Modify: `apps/api/src/venue/venue.service.ts`
- Modify: `apps/api/src/venue/venue.service.spec.ts`

**Interfaces:**
- Schema: `Deposit.venueId String @default("stellar:blend") @map("venue_id")` (+ index `[companyId, venueId]`).
- `recordDeposit(companyId, amount, txHash, venueId = 'stellar:blend')`
- `recordWithdraw(...)` same if withdraw uses Deposit negative rows — keep same column.
- `principal(companyId, venueId?)` — if `venueId` omitted, legacy behavior (all rows) for old dashboard; venue path passes id.
- `computeSpendable(companyId, venueId?)` — when venueId set, principal filtered; vault value still from that chain’s vault read (Stellar vault for blend; mock for kamino — follow existing VenueService/Ledger patterns; do not invent cross-chain vault sum).

- [ ] **Step 1: Failing ledger tests**

```ts
it('recordDeposit stores venueId', async () => {
  await svc.recordDeposit('co_1', 1_000_000n, 'tx1', 'solana:kamino');
  expect(prisma.deposit.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ venueId: 'solana:kamino' }),
    }),
  );
});

it('principal filters by venueId', async () => {
  // mock findMany filtered — expect only matching venue sum
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Migration SQL**

```sql
ALTER TABLE "deposits" ADD COLUMN "venue_id" TEXT NOT NULL DEFAULT 'stellar:blend';
CREATE INDEX "deposits_company_id_venue_id_idx" ON "deposits"("company_id", "venue_id");
```

- [ ] **Step 4: Wire `VenueService.submitDeposit/submitWithdraw`** to pass `plugin.id` into ledger.

- [ ] **Step 5: `pnpm db:generate`** then  
`pnpm --filter @yield2pay/api exec vitest run src/ledger/ledger.service.spec.ts src/venue/venue.service.spec.ts` — PASS.

- [ ] **Step 6: Commit draft**  
`feat(api): tag deposits with venueId`

---
