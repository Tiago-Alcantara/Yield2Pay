# Task 7 Report: Headers de segurança no Next

## Status

**DONE**

## Commits

None (per instructions).

## Summary

Static security headers live in `apps/web/src/lib/securityHeaders.ts` and are applied on `/:path*` via `headers()` in `next.config.ts`. No CSP (Privy OAuth). Preserved `transpilePackages` and `turbopack`.

## TDD Evidence

### Step 1 — Failing tests added

Created `apps/web/src/lib/securityHeaders.test.ts` (verbatim from plan).

### Step 2 — RED (expected failure)

```bash
cd apps/web && node node_modules/vitest/vitest.mjs run src/lib/securityHeaders.test.ts
```

```
Error: Cannot find module './securityHeaders'
Test Files  1 failed (1)
```

### Step 3 — Minimal implementation

Plan snippets applied:

- `apps/web/src/lib/securityHeaders.ts` — `SECURITY_HEADERS` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS)
- `apps/web/next.config.ts` — import + `async headers()` on `/:path*`; existing transpilePackages/turbopack comments kept

### Step 4 — GREEN

```bash
cd apps/web && node node_modules/vitest/vitest.mjs run src/lib/securityHeaders.test.ts
```

**1 file, 3 passed.**

## Files changed

| File | Change |
|------|--------|
| `apps/web/src/lib/securityHeaders.ts` | Created — static header list |
| `apps/web/src/lib/securityHeaders.test.ts` | Created — framing, HSTS, permissions |
| `apps/web/next.config.ts` | Wire `headers()` with `SECURITY_HEADERS` |

## Concerns

- `pnpm` not on PATH; tests run via `node node_modules/vitest/vitest.mjs` from `apps/web`.
- No CSP by design; add later after Privy origin audit.
- HSTS only effective over HTTPS (Vercel production); harmless on local HTTP dev.
