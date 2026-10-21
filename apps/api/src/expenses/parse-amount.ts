export function parseAmountToCents(raw: string): number {
  let normalized = raw.replace(/R\$/g, '').replace(/\s/g, '');
  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  }
  return Math.round(Math.abs(Number(normalized)) * 100);
}

export function parseSignedAmount(raw: string): {
  amountCents: number;
  signed: 'debit' | 'credit' | 'unsigned';
} {
  const compact = raw.replace(/R\$/g, '').replace(/\s/g, '');
  const negative = compact.startsWith('-') || compact.endsWith('-');
  const explicitPositive = compact.startsWith('+');
  return {
    amountCents: parseAmountToCents(compact),
    signed: negative ? 'debit' : explicitPositive ? 'credit' : 'unsigned',
  };
}
