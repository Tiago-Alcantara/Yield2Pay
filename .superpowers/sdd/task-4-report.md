# Task 4 Report: Validar o body de POST /bills

## Status

**DONE**

## Commits

None (per instructions).

## Summary

Added `CreateBillBody` class-validator DTO for `POST /bills`: vendor 1–80 chars, monthlyCost 1–16 digit string, type in `software|utility|other`. `BillsController.create` now accepts `CreateBillBody` instead of raw `CreateBillDto`. Service unchanged.

## Changes

### `apps/api/src/bills/create-bill.body.ts` (created)

- Verbatim from plan: `CreateBillBody implements CreateBillDto` with `@Length`, `@Matches(/^\d+$/)`, `@IsIn`.

### `apps/api/src/bills/create-bill.body.spec.ts` (created)

- Verbatim from plan: six validation cases (valid, empty vendor, vendor > 80, non-digit monthlyCost, 17 digits, unknown type).

### `apps/api/src/bills/bills.controller.ts` (modified)

- Swapped `@Body() dto: CreateBillDto` → `@Body() dto: CreateBillBody`; import updated.

## TDD Evidence

### Step 1 — Failing tests added

Created `create-bill.body.spec.ts` exactly as specified in the brief.

### Step 2 — RED (expected failures)

Command (pnpm not in PATH; equivalent via node):

```bash
cd apps/api && node node_modules/vitest/vitest.mjs run src/bills/create-bill.body.spec.ts
```

Output:

```
FAIL  src/bills/create-bill.body.spec.ts
Error: Cannot find module './create-bill.body' imported from .../create-bill.body.spec.ts
Test Files  1 failed (1)
      Tests  no tests
```

### Step 3 — Minimal implementation

Created `create-bill.body.ts` and updated `bills.controller.ts` per plan.

### Step 4 — GREEN (tests pass)

Command:

```bash
cd apps/api && node node_modules/vitest/vitest.mjs run src/bills/create-bill.body.spec.ts src/bills/bills.service.spec.ts
```

Output:

```
Test Files  2 passed (2)
      Tests  9 passed (9)
```

## Concerns

- `pnpm` unavailable in shell PATH; tests run via `node node_modules/vitest/vitest.mjs` from `apps/api`.
- Validation runs only if Nest `ValidationPipe` is enabled globally or on the route; brief did not require wiring the pipe — class is ready for it.
