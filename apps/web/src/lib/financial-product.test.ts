import { afterEach, describe, expect, it } from 'vitest';
import { isBlockedFinancialPath, isFinancialProductEnabled } from './financial-product';

describe('produto financeiro oculto', () => {
  const previous = process.env.FINANCIAL_PRODUCT_ENABLED;
  const previousPublic = process.env.NEXT_PUBLIC_FINANCIAL_PRODUCT;

  afterEach(() => {
    process.env.FINANCIAL_PRODUCT_ENABLED = previous;
    process.env.NEXT_PUBLIC_FINANCIAL_PRODUCT = previousPublic;
  });

  it('bloqueia as telas do produto e deixa o painel de gastos', () => {
    delete process.env.FINANCIAL_PRODUCT_ENABLED;
    delete process.env.NEXT_PUBLIC_FINANCIAL_PRODUCT;
    expect(isFinancialProductEnabled()).toBe(false);
    expect(isBlockedFinancialPath('/b2b/dashboard')).toBe(true);
    expect(isBlockedFinancialPath('/b2b/deposit')).toBe(true);
    expect(isBlockedFinancialPath('/b2b/withdraw')).toBe(true);
    expect(isBlockedFinancialPath('/deposito')).toBe(true);
    expect(isBlockedFinancialPath('/saque/')).toBe(true);
    expect(isBlockedFinancialPath('/family/deposito')).toBe(true);
    expect(isBlockedFinancialPath('/dashboard')).toBe(false);
    expect(isBlockedFinancialPath('/aprender')).toBe(false);
  });

  it('libera as telas quando a flag está ligada', () => {
    process.env.FINANCIAL_PRODUCT_ENABLED = 'true';
    expect(isBlockedFinancialPath('/b2b/dashboard')).toBe(false);
    expect(isBlockedFinancialPath('/deposito')).toBe(false);
  });
});
