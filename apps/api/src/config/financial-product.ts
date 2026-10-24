/** Produto financeiro (cofre, carteira, depósito, saque, ramp). Desligado por padrão. */
export function isFinancialProductEnabled(
  raw: Record<string, string | undefined> = process.env,
): boolean {
  return raw.FINANCIAL_PRODUCT_ENABLED === 'true';
}
