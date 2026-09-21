# Task 3 Report: Desligar rotas de sandbox em production

## Status

**DONE**

## Commits

None (per instructions).

## Summary

Added `assertSandboxEnabled(appEnv)` helper that throws `ForbiddenException` in production. Wired it into `RampController` for `POST /ramp/kyc-approved` and `POST /ramp/onramp/simulate` only, injecting `APP_CONFIG` to read `config.appEnv`. All other ramp routes unchanged.

## Changes

### `apps/api/src/common/assert-sandbox.ts` (created)

- `assertSandboxEnabled(appEnv: AppEnv): void` — no-op outside production; throws `ForbiddenException('sandbox routes are disabled in production')` when `appEnv === 'production'`.

### `apps/api/src/common/assert-sandbox.spec.ts` (created)

- Verbatim from brief: allows development/staging; forbids production.

### `apps/api/src/ramp/ramp.controller.spec.ts` (created)

- Verbatim from brief: blocks both sandbox routes in production before service call; delegates kyc-approved in staging.

### `apps/api/src/ramp/ramp.controller.ts` (modified)

- Injected `@Inject(APP_CONFIG) private readonly config: Env` alongside `RampService`.
- `markKycApproved` and `simulateFiatReceived` call `assertSandboxEnabled(this.config.appEnv)` before delegating to the service.
- Both methods marked `async` so synchronous `ForbiddenException` surfaces as a rejected promise for the brief's `await expect(...).rejects` tests (NestJS behavior unchanged at HTTP layer).

## TDD Evidence

### Step 1 — Failing tests added

Created `assert-sandbox.spec.ts` and `ramp.controller.spec.ts` exactly as specified in the brief.

### Step 2 — RED (expected failures)

Command (pnpm not in PATH; equivalent via node):

```bash
cd apps/api && node node_modules/vitest/vitest.mjs run src/common/assert-sandbox.spec.ts src/ramp/ramp.controller.spec.ts
```

Output:

```
FAIL  src/common/assert-sandbox.spec.ts
Error: Cannot find module './assert-sandbox'

FAIL  src/ramp/ramp.controller.spec.ts > blocks kyc-approved in production before calling the service
AssertionError: promise resolved "undefined" instead of rejecting

FAIL  src/ramp/ramp.controller.spec.ts > blocks onramp/simulate in production before calling the service
AssertionError: promise resolved "undefined" instead of rejecting

Test Files  2 failed (2)
Tests       2 failed | 1 passed (3)
```

### Step 3 — Minimal implementation

- Created `assert-sandbox.ts` verbatim from brief.
- Updated `RampController` constructor and gated the two sandbox endpoints.
- Added `async` to gated handlers so brief's promise-based assertions pass.

### Step 4 — GREEN

Command:

```bash
cd apps/api && node node_modules/vitest/vitest.mjs run src/common/assert-sandbox.spec.ts src/ramp/ramp.controller.spec.ts src/ramp/ramp.service.spec.ts
```

Output:

```
Test Files  3 passed (3)
Tests       14 passed (14)
```

## Self-Review

| Check | Result |
|-------|--------|
| Only sandbox routes gated | Pass — kyc-approved and onramp/simulate only |
| `env.ts` untouched | Pass |
| Other RampController methods unchanged | Pass |
| Tests match brief verbatim | Pass |
| `APP_CONFIG` / `Env` injection pattern | Pass — matches ledger/vault services |
| Linter clean | Pass |
| Existing ramp.service tests still pass | Pass — 9/9 |

## Concerns

- `async` on the two gated handlers is not in the brief snippet but required for the verbatim controller spec (`await expect(...).rejects`). HTTP semantics are unchanged; NestJS still maps `ForbiddenException` to 403.
- `pnpm` unavailable in shell PATH; tests run via `node node_modules/vitest/vitest.mjs` from `apps/api`.

## Files Touched

- `apps/api/src/common/assert-sandbox.ts` (created)
- `apps/api/src/common/assert-sandbox.spec.ts` (created)
- `apps/api/src/ramp/ramp.controller.spec.ts` (created)
- `apps/api/src/ramp/ramp.controller.ts` (modified)
