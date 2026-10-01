export function stellarAddressFromUser(user: unknown): string | null {
  const accounts = linkedAccounts(user);
  for (const account of accounts) {
    const chain = account.chainType ?? account.chain_type;
    if (account.type === 'wallet' && chain === 'stellar' && typeof account.address === 'string') {
      return account.address;
    }
  }
  return null;
}

export function profileFromUser(user: unknown): { email: string; displayName: string } {
  const email = readEmail(user) ?? 'cliente@yield2pay.app';
  const local = email.split('@')[0];
  return { email, displayName: local || 'Cliente' };
}

function readEmail(user: unknown): string | null {
  if (!user || typeof user !== 'object') return null;
  const record = user as Record<string, unknown>;
  const email = record.email;
  if (email && typeof email === 'object' && typeof (email as { address?: unknown }).address === 'string') {
    return (email as { address: string }).address;
  }
  for (const account of linkedAccounts(user)) {
    if (account.type === 'email' && typeof account.address === 'string') return account.address;
    if (typeof account.email === 'string') return account.email;
  }
  return null;
}

function linkedAccounts(user: unknown): Array<Record<string, unknown>> {
  if (!user || typeof user !== 'object') return [];
  const record = user as Record<string, unknown>;
  const accounts = record.linked_accounts ?? record.linkedAccounts;
  if (!Array.isArray(accounts)) return [];
  return accounts.filter((account): account is Record<string, unknown> => !!account && typeof account === 'object');
}
