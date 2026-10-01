import { describe, expect, it } from 'vitest';
import { profileFromUser, stellarAddressFromUser } from './user';

describe('stellarAddressFromUser', () => {
  it('lê a carteira Stellar em linkedAccounts', () => {
    expect(
      stellarAddressFromUser({
        linkedAccounts: [
          { type: 'wallet', chainType: 'ethereum', address: '0xabc' },
          { type: 'wallet', chainType: 'stellar', address: 'GABC' },
        ],
      }),
    ).toBe('GABC');
  });

  it('aceita o formato linked_accounts do SDK nativo', () => {
    expect(
      stellarAddressFromUser({
        linked_accounts: [{ type: 'wallet', chain_type: 'stellar', address: 'GXYZ' }],
      }),
    ).toBe('GXYZ');
  });

  it('é nulo sem carteira', () => {
    expect(stellarAddressFromUser(null)).toBeNull();
  });
});

describe('profileFromUser', () => {
  it('usa o e-mail do Google para a rampa', () => {
    expect(
      profileFromUser({
        linked_accounts: [{ type: 'google_oauth', email: 'ana@casa.com' }],
      }),
    ).toEqual({ email: 'ana@casa.com', displayName: 'ana' });
  });
});
