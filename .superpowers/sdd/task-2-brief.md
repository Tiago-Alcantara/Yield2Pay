### Task 2: MoveDrawer → `useVenueTx`

**Files:**
- Modify: `apps/web/src/components/MoveDrawer.tsx`
- Modify: `apps/web/src/components/MoveDrawer.test.tsx`
- Possibly: dashboard page that hosts MoveDrawer (pass venue or load account chain)

**Interfaces:**
- Consumes: `useVenueTx(venue)`, `getAccountChain` from `createApi`, `resolveVenueFromAccount`.
- Produces: same MoveDrawer UX; txs go to `/venues/:chain/:protocol/...`.

- [ ] **Step 1: Update tests** — mock `useVenueTx` instead of `useStellarTx`; assert deposit/withdraw call venue hook.

Example shape:

```tsx
vi.mock('@/lib/useVenueTx', () => ({
  useVenueTx: vi.fn(() => ({
    deposit: vi.fn().mockResolvedValue('tx_venue'),
    withdraw: vi.fn().mockResolvedValue('tx_venue'),
  })),
}));

vi.mock('@/lib/api', () => ({
  createApi: () => ({
    getAccountChain: vi.fn().mockResolvedValue({
      selectedChain: 'stellar',
      unlockedChains: ['stellar'],
    }),
  }),
}));
```

- [ ] **Step 2: Run MoveDrawer tests — expect FAIL** (still imports useStellarTx).

- [ ] **Step 3: Implement**

In `MoveDrawer.tsx`:
1. Load account chain once (useEffect + state, or parent passes `venue`).
2. Prefer parent prop `venue?: VenueIdPath` if present; else fetch `getAccountChain` → `resolveVenueFromAccount`.
3. `const tx = useVenueTx(venue)`.
4. Remove `useStellarTx` import.

Keep validation / UI copy unchanged.

- [ ] **Step 4: Run** `pnpm --filter @yield2pay/web exec vitest run src/components/MoveDrawer.test.tsx` — PASS.

- [ ] **Step 5: Commit draft**  
`feat(web): MoveDrawer uses venue registry`

---
