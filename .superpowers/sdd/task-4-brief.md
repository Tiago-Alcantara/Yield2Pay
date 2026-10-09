### Task 4: Família `/family/investir` + `/family/sacar-cofre`

**Files:**
- Create: `apps/web/src/app/family/investir/page.tsx`
- Create: `apps/web/src/app/family/sacar-cofre/page.tsx`
- Optional shared: `apps/web/src/app/family/_components/VenueMoveForm.tsx`
- Modify: `apps/web/src/app/family/dashboard/page.tsx` — links “Investir no cofre” / “Sacar do cofre”
- Tests: colocated `*.test.tsx` or under `apps/web/src/app/family/...`

**Interfaces:**
- Consumes: `getAccountChain` → `resolveVenueFromAccount` → `useVenueTx`; `toBaseUnits` / `validateAmount` / `getErrorMessage` like MoveDrawer.
- Produces: authenticated family user can deposit/withdraw via venue; no SDK imports.

- [ ] **Step 1: Write failing page tests** — mock `useVenueTx` + `getAccountChain`; assert confirm calls `deposit`/`withdraw` with base units.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement pages** — reuse MoveDrawer patterns (amount, max, errors). Default venue from account chain. Include `ChainUnlockPanel` or link to it on dashboard.

- [ ] **Step 4: Dashboard links** to `/family/investir` and `/family/sacar-cofre` **without** removing `/family/deposito` / `/family/saque`.

- [ ] **Step 5: `pnpm --filter @yield2pay/web test` — PASS for new tests.**

- [ ] **Step 6: Commit draft**  
`feat(web): family invest/withdraw via venues`

---
