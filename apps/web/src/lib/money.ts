const DECIMALS = 7;

export function formatUsdc(baseUnits: string): string {
  const neg = baseUnits.startsWith('-');
  const digits = (neg ? baseUnits.slice(1) : baseUnits).padStart(DECIMALS + 1, '0');
  const whole = digits.slice(0, digits.length - DECIMALS);
  let frac = digits.slice(digits.length - DECIMALS).replace(/0+$/, '');
  const out = frac ? `${whole}.${frac}` : whole;
  return neg ? `-${out}` : out;
}

export function toBaseUnits(human: string): string {
  if (!/^\d+(\.\d+)?$/.test(human)) throw new Error('invalid amount');
  const [whole, frac = ''] = human.split('.');
  if (frac.length > DECIMALS) throw new Error('too many decimals');
  const base = whole + frac.padEnd(DECIMALS, '0');
  return BigInt(base).toString(); // normalizes leading zeros
}
