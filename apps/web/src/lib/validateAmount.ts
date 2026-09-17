import { toBaseUnitsForVenue } from './money';

/**
 * Valida um valor monetário digitado pelo usuário (depósito, saque, custo de bill).
 * Retorna `null` se válido, ou a mensagem de erro a exibir se inválido.
 */
export function validateAmount(raw: string, decimals = 7): string | null {
  if (!raw || raw === '0') return 'Enter a positive amount';
  const parsed = parseFloat(raw);
  if (isNaN(parsed) || parsed <= 0) return 'Enter a positive amount';
  try {
    toBaseUnitsForVenue(raw, decimals);
    return null;
  } catch {
    return `Max ${decimals} decimal places`;
  }
}
