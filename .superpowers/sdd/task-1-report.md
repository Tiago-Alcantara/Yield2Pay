# Task 1 Report: CORS falha fechado em production

## What was implemented

- Added `CORS_ORIGIN` to the Zod schema in `env.ts` as an optional string.
- Added `corsOrigins: string[] | undefined` to the `Env` type.
- Added `parseCorsOrigins()` that:
  - Throws `CORS_ORIGIN is required when APP_ENV=production` when `APP_ENV=production` and no origins are present.
  - Parses comma-separated origins (trimmed, empty parts filtered).
  - Returns `undefined` outside production when `CORS_ORIGIN` is unset or empty.
- Mapped `corsOrigins` in `loadEnv()` via `parseCorsOrigins(parsed.APP_ENV, parsed.CORS_ORIGIN)`.
- Updated `main.ts` to read CORS config from `Env` (`config.corsOrigins ?? true`) instead of `process.env.CORS_ORIGIN` directly; moved `config` resolution before `enableCors`.
- Updated `.env.example` comment to state `CORS_ORIGIN` is required in production.
- Added three new tests per the brief; updated existing `parses an explicit app env` test to supply `CORS_ORIGIN` for the production case (required after fail-closed behavior was added).

## What was tested and test results

Command:

```bash
pnpm --filter @yield2pay/api exec vitest run src/config/env.spec.ts
```

Result: **11 passed, 0 failed** (all tests in the env spec suite).

## TDD Evidence

### RED — failing test run (before implementation)

Command:

```bash
pnpm --filter @yield2pay/api exec vitest run src/config/env.spec.ts
```

Output (excerpt):

```
❯ src/config/env.spec.ts (11 tests | 2 failed) 19ms
   × rejects production without CORS_ORIGIN 5ms
   × parses comma-separated CORS origins in production 3ms

 FAIL  src/config/env.spec.ts > rejects production without CORS_ORIGIN
AssertionError: expected [Function] to throw an error

 FAIL  src/config/env.spec.ts > parses comma-separated CORS origins in production
AssertionError: expected undefined to deeply equal [ Array(2) ]

 Test Files  1 failed (1)
      Tests  2 failed | 9 passed (11)
```

### GREEN — passing test run (after implementation + existing test fix)

Command:

```bash
pnpm --filter @yield2pay/api exec vitest run src/config/env.spec.ts
```

Output (excerpt):

```
 Test Files  1 passed (1)
      Tests  11 passed (11)
   Duration  559ms
```

## Files changed

| File | Change |
|------|--------|
| `apps/api/src/config/env.ts` | Schema field, `Env.corsOrigins`, `parseCorsOrigins`, mapping in `loadEnv` |
| `apps/api/src/config/env.spec.ts` | Three new CORS tests; production case in existing app-env test updated |
| `apps/api/src/main.ts` | CORS from `config.corsOrigins ?? true`; removed direct `process.env` read |
| `apps/api/.env.example` | Comment: `CORS_ORIGIN` required in production |

## Self-review findings

- Implementation matches the task brief verbatim (schema, type, `parseCorsOrigins`, `main.ts` CORS block).
- Fail-closed behavior is enforced at `loadEnv` time, so `ConfigModule`'s `useFactory: () => loadEnv(process.env)` prevents the API from booting in production without `CORS_ORIGIN`.
- Non-production environments with unset `CORS_ORIGIN` still get `corsOrigins: undefined`, and Nest receives `origin: true` (reflect any origin) — unchanged dev behavior.
- No new TypeScript errors; no manual `Env` object literals elsewhere required updating.
- No linter issues on modified source files.

## Issues or concerns

- **Existing test adjustment:** The pre-existing `parses an explicit app env` test called `loadEnv` with `APP_ENV: 'production'` without `CORS_ORIGIN`; it had to be updated or it would fail. This is expected given the new requirement.
- **Staging behavior:** `APP_ENV=staging` without `CORS_ORIGIN` still allows reflect-any-origin CORS. The brief only mandates fail-closed for production; staging is unchanged.
- **Deploy checklist:** Production deploys must set `CORS_ORIGIN` before the API starts, or startup will throw.
