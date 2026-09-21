# Task 5 Report: Rate limit + HTTP 429 error contract

## Status

**DONE**

## Commits

None (per instructions).

## Summary

In-process sliding-window rate limit (`allowRequest`, 60 hits / 60s) after CORS in `main.ts`, skipping `/health`. `ErrorStatusCode` and UI copy include 429. CORS from Task 1 left intact.

## TDD Evidence

### Step 1 — Failing tests added

- Created `apps/api/src/common/rate-limit.spec.ts` (verbatim from plan).
- Updated `errorCopy.test.ts` PAGE_COPY keys and `DIALOG_STATUS_CODES` to include 429.
- Updated `all-exceptions.filter.spec.ts` renderable-status loop to include 429.

### Step 2 — RED (expected failures)

`pnpm` not on PATH. Commands:

```bash
cd apps/api && node node_modules/vitest/vitest.mjs run src/common/rate-limit.spec.ts src/common/all-exceptions.filter.spec.ts
cd apps/web && node node_modules/vitest/vitest.mjs run src/lib/errorCopy.test.ts
```

API:

```
FAIL  src/common/rate-limit.spec.ts
Error: Cannot find module './rate-limit'

FAIL  src/common/all-exceptions.filter.spec.ts > keeps the statuses the error screens know how to render
AssertionError: expected 400 to be 429

Test Files  2 failed (2)
      Tests  1 failed | 10 passed (11)
```

Web:

```
FAIL  PAGE_COPY > covers every status the error page can receive  (missing 429)
FAIL  DIALOG_COPY > covers only the statuses...  (DIALOG_STATUS_CODES missing 429)

Test Files  1 failed (1)
      Tests  2 failed | 7 passed (9)
```

### Step 3 — Minimal implementation

Plan snippets: `rate-limit.ts`, `ErrorStatusCode` + 429, RENDERABLE arrays, PAGE_COPY/DIALOG_COPY 429, middleware after `enableCors` with `next(HttpException TOO_MANY_REQUESTS)`.

Also: `all-exceptions.filter.spec.ts` “outside the closed set” used 429 as a 4xx that should collapse to 400; replaced that case with 409 so 429 stays renderable.

### Step 4 — GREEN

```bash
cd apps/api && node node_modules/vitest/vitest.mjs run src/common/rate-limit.spec.ts src/common/all-exceptions.filter.spec.ts
cd apps/web && node node_modules/vitest/vitest.mjs run src/lib/errorCopy.test.ts src/lib/errorDetails.test.ts src/lib/errorNotifications.test.ts
```

API: **2 files, 16 passed**. Web: **3 files, 27 passed**.

## Files changed

| File | Change |
|------|--------|
| `apps/api/src/common/rate-limit.ts` | Created |
| `apps/api/src/common/rate-limit.spec.ts` | Created |
| `apps/api/src/main.ts` | Rate-limit middleware after CORS; Task 1 CORS kept |
| `packages/shared/src/index.ts` | `ErrorStatusCode` includes 429 |
| `apps/api/src/common/all-exceptions.filter.ts` | RENDERABLE includes 429 |
| `apps/api/src/common/all-exceptions.filter.spec.ts` | Loop includes 429; 409 instead of 429 for “outside set” |
| `apps/web/src/lib/errorDetails.ts` | RENDERABLE includes 429 |
| `apps/web/src/lib/errorCopy.ts` | PAGE_COPY + DIALOG_COPY 429 |
| `apps/web/src/lib/errorCopy.test.ts` | Expected lists include 429 |

## Concerns

- `pnpm` not on PATH; tests via `node node_modules/vitest/vitest.mjs`.
- Rate limit is a process-local `Map` (not shared across instances).
- Nest `next(err)` vs Express HTML: not integration-tested; plan prefers `next(err)` first.
- Design HTML still lists old status codes (out of scope).
