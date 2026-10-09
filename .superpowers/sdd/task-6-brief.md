### Task 6: Stellar live path smoke (no PIX)

**Files:**
- Read/verify: `apps/api/src/venue/venue.module.ts`, `stellar-live.adapter.ts`, `env.ts`
- Test: extend `apps/api/src/venue/venue.service.spec.ts` or `env.spec.ts` if gaps

**Interfaces:**
- When `STELLAR_VENUE_MODE=live` (or `VENUE_MODE=live`), registry boots stellar plugin with `StellarDefindexLiveAdapter`.
- Without env → mock.

- [ ] **Step 1: Confirm tests already cover mode resolution** (`packages/venue-core/src/mode.test.ts`, `env.spec.ts`). Add one Nest test only if module does not assert adapter injection under live.

- [ ] **Step 2: Document in `docs/APPLY-VENUES.md`** one line: family invest uses venues; PIX still legacy.

- [ ] **Step 3: Commit draft**  
`docs: note family venue path vs PIX`

---
