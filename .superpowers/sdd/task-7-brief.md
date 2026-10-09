### Task 7: Solana mock after unlock (E2E-ish unit)

**Files:**
- Rely on: existing `venue.service.spec.ts` unlock+select kamino
- Add web: `useVenueTx.test.tsx` already covers solana; ensure ChainUnlockPanel + resolveVenue integration test optional

- [ ] **Step 1: Run full gate**

```bash
pnpm --filter @yield2pay/api test
pnpm --filter @yield2pay/web test
```

Expected: green for registry, unlock, useVenueTx, MoveDrawer, ChainUnlockPanel, family pages, ledger venue.

- [ ] **Step 2: Manual checklist (human)**  
  - New company → stellar selected  
  - Unlock solana → select → mock deposit build returns base64 envelope  
  - PIX deposit page still loads  
  - Legacy `/deposit` build still works  

- [ ] **Step 3: Commit draft**  
`test: multichain venue product gate`

---
