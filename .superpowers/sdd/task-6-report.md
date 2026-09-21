# Task 6 Report: GET /health pinga o Postgres

## Status

**DONE**

## Commits

None (per instructions).

## Summary

`GET /health` now runs `SELECT 1` via `PrismaService.$queryRaw`. Returns `{ status: 'ok' }` when the database answers; throws `ServiceUnavailableException('database unreachable')` (503) on failure. `main.ts` unchanged — rate-limit still skips `/health`.

## TDD Evidence

### Step 1 — Failing tests added

Created `apps/api/src/health/health.controller.spec.ts` (verbatim from plan).

### Step 2 — RED (expected failures)

```bash
cd apps/api && node node_modules/vitest/vitest.mjs run src/health/health.controller.spec.ts
```

```
FAIL  returns ok when the database answers
TypeError: You must provide a Promise to expect() when using .resolves, not 'object'.

FAIL  throws 503 when the database does not answer
TypeError: You must provide a Promise to expect() when using .rejects, not 'object'.

Test Files  1 failed (1)
      Tests  2 failed (2)
```

(`check()` was synchronous and did not inject Prisma.)

### Step 3 — Minimal implementation

Plan snippet applied to `apps/api/src/health/health.controller.ts`: inject `PrismaService`, async `check()`, `$queryRaw\`SELECT 1\``, catch → `ServiceUnavailableException`.

### Step 4 — GREEN

```bash
cd apps/api && node node_modules/vitest/vitest.mjs run src/health/health.controller.spec.ts
```

**1 file, 2 passed.**

## Files changed

| File | Change |
|------|--------|
| `apps/api/src/health/health.controller.ts` | Inject Prisma; async DB ping |
| `apps/api/src/health/health.controller.spec.ts` | Created (ok + ECONNREFUSED → 503) |

## Concerns

- `pnpm` not on PATH; tests run via `node node_modules/vitest/vitest.mjs`.
- No integration test against a real Postgres; unit tests mock `$queryRaw`.
- Render `healthCheckPath: /health` unchanged; 503 when DB is down is expected for load balancer.
