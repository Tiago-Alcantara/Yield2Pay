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
