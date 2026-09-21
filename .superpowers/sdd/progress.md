# SDD Progress — Web2 go-live blockers

Plan: `docs/superpowers/plans/2026-09-17-web2-golive-blockers.md`
Branch: `MultChain` (in-place; not main)
Note: agent never commits. Review packages use working-tree diffs.

## Ledger

Task 1: complete (uncommitted, review clean). Minor: production whitespace CORS untested.
Task 2: complete (uncommitted, review clean).
Task 3: complete (uncommitted, review clean). async on gated handlers for promise tests.
Task 4: complete (uncommitted, review clean). ValidationPipe already global.
Task 5: complete (uncommitted, review clean). next(err) not e2e-tested (plan-mandated).
Task 6: complete (uncommitted, review clean).
Task 7: complete (uncommitted, review clean).
Task 8: complete (uncommitted, review clean). PT-only legal draft; EN login → PT routes is plan-mandated.
Task 9: complete (uncommitted, review clean). Dual /account controllers; delete blocked by any deposit row.
Task 10: complete (uncommitted, review clean). Human dashboard checkboxes remain for the user.

Post-review: `trust proxy` + `pruneExpiredBuckets` (rate limiter behind Render); `PrivyProviderWrapper` narrows `appId` so `next build` typecheck can pass.
