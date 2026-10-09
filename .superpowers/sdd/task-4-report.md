# Task 4 Report: Família `/family/investir` + `/family/sacar-cofre`

## Status

**DONE_WITH_CONCERNS** — Pages, shared form, dashboard links, and tests implemented per brief; automated test run blocked (`pnpm`/`node` not on PATH, no local `node_modules`).

---

## TDD: RED Phase

### Step 1 — Failing tests

| File | Coverage |
|------|----------|
| `apps/web/src/app/family/_components/VenueMoveForm.test.tsx` | Privy gate; deposit → `deposit(baseUnits)`; withdraw → `withdraw(baseUnits)`; over-max disabled |
| `apps/web/src/app/family/investir/page.test.tsx` | Page renders `VenueMoveForm` mode `deposit` |
| `apps/web/src/app/family/sacar-cofre/page.test.tsx` | Page renders `VenueMoveForm` mode `withdraw` |
| `apps/web/src/app/family/family.test.tsx` | Dashboard links to `/family/investir` and `/family/sacar-cofre` |

Mocks: `useVenueTx`, `getAccountChain`, `isPrivyConfigured` (hoisted getter), `usePrivy`, `ChainUnlockPanel`.

### Step 2 — Run (expected FAIL)

**Command attempted:**

```bash
pnpm --filter @yield2pay/web exec vitest run \
  src/app/family/_components/VenueMoveForm.test.tsx \
  src/app/family/investir/page.test.tsx \
  src/app/family/sacar-cofre/page.test.tsx \
  src/app/family/family.test.tsx
```

**Result:** Could not run — `pnpm`, `node`, and local `vitest` unavailable.

---

## TDD: GREEN Phase

### Step 3 — Implement pages + shared form

**`VenueMoveForm.tsx`** (`apps/web/src/app/family/_components/`):

- Outer gate: `!isPrivyConfigured` → Portuguese message *"Configure o Privy para investir ou sacar do cofre on-chain."* — no `usePrivy` / `useVenueTx` in that branch (same split as `ChainUnlockPanel`).
- Inner `VenueMoveFormWithPrivy`: `getAccountChain` → `resolveVenueFromAccount` → `useVenueTx`; amount validation via `validateAmount` / `toBaseUnits`; confirm calls `deposit` or `withdraw`.
- Family visual language (matches `/family/saque` card layout); USDC amount with `$` prefix.
- `PLACEHOLDER_MAX_BASE_UNITS = '1000000000000'` (100,000 USDC) — **TODO:** fetch real spendable/vault balance when multichain API is ready.
- Deposit mode shows monthly yield preview from `state.rate`.
- Success state shows tx hash + back to dashboard.
- `ChainUnlockPanel` mounted below the form card.

**Thin pages:**

| Path | File | Mode |
|------|------|------|
| `/family/investir` | `apps/web/src/app/family/investir/page.tsx` | `deposit` |
| `/family/sacar-cofre` | `apps/web/src/app/family/sacar-cofre/page.tsx` | `withdraw` |

No chain SDK imports.

### Step 4 — Dashboard links

`apps/web/src/app/family/dashboard/page.tsx`:

- Added **Investir no cofre** → `/family/investir`
- Added **Sacar do cofre** → `/family/sacar-cofre`
- **Depositar por PIX** (`/family/deposito`) and **Sacar meu saldo** (`/family/saque`) unchanged.

### Step 5 — Run tests (expected PASS)

**Result:** Not executed (environment blocker).

**Local verification:**

```bash
pnpm install
pnpm --filter @yield2pay/web exec vitest run \
  src/app/family/_components/VenueMoveForm.test.tsx \
  src/app/family/investir/page.test.tsx \
  src/app/family/sacar-cofre/page.test.tsx \
  src/app/family/family.test.tsx
```

---

## Files Changed

| File | Action |
|------|--------|
| `apps/web/src/app/family/_components/VenueMoveForm.tsx` | Created |
| `apps/web/src/app/family/_components/VenueMoveForm.test.tsx` | Created |
| `apps/web/src/app/family/investir/page.tsx` | Created |
| `apps/web/src/app/family/investir/page.test.tsx` | Created |
| `apps/web/src/app/family/sacar-cofre/page.tsx` | Created |
| `apps/web/src/app/family/sacar-cofre/page.test.tsx` | Created |
| `apps/web/src/app/family/dashboard/page.tsx` | Modified — on-chain CTAs |
| `apps/web/src/app/family/family.test.tsx` | Modified — dashboard link test |

No git commit (project rule).

Suggested commit message for human: `feat(web): family invest/withdraw via venues`

---

## Concerns / follow-ups

1. **Tests not run locally** — requires `pnpm` + vitest.
2. **Placeholder max balance** — `PLACEHOLDER_MAX_BASE_UNITS` until spendable/vault API supports multichain family flows.
3. **Dashboard copy hardcoded** — "Investir no cofre" / "Sacar do cofre" not in `familyI18n` yet (EN path untranslated).
4. **Family mock state vs on-chain** — venue txs do not update `FamilyProvider` deposit mock; intentional for now (real balances come from chain/API later).

---

## Summary

Shared `VenueMoveForm` with Privy gate and MoveDrawer transaction patterns powers `/family/investir` and `/family/sacar-cofre`. Dashboard links added without removing PIX routes. GREEN verification pending local test run.
