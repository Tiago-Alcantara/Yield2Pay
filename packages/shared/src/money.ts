const DECIMALS = 7;
const DISPLAY_DECIMALS = 2;

export function formatUsdc(baseUnits: string): string {
  const neg = baseUnits.startsWith('-');
  const raw = (neg ? baseUnits.slice(1) : baseUnits) || '0';
  // Round base units (7 dp) down to DISPLAY_DECIMALS, half-up.
  const scale = BigInt(10) ** BigInt(DECIMALS - DISPLAY_DECIMALS);
  const rounded = (BigInt(raw) + scale / BigInt(2)) / scale;
  const digits = rounded.toString().padStart(DISPLAY_DECIMALS + 1, '0');
  const whole = digits.slice(0, digits.length - DISPLAY_DECIMALS);
  const frac = digits.slice(digits.length - DISPLAY_DECIMALS);
  const out = `${whole}.${frac}`;
  return neg && rounded !== BigInt(0) ? `-${out}` : out;
}

export function toBaseUnits(human: string): string {
  if (!/^\d+(\.\d+)?$/.test(human)) throw new Error('invalid amount');
  const [whole, frac = ''] = human.split('.');
  if (frac.length > DECIMALS) throw new Error('too many decimals');
  const base = whole + frac.padEnd(DECIMALS, '0');
  return BigInt(base).toString(); // normalizes leading zeros
}
