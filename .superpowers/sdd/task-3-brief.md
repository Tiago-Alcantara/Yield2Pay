### Task 3: Chain unlock panel (UI burra)

**Files:**
- Create: `apps/web/src/components/ChainUnlockPanel.tsx`
- Test: `apps/web/src/components/ChainUnlockPanel.test.tsx`

**Interfaces:**
- Consumes: `api.getAccountChain()`, `api.setAccountChain({ action, chainId })`.
- Produces: UI showing selected + unlocked; buttons Unlock Solana / Select Stellar / Select Solana.

- [ ] **Step 1: Failing RTL tests**

```tsx
it('shows selected chain and unlocks solana', async () => {
  const setAccountChain = vi.fn().mockResolvedValue({
    selectedChain: 'stellar',
    unlockedChains: ['stellar', 'solana'],
  });
  // render with mocked api returning stellar-only first
  // click Unlock Solana → expect setAccountChain({ action: 'unlock', chainId: 'solana' })
});

it('selects solana when unlocked', async () => {
  // unlocked includes solana; click Select Solana
  // expect setAccountChain({ action: 'select', chainId: 'solana' })
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement linear panel** — explicit names, no cards-for-decoration; one section: chain state + actions. Portuguese copy OK to match família.

- [ ] **Step 4: Mount on** `apps/web/src/app/family/dashboard/page.tsx` (and optionally B2B dashboard). Do not remove PIX CTAs.

- [ ] **Step 5: Tests PASS + commit draft**  
`feat(web): dumb chain unlock/select panel`

---
