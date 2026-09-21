# Task 2 Report: Parar de logar o Bearer token

## Status

**DONE**

## Commits

None (per instructions).

## Summary

Removed the `console.log('[AuthGuard] HIT', ...)` call from `AuthGuard.canActivate` that printed the first 30 characters of the `Authorization` header on every authenticated request. Added a regression test that asserts neither the raw token nor a `Bearer` prefix appears in any `console.log` or `console.error` output during a successful auth flow.

## Changes

### `apps/api/src/auth/auth.guard.ts`

- **Deleted** lines 19–25: `console.log('[AuthGuard] HIT', req.method, req.url, 'auth=', req.headers['authorization']?.slice(0, 30))`.
- **Kept** `console.error('[AuthGuard] privy.verify failed:', e)` and `console.error('[AuthGuard] findOrCreate failed:', e)` — these log the error object only, not the bearer token.

### `apps/api/src/auth/auth.guard.spec.ts`

- **Added** `it('does not log the authorization header', ...)` exactly as specified in the task brief.
- Test spies on `console.log` and `console.error`, runs a successful `canActivate` with `Bearer tok123secret`, and asserts the joined output does not contain `tok123secret` or `Bearer tok123`.

## TDD Evidence

### Step 1 — Failing test added

Test added before implementation change.

### Step 2 — Test failed (expected)

```
FAIL  src/auth/auth.guard.spec.ts > does not log the authorization header
AssertionError: expected '[AuthGuard] HIT undefined undefined a…' not to contain 'tok123secret'
Received: "[AuthGuard] HIT undefined undefined auth= Bearer tok123secret"
```

Command used (pnpm not in PATH; equivalent via node):

```bash
cd apps/api && node node_modules/vitest/vitest.mjs run src/auth/auth.guard.spec.ts
```

### Step 3 — Minimal implementation

Removed only the offending `console.log` block.

### Step 4 — Tests pass

```
Test Files  1 passed (1)
Tests       5 passed (5)
```

## Self-Review

| Check | Result |
|-------|--------|
| No `console.log` with authorization data | Pass — log removed |
| Error logging preserved | Pass — both `console.error` calls unchanged |
| Auth contract unchanged | Pass — same exceptions, verify/findOrCreate flow |
| Test matches brief verbatim | Pass |
| No new `as any` beyond brief | Pass — only `privy as any`, `company as any`, context `as any` in new test |
| Linter clean | Pass — no diagnostics on touched files |
| Scope minimal | Pass — 7 lines deleted, 1 test added |

## Concerns

None. `pnpm` was unavailable in the shell PATH; tests were run with `node node_modules/vitest/vitest.mjs` from `apps/api`, which is equivalent to the brief's vitest command.

## Files Touched

- `apps/api/src/auth/auth.guard.ts` (modified)
- `apps/api/src/auth/auth.guard.spec.ts` (modified)
