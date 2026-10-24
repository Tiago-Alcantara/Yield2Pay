/**
 * Produto financeiro oculto nesta versão.
 * A API lê FINANCIAL_PRODUCT_ENABLED. O site lê a mesma variável no servidor
 * e NEXT_PUBLIC_FINANCIAL_PRODUCT no bundle. As duas nascem desligadas.
 */
export function isFinancialProductEnabled(): boolean {
  return (
    process.env.FINANCIAL_PRODUCT_ENABLED === 'true' ||
    process.env.NEXT_PUBLIC_FINANCIAL_PRODUCT === 'true'
  );
}

const BLOCKED_EXACT = new Set([
  '/b2b/dashboard',
  '/b2b/deposit',
  '/b2b/withdraw',
  '/deposit',
  '/withdraw',
  '/deposito',
  '/saque',
  '/family/deposito',
  '/family/saque',
]);

/** Caminhos do produto. O painel de gastos em /dashboard continua no ar. */
export function isBlockedFinancialPath(pathname: string): boolean {
  if (isFinancialProductEnabled()) return false;
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (BLOCKED_EXACT.has(path)) return true;
  return [...BLOCKED_EXACT].some((blocked) => path.startsWith(`${blocked}/`));
}
