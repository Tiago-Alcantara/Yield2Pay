### Task 1: `resolveVenueFromAccount` (web)

**Files:**
- Create: `apps/web/src/lib/resolveVenueFromAccount.ts`
- Test: `apps/web/src/lib/resolveVenueFromAccount.test.ts`

**Interfaces:**
- Consumes: `AccountChainView` from `@yield2pay/shared` / `api.ts` (`selectedChain`, `unlockedChains`).
- Produces: `resolveVenueFromAccount(account: { selectedChain: string }): { chain: 'stellar' \| 'solana'; protocol: string }` — `stellar`→`blend`, `solana`→`kamino`; unknown → treat as stellar/blend.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { resolveVenueFromAccount } from './resolveVenueFromAccount';

describe('resolveVenueFromAccount', () => {
  it('maps stellar to blend', () => {
    expect(resolveVenueFromAccount({ selectedChain: 'stellar' })).toEqual({
      chain: 'stellar',
      protocol: 'blend',
    });
  });

  it('maps solana to kamino', () => {
    expect(resolveVenueFromAccount({ selectedChain: 'solana' })).toEqual({
      chain: 'solana',
      protocol: 'kamino',
    });
  });

  it('falls back to stellar/blend for unknown', () => {
    expect(resolveVenueFromAccount({ selectedChain: 'polygon' })).toEqual({
      chain: 'stellar',
      protocol: 'blend',
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm --filter @yield2pay/web exec vitest run src/lib/resolveVenueFromAccount.test.ts`  
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export type VenueIdPath = { chain: 'stellar' | 'solana'; protocol: string };

export function resolveVenueFromAccount(account: {
  selectedChain: string;
}): VenueIdPath {
  if (account.selectedChain === 'solana') {
    return { chain: 'solana', protocol: 'kamino' };
  }
  return { chain: 'stellar', protocol: 'blend' };
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit draft (human)**  
Message: `feat(web): resolve venue path from selectedChain`

---
