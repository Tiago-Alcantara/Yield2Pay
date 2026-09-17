export type VenueIdPath = { chain: 'stellar' | 'solana'; protocol: string };

export function resolveVenueFromAccount(account: {
  selectedChain: string;
}): VenueIdPath {
  if (account.selectedChain === 'solana') {
    return { chain: 'solana', protocol: 'kamino' };
  }
  return { chain: 'stellar', protocol: 'blend' };
}
