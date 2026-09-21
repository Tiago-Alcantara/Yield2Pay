### Task 6: GET /health pinga o Postgres

**Files:**
- Modify: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.controller.spec.ts`

**Produces:** `{ status: 'ok' }` if SELECT 1 ok; ServiceUnavailableException (503) if DB fails. Render still uses healthCheckPath /health.

TDD with the two tests from the plan Task 6 (ok path + ECONNREFUSED → 503). Inject PrismaService. Use tagged template `$queryRaw\`SELECT 1\``. Catch and throw ServiceUnavailableException('database unreachable').

Do not commit. PrismaModule is already @Global in AppModule.

Read exact snippets from docs/superpowers/plans/2026-09-17-web2-golive-blockers.md ### Task 6 until ### Task 7.
