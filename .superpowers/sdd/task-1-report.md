# Task 1 Report: `resolveVenueFromAccount` (web)

## Status

**DONE_WITH_CONCERNS** — Implementation and tests match the brief exactly; automated test runs could not be executed in this environment (Node.js / pnpm not available on PATH; no `node_modules` installed).

---

## TDD: RED Phase

### Step 1 — Failing test written

Created `apps/web/src/lib/resolveVenueFromAccount.test.ts` with three cases verbatim from the brief:

- `stellar` → `{ chain: 'stellar', protocol: 'blend' }`
- `solana` → `{ chain: 'solana', protocol: 'kamino' }`
- unknown (`polygon`) → `{ chain: 'stellar', protocol: 'blend' }`

### Step 2 — Run test (expected FAIL)

**Command attempted:**

```bash
pnpm --filter @yield2pay/web exec vitest run src/lib/resolveVenueFromAccount.test.ts
```

**Result:** Could not run. `pnpm`, `node`, and `corepack` are not on PATH; `node_modules` is absent at repo root and under `apps/web`. WSL also lacks Node/pnpm.

**Expected failure (per brief):** Module not found for `./resolveVenueFromAccount` — this would occur because only the test file existed at RED time.

---

## TDD: GREEN Phase

### Step 3 — Implementation

Created `apps/web/src/lib/resolveVenueFromAccount.ts` exactly as specified in the brief:

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

### Step 4 — Run test (expected PASS)

**Command:** Same as Step 2.

**Result:** Not executed (environment blocker). Logic review confirms all three test assertions would pass.

**Local verification command for human:**

```bash
pnpm install
pnpm --filter @yield2pay/web exec vitest run src/lib/resolveVenueFromAccount.test.ts
```

---

## Files Changed

| File | Action |
|------|--------|
| `apps/web/src/lib/resolveVenueFromAccount.test.ts` | Created |
| `apps/web/src/lib/resolveVenueFromAccount.ts` | Created |

No other files modified. No git commit (project rule).

---

## Self-Review

### Correctness

- Mapping matches brief: `solana` → kamino; everything else (including `stellar` and unknown chains) → stellar/blend.
- Function accepts `{ selectedChain: string }`, compatible with `AccountChainView` from `@yield2pay/shared` (which includes `selectedChain` and `unlockedChains`).
- Pure helper, no side effects, no UI — appropriate for Task 1.

### Style

- Linear, explicit control flow per `docs/Preference - Coding Style.md`.
- No unnecessary abstractions or dependencies.
- Test file follows existing vitest patterns (e.g. `validateAmount.test.ts`).

### Concerns / follow-ups (out of scope for Task 1)

1. **`VenueIdPath` duplication:** `useVenueTx.ts` already exports an identical `VenueIdPath` type. A later task may consolidate to a single export (e.g. re-export from `resolveVenueFromAccount.ts` or a shared types module).
2. **Tests not run:** Requires local `pnpm install` + vitest run to confirm GREEN in CI-like conditions.
3. **Step 5 commit skipped:** Per project rule; suggested message for human: `feat(web): resolve venue path from selectedChain`.

### Linter

No linter errors reported on the new files.

---

## Summary

Task 1 deliverables are in place per the plan brief. TDD RED/GREEN workflow was followed structurally; GREEN verification is pending a local test run once Node/pnpm and dependencies are available.
