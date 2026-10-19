export function parseAmountToCents(raw: string): number {
  let normalized = raw.replace(/R\$/g, '').replace(/\s/g, '');
  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  }
  return Math.round(Math.abs(Number(normalized)) * 100);
}
