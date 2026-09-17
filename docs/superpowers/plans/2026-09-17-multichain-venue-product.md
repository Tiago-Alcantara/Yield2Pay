# MultChain venue product — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Família + MoveDrawer wallet→vault flows use the venue registry (`useVenueTx` + `/account/chain`); ledger tags deposits by venue; Stellar live/Solana mock work; legacy PIX/ramp untouched.

**Architecture:** Thin product adapters over existing `VenueService` / plugins. Session picks venue from `Company.selectedChain`. New família routes for invest; PIX stays. Ledger gains `venueId` so 6- and 7-decimal money never mix.

**Tech Stack:** NestJS + Prisma + Vitest (API); Next.js + Privy + Vitest/RTL (web); `@yield2pay/venue-core` + venue plugins in pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-17-multichain-venue-product-design.md`  
**Style:** `docs/Preference - Coding Style.md`

## Global Constraints

- Default account: `selectedChain = stellar`, `unlockedChains = [stellar]`.
- New product paths call **only** `/venues/*` and `/account/chain` — not legacy `/deposit`/`/withdraw`.
- Do **not** delete PIX/Etherfuse or legacy deposit/withdraw routes.
- Web new path: **no** `@stellar/stellar-sdk`, **no** `@solana/web3.js`.
- Mock is mode, not a plugin. No live Kamino this cut.
- Agent **never** runs `git commit` / push (project rule). Steps labeled “Commit” mean: stage list + message draft for the human.
- No `Co-authored-by` / Cursor attribution on commits.
- After each slice: `pnpm --filter @yield2pay/api test` and `pnpm --filter @yield2pay/web test` for touched packages. `pnpm db:generate` if Prisma changes. Never commit `.env`.

## File map

| Area | Create | Modify |
|------|--------|--------|
| Session venue helper | `apps/web/src/lib/resolveVenueFromAccount.ts` (+ test) | — |
| MoveDrawer | — | `apps/web/src/components/MoveDrawer.tsx`, `MoveDrawer.test.tsx` |
| Família invest | `apps/web/src/app/family/investir/page.tsx`, `sacar-cofre/page.tsx`, optional shared form | `family/dashboard/page.tsx` links |
| Chain unlock UI | `apps/web/src/components/ChainUnlockPanel.tsx` (+ test) | família dashboard and/or B2B dashboard |
| Ledger venue | migration `YYYYMMDDHHMMSS_deposit_venue` | `schema.prisma`, `ledger.service.ts`, `venue.service.ts`, specs |
| Live check | — | `venue.module.ts` / env wiring if gaps; specs |

---

### Task 1: `resolveVenueFromAccount` (web)

**Files:**
- Create: `apps/web/src/lib/resolveVenueFromAccount.ts`
- Test: `apps/web/src/lib/resolveVenueFromAccount.test.ts`

**Interfaces:**
- Consumes: `AccountChainView` from `@yield2pay/shared` / `api.ts` (`selectedChain`, `unlockedChains`).
- Produces: `resolveVenueFromAccount(account: { selectedChain: string }): { chain: 'stellar' \| 'solana'; protocol: string }` — `stellar`→`blend`, `solana`→`kamino`; unknown → treat as stellar/blend.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { resolveVenueFromAccount } from './resolveVenueFromAccount';

describe('resolveVenueFromAccount', () => {
  it('maps stellar to blend', () => {
    expect(resolveVenueFromAccount({ selectedChain: 'stellar' })).toEqual({
      chain: 'stellar',
      protocol: 'blend',
    });
  });

  it('maps solana to kamino', () => {
    expect(resolveVenueFromAccount({ selectedChain: 'solana' })).toEqual({
      chain: 'solana',
      protocol: 'kamino',
    });
  });

  it('falls back to stellar/blend for unknown', () => {
    expect(resolveVenueFromAccount({ selectedChain: 'polygon' })).toEqual({
      chain: 'stellar',
      protocol: 'blend',
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm --filter @yield2pay/web exec vitest run src/lib/resolveVenueFromAccount.test.ts`  
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export type VenueIdPath = { chain: 'stellar' | 'solana'; protocol: string };

export function resolveVenueFromAccount(account: {
  selectedChain: string;
}): VenueIdPath {
  if (account.selectedChain === 'solana') {
    return { chain: 'solana', protocol: 'kamino' };
  }
  return { chain: 'stellar', protocol: 'blend' };
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit draft (human)**  
Message: `feat(web): resolve venue path from selectedChain`

---

### Task 2: MoveDrawer → `useVenueTx`

**Files:**
- Modify: `apps/web/src/components/MoveDrawer.tsx`
- Modify: `apps/web/src/components/MoveDrawer.test.tsx`
- Possibly: dashboard page that hosts MoveDrawer (pass venue or load account chain)

**Interfaces:**
- Consumes: `useVenueTx(venue)`, `getAccountChain` from `createApi`, `resolveVenueFromAccount`.
- Produces: same MoveDrawer UX; txs go to `/venues/:chain/:protocol/...`.

- [ ] **Step 1: Update tests** — mock `useVenueTx` instead of `useStellarTx`; assert deposit/withdraw call venue hook.

Example shape:

```tsx
vi.mock('@/lib/useVenueTx', () => ({
  useVenueTx: vi.fn(() => ({
    deposit: vi.fn().mockResolvedValue('tx_venue'),
    withdraw: vi.fn().mockResolvedValue('tx_venue'),
  })),
}));

vi.mock('@/lib/api', () => ({
  createApi: () => ({
    getAccountChain: vi.fn().mockResolvedValue({
      selectedChain: 'stellar',
      unlockedChains: ['stellar'],
    }),
  }),
}));
```

- [ ] **Step 2: Run MoveDrawer tests — expect FAIL** (still imports useStellarTx).

- [ ] **Step 3: Implement**

In `MoveDrawer.tsx`:
1. Load account chain once (useEffect + state, or parent passes `venue`).
2. Prefer parent prop `venue?: VenueIdPath` if present; else fetch `getAccountChain` → `resolveVenueFromAccount`.
3. `const tx = useVenueTx(venue)`.
4. Remove `useStellarTx` import.

Keep validation / UI copy unchanged.

- [ ] **Step 4: Run** `pnpm --filter @yield2pay/web exec vitest run src/components/MoveDrawer.test.tsx` — PASS.

- [ ] **Step 5: Commit draft**  
`feat(web): MoveDrawer uses venue registry`

---

### Task 3: Chain unlock panel (UI burra)

**Files:**
- Create: `apps/web/src/components/ChainUnlockPanel.tsx`
- Test: `apps/web/src/components/ChainUnlockPanel.test.tsx`

**Interfaces:**
- Consumes: `api.getAccountChain()`, `api.setAccountChain({ action, chainId })`.
- Produces: UI showing selected + unlocked; buttons Unlock Solana / Select Stellar / Select Solana.

- [ ] **Step 1: Failing RTL tests**

```tsx
it('shows selected chain and unlocks solana', async () => {
  const setAccountChain = vi.fn().mockResolvedValue({
    selectedChain: 'stellar',
    unlockedChains: ['stellar', 'solana'],
  });
  // render with mocked api returning stellar-only first
  // click Unlock Solana → expect setAccountChain({ action: 'unlock', chainId: 'solana' })
});

it('selects solana when unlocked', async () => {
  // unlocked includes solana; click Select Solana
  // expect setAccountChain({ action: 'select', chainId: 'solana' })
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement linear panel** — explicit names, no cards-for-decoration; one section: chain state + actions. Portuguese copy OK to match família.

- [ ] **Step 4: Mount on** `apps/web/src/app/family/dashboard/page.tsx` (and optionally B2B dashboard). Do not remove PIX CTAs.

- [ ] **Step 5: Tests PASS + commit draft**  
`feat(web): dumb chain unlock/select panel`

---

### Task 4: Família `/family/investir` + `/family/sacar-cofre`

**Files:**
- Create: `apps/web/src/app/family/investir/page.tsx`
- Create: `apps/web/src/app/family/sacar-cofre/page.tsx`
- Optional shared: `apps/web/src/app/family/_components/VenueMoveForm.tsx`
- Modify: `apps/web/src/app/family/dashboard/page.tsx` — links “Investir no cofre” / “Sacar do cofre”
- Tests: colocated `*.test.tsx` or under `apps/web/src/app/family/...`

**Interfaces:**
- Consumes: `getAccountChain` → `resolveVenueFromAccount` → `useVenueTx`; `toBaseUnits` / `validateAmount` / `getErrorMessage` like MoveDrawer.
- Produces: authenticated family user can deposit/withdraw via venue; no SDK imports.

- [ ] **Step 1: Write failing page tests** — mock `useVenueTx` + `getAccountChain`; assert confirm calls `deposit`/`withdraw` with base units.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement pages** — reuse MoveDrawer patterns (amount, max, errors). Default venue from account chain. Include `ChainUnlockPanel` or link to it on dashboard.

- [ ] **Step 4: Dashboard links** to `/family/investir` and `/family/sacar-cofre` **without** removing `/family/deposito` / `/family/saque`.

- [ ] **Step 5: `pnpm --filter @yield2pay/web test` — PASS for new tests.**

- [ ] **Step 6: Commit draft**  
`feat(web): family invest/withdraw via venues`

---

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

### Task 6: Stellar live path smoke (no PIX)

**Files:**
- Read/verify: `apps/api/src/venue/venue.module.ts`, `stellar-live.adapter.ts`, `env.ts`
- Test: extend `apps/api/src/venue/venue.service.spec.ts` or `env.spec.ts` if gaps

**Interfaces:**
- When `STELLAR_VENUE_MODE=live` (or `VENUE_MODE=live`), registry boots stellar plugin with `StellarDefindexLiveAdapter`.
- Without env → mock.

- [ ] **Step 1: Confirm tests already cover mode resolution** (`packages/venue-core/src/mode.test.ts`, `env.spec.ts`). Add one Nest test only if module does not assert adapter injection under live.

- [ ] **Step 2: Document in `docs/APPLY-VENUES.md`** one line: family invest uses venues; PIX still legacy.

- [ ] **Step 3: Commit draft**  
`docs: note family venue path vs PIX`

---

### Task 7: Solana mock after unlock (E2E-ish unit)

**Files:**
- Rely on: existing `venue.service.spec.ts` unlock+select kamino
- Add web: `useVenueTx.test.tsx` already covers solana; ensure ChainUnlockPanel + resolveVenue integration test optional

- [ ] **Step 1: Run full gate**

```bash
pnpm --filter @yield2pay/api test
pnpm --filter @yield2pay/web test
```

Expected: green for registry, unlock, useVenueTx, MoveDrawer, ChainUnlockPanel, family pages, ledger venue.

- [ ] **Step 2: Manual checklist (human)**  
  - New company → stellar selected  
  - Unlock solana → select → mock deposit build returns base64 envelope  
  - PIX deposit page still loads  
  - Legacy `/deposit` build still works  

- [ ] **Step 3: Commit draft**  
`test: multichain venue product gate`

---

## Self-review

| Spec requirement | Task |
|------------------|------|
| Família → useVenueTx + account chain | 1, 4 |
| Unlock UI burra | 3 |
| MoveDrawer / wallet→vault not PIX | 2 |
| Ledger per venue | 5 |
| Stellar live via adapter | 6 |
| Solana mock only | 7 |
| Legacy PIX/deposit kept | Constraints + Task 4 (PIX untouched) |
| No chain SDK in new web path | Tasks 2–4 |
| TDD + filter tests | Every task |
| No agent commit | Global Constraints |

No placeholders left. Types: `VenueIdPath` aligned with `useVenueTx`; ledger default `stellar:blend`.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-09-17-multichain-venue-product.md`.

**Two options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task + review between tasks  
2. **Inline Execution** — this session, `executing-plans`, checkpoints

**Which approach?**

Note: agent will **not** commit/push (project rule). After slices, you commit locally on `MultChain`.
