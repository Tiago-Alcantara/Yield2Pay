### Task 5: Rate limit + status 429 no contrato de erro

Read the FULL Task 5 section in docs/superpowers/plans/2026-09-17-web2-golive-blockers.md (from "### Task 5" until "### Task 6") and implement those snippets verbatim.

Produces:
- allowRequest(buckets, key, nowMs, windowMs, maxHits): boolean
- RATE_LIMIT_WINDOW_MS = 60_000
- RATE_LIMIT_MAX_HITS = 60
- ErrorStatusCode includes 429
- PAGE_COPY and DIALOG_COPY for 429
- middleware after CORS, skip /health
- Prefer next(err) with HttpException TOO_MANY_REQUESTS

Also update DIALOG_STATUS_CODES tests in errorCopy.test.ts to include 429.
all-exceptions.filter.spec.ts loop includes 429.
errorDetails.ts RENDERABLE_STATUS_CODES includes 429.

No new packages. Do not commit. main.ts already has CORS from Task 1 — add rate-limit AFTER enableCors, BEFORE listen. Do not revert CORS changes.

If other web tests enumerate ErrorStatusCode keys, update them so the suite is green (errorCopy.test.ts, possibly others that list 400..503).
