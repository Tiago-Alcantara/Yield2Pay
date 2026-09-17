# MultChain unit-test gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MultChain venue product unit/component suite green locally (API + web + venue-core), apply the `venue_id` migration, and leave a short manual smoke checklist.

**Architecture:** No new test framework. Run existing Vitest suites; fix failures only. Scope = MultChain adoption work on branch `MultChain`, not full-product e2e.

**Tech Stack:** pnpm workspaces, Vitest, Prisma migrate, Testing Library (web).

## Global Constraints

- Unit/component only (Vitest). No Playwright / full e2e this plan.
- Agent **never** `git commit` / push.
- Do not commit `.env`. Do not delete PIX/legacy tests.
- Prefer fixing product bugs over deleting assertions.
- Follow `docs/Preference - Coding Style.md`.

---

### Task 1: Toolchain + install

**Files:** none (env only)

- [ ] **Step 1: Ensure Node + pnpm on PATH**

Windows: use system Node 20+ or Cursor helper node + enable pnpm via Corepack / existing install.

Verify:
```bash
node -v
pnpm -v
```
Expected: Node ≥18, pnpm 10.x (matches `packageManager` in root `package.json`).

- [ ] **Step 2: Install workspace deps**

```bash
pnpm install
```
Expected: `node_modules` at root + packages; exit 0.

- [ ] **Step 3: Prisma generate**

```bash
pnpm db:generate
```
Expected: client generated including `Deposit.venueId`.

---

### Task 2: Focused MultChain unit gate (fail-fast)

**Files:** none unless tests fail (then fix under Task 3)

- [ ] **Step 1: venue-core**

```bash
pnpm --filter @yield2pay/venue-core test
```
If no `test` script, run:
```bash
pnpm --filter @yield2pay/venue-core exec vitest run
```
Expected: PASS (`account-chains`, `mode`).

- [ ] **Step 2: API MultChain slice**

```bash
pnpm --filter @yield2pay/api exec vitest run src/venue/venue.service.spec.ts src/venue/venue.module.spec.ts src/ledger/ledger.service.spec.ts src/deposit/deposit.service.spec.ts src/config/env.spec.ts
```
Expected: PASS — unlock+select kamino, venueId ledger, live module smoke, env modes.

- [ ] **Step 3: Web MultChain slice**

```bash
pnpm --filter @yield2pay/web exec vitest run src/lib/resolveVenueFromAccount.test.ts src/lib/useVenueTx.test.tsx src/lib/money.test.ts src/lib/validateAmount.test.ts src/components/MoveDrawer.test.tsx src/components/ChainUnlockPanel.test.tsx src/app/family/_components/VenueMoveForm.test.tsx src/app/family/investir/page.test.tsx src/app/family/sacar-cofre/page.test.tsx src/app/family/family.test.tsx
```
Expected: PASS — venue path, decimals 6/7, Privy gate, family links.

---

### Task 3: Fix failures (only if Task 2 red)

**Files:** whichever specs/impl fail — prefer minimal product fixes.

- [ ] **Step 1: Reproduce one failing file** with `vitest run <file> -t <name>`
- [ ] **Step 2: Fix root cause** (not weaken assertion unless assertion is wrong vs design)
- [ ] **Step 3: Re-run focused file → green, then re-run Task 2 slices**

Common suspects from prior review:
- `toBaseUnitsForVenue` / decimals in MoveDrawer & VenueMoveForm
- `principal()` default `stellar:blend`
- `assertMockAmountMatches` on venue submit
- Privy `isPrivyConfigured` mocks in ChainUnlockPanel / VenueMoveForm

---

### Task 4: Full package suites

- [ ] **Step 1:** `pnpm --filter @yield2pay/api test`
- [ ] **Step 2:** `pnpm --filter @yield2pay/web test`
- [ ] **Step 3:** If legacy PIX/deposit tests fail unrelated to MultChain, fix or file as separate bug — do not skip silently.

---

### Task 5: Migration (local DB)

- [ ] **Step 1:** Ensure DB up (`pnpm db:up` if Docker available)
- [ ] **Step 2:**

```bash
pnpm --filter @yield2pay/api exec prisma migrate dev
```
Expected: applies `20260917120000_deposit_venue` (`venue_id` NOT NULL DEFAULT `stellar:blend`).

- [ ] **Step 3:** If migrate blocked (no DB), note in report; generate-only already done in Task 1.

---

### Task 6: Manual smoke checklist (human, 10 min)

Mark each after local `dev:app` with `VENUE_MODE=mock` (or unset):

- [ ] New/default account → `GET /account/chain` shows `selectedChain=stellar`, `unlockedChains` includes stellar
- [ ] Unlock Solana → select Solana → `POST .../solana/kamino/deposit/build` returns `transactionBase64`
- [ ] Family `/family/investir` loads (Privy configured) or shows Privy configure message (no crash)
- [ ] PIX `/family/deposito` still loads
- [ ] Legacy B2B deposit page still loads / build still callable

---

### Task 7: Report

- [ ] Write `docs/superpowers/plans/2026-09-17-multichain-unit-gate-results.md` with: commands run, pass/fail counts, migrate status, manual checklist ticks, open gaps.

**Done when:** Task 2 + Task 4 green (or failures documented with fixes attempted); migrate applied or blocked-with-reason; checklist filled.

---

## Out of scope

- Playwright e2e, CI workflow redesign, coverage % gates, live Soroban/DeFindex integration tests, Solana live Kamino.
