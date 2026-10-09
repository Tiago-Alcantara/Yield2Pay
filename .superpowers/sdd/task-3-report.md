# Task 3 Report: ChainUnlockPanel (dumb UI)

## Status

**DONE_WITH_CONCERNS** — Component, tests, and dashboard mounts implemented per brief; automated test run blocked (pnpm/node not on PATH).

---

## TDD: RED Phase

### Step 1 — Failing RTL tests

Created `apps/web/src/components/ChainUnlockPanel.test.tsx`:

- Mocks `@privy-io/react-auth` (`usePrivy` → `getAccessToken`) and `@/lib/api` (`createApi` → `getAccountChain` / `setAccountChain`).
- **`shows selected chain and unlocks solana`:** loads stellar-only account; asserts selected/unlocked labels; clicks **Desbloquear Solana** → expects `setAccountChain({ action: 'unlock', chainId: 'solana' })`.
- **`selects solana when unlocked`:** loads account with both chains unlocked; clicks **Selecionar Solana** → expects `setAccountChain({ action: 'select', chainId: 'solana' })`.

### Step 2 — Run test (expected FAIL)

**Command attempted:**

```bash
pnpm --filter @yield2pay/web exec vitest run src/components/ChainUnlockPanel.test.tsx
```

**Result:** Could not run. `pnpm` and `node` are not on PATH.

**Expected failure at RED:** `ChainUnlockPanel.tsx` did not exist before implementation.

---

## TDD: GREEN Phase

### Step 3 — Implement ChainUnlockPanel

Created `apps/web/src/components/ChainUnlockPanel.tsx`:

1. **`usePrivy` + `createApi(getAccessToken)`** — same pattern as MoveDrawer / ServiceCatalog.
2. **On mount:** `api.getAccountChain()` → local state.
3. **Display:** Portuguese labels — *Selecionada*, *Desbloqueadas* (Stellar / Solana names).
4. **Actions (conditional):**
   - **Desbloquear Solana** when `solana` ∉ `unlockedChains` → `{ action: 'unlock', chainId: 'solana' }`.
   - **Selecionar Stellar** when stellar unlocked and not selected → `{ action: 'select', chainId: 'stellar' }`.
   - **Selecionar Solana** when solana unlocked and not selected → `{ action: 'select', chainId: 'solana' }`.
5. **After `setAccountChain`:** replaces state from API response.
6. Loading / error states; buttons disabled while busy.
7. Linear section layout; shared `Button` component; no decorative card inside component.

Uses existing `getAccountChain` / `setAccountChain` signatures from `api.ts` — no new endpoints.

### Step 4 — Mount dashboards

| Page | Change |
|------|--------|
| `apps/web/src/app/family/dashboard/page.tsx` | New card section between cofre and assinaturas; PIX deposit/saque CTAs unchanged |
| `apps/web/src/app/(app)/dashboard/page.tsx` | Panel below `MoneyPanel`; PIX deposit CTA unchanged |

### Step 5 — Run test (expected PASS)

**Result:** Not executed (environment blocker).

**Local verification:**

```bash
pnpm install
pnpm --filter @yield2pay/web exec vitest run src/components/ChainUnlockPanel.test.tsx
```

---

## Files Changed

| File | Action |
|------|--------|
| `apps/web/src/components/ChainUnlockPanel.tsx` | Created |
| `apps/web/src/components/ChainUnlockPanel.test.tsx` | Created |
| `apps/web/src/app/family/dashboard/page.tsx` | Modified — mount panel |
| `apps/web/src/app/(app)/dashboard/page.tsx` | Modified — mount panel |

No git commit (project rule).

Suggested commit message for human: `feat(web): dumb chain unlock/select panel`

---

## Self-Review

### Correctness

- API contract matches `AccountChainView` and `setAccountChain` body type from `@yield2pay/shared` / `api.ts`.
- Unlock only offered when Solana not yet unlocked; select buttons only when chain unlocked and not currently selected.
- State refreshes from POST response — no client-side guesswork.

### Style

- Explicit names (`accountChain`, `runChainAction`, `showUnlockSolana`); linear flow per coding style doc.
- Portuguese copy aligned with família dashboard tone.

### Concerns / follow-ups

1. **Tests not run:** Requires local `pnpm` + vitest to confirm GREEN.
2. **No test for Select Stellar:** Brief scoped to unlock + select Solana; Stellar select path untested.
3. **Family dashboard needs auth:** Panel calls real API when mounted; família pages may need Privy provider in runtime (same as future invest routes).
4. **Duplicate “Redes” title:** Outer family card has no extra title; inner section title is intentional.

### Linter

No linter errors on modified files.

---

## Summary

Dumb chain unlock/select panel implemented with TDD tests, mounted on family (required) and B2B dashboards without removing PIX CTAs. GREEN verification pending local test run.

---

## Fix: Privy-not-configured crash (Important review finding)

### Problem

`ChainUnlockPanel` called `usePrivy()` unconditionally. On `/family/dashboard`, when `NEXT_PUBLIC_PRIVY_APP_ID` is missing or invalid, `PrivyProviderWrapper` renders children without `PrivyProvider`, so `usePrivy()` throws and crashes the page.

### Fix applied

1. **`PrivyProviderWrapper.tsx`** — Exported `isPrivyConfigured` (same logic as the existing app-id gate: non-empty, not `placeholder-app-id`, length ≥ 20). Wrapper now uses this export internally.
2. **`ChainUnlockPanel.tsx`** — Split into:
   - **Outer `ChainUnlockPanel`** — if `!isPrivyConfigured`, renders a short Portuguese message: *"Configure o Privy para gerir redes."* (no hook calls, no crash).
   - **Inner `ChainUnlockPanelWithPrivy`** — calls `usePrivy` and loads chain state only when Privy is configured.
3. **`ChainUnlockPanel.test.tsx`** — Added `shows configure message when Privy is not configured`: mocks `@/providers/PrivyProviderWrapper` via `vi.hoisted` getter; asserts message visible and `getAccountChain` not called. Existing tests set `privyConfig.configured = true` in `beforeEach`.

Dashboard mounts on family and B2B pages unchanged.

### Files changed (this fix)

| File | Action |
|------|--------|
| `apps/web/src/providers/PrivyProviderWrapper.tsx` | Modified — export `isPrivyConfigured` |
| `apps/web/src/components/ChainUnlockPanel.tsx` | Modified — guard + inner component |
| `apps/web/src/components/ChainUnlockPanel.test.tsx` | Modified — unconfigured Privy test + provider mock |

No git commit (project rule).

### How to verify tests locally

```bash
pnpm install
pnpm --filter @yield2pay/web exec vitest run src/components/ChainUnlockPanel.test.tsx
```

**Expected:** 3 tests pass — configure message (no API call), unlock solana, select solana.

**Manual smoke (optional):** Remove or invalidate `NEXT_PUBLIC_PRIVY_APP_ID` in `apps/web/.env.local`, run dev server, open `/family/dashboard` — panel should show *Configure o Privy para gerir redes.* instead of a white-screen crash.

### Status after fix

**DONE** — Important review finding addressed; automated test run not executed in agent environment (`pnpm`/`node` not on PATH).
