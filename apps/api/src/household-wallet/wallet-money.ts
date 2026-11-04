/** Contas em inteiros: quantidade e preço com 7 casas, sem passar por float. */
const SCALE = 7;
const UNIT = 10n ** BigInt(SCALE);

/** Maior valor da coluna amount_cents (Int). */
export const MAX_AMOUNT_CENTS = 2_147_483_647;

/** "12.5" com scale 7 vira 125000000n. Corta o que passa da escala. */
export function toScaled(value: string, scale = SCALE): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new Error('valor decimal inválido');
  const [, sign, whole, fraction = ''] = match;
  const digits = `${whole}${fraction.padEnd(scale, '0').slice(0, scale)}`;
  const scaled = BigInt(digits);
  return sign ? -scaled : scaled;
}

export function fromScaled(value: bigint): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value)
    .toString()
    .padStart(SCALE + 1, '0');
  const whole = digits.slice(0, -SCALE);
  const fraction = digits.slice(-SCALE);
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Centavos de real por unidade do ativo, com 7 casas. */
export function priceCentsPerUnit(usdPerUnit: string, brlPerUsd: string) {
  const scaled = toScaled(usdPerUnit) * toScaled(brlPerUsd) * 100n;
  return fromScaled(roundDiv(scaled, UNIT));
}

/** Quantidade × preço, em centavos inteiros. Arredonda meio para cima. */
export function valueInCents(quantity: string, price: string): number | null {
  const cents = roundDiv(toScaled(quantity) * toScaled(price), UNIT * UNIT);
  if (cents > BigInt(MAX_AMOUNT_CENTS)) return null;
  return Number(cents);
}

export function stroopsToQuantity(stroops: string | bigint): string {
  return fromScaled(BigInt(stroops));
}

function roundDiv(value: bigint, divisor: bigint): bigint {
  return (value + divisor / 2n) / divisor;
}
