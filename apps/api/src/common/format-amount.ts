const DECIMALS = 7n;
const DIVISOR = 10n ** DECIMALS;

/**
 * Converte um valor em base units (stroops, 7 casas) para a string decimal de XLM
 * esperada por `Operation.payment` do @stellar/stellar-sdk.
 *
 * Ex.: 100000000n -> "10", 105000000n -> "10.5", 1n -> "0.0000001".
 * Aceita apenas valores positivos (depósitos).
 */
export function toStellarAmount(baseUnits: bigint): string {
  if (baseUnits <= 0n) {
    throw new Error('toStellarAmount: baseUnits must be positive');
  }
  const whole = baseUnits / DIVISOR;
  const frac = baseUnits % DIVISOR;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(7, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}
