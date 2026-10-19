import type { ExpenseCategory } from '@yield2pay/shared';

const CATEGORY_KEYWORDS: { category: ExpenseCategory; keywords: string[] }[] = [
  { category: 'housing', keywords: ['aluguel', 'condominio'] },
  { category: 'health', keywords: ['farmacia', 'hospital'] },
  { category: 'education', keywords: ['escola', 'faculdade'] },
  { category: 'subscriptions', keywords: ['netflix', 'spotify'] },
  { category: 'groceries', keywords: ['mercado', 'supermercado'] },
  { category: 'restaurant', keywords: ['restaurante', 'ifood'] },
  { category: 'transport', keywords: ['uber', 'posto'] },
];

export function classifyMerchant(merchant: string): ExpenseCategory {
  const text = merchant.toLowerCase();
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return category;
    }
  }
  return 'shopping';
}

export function isFixedRepeat(previousCents: number, nextCents: number): boolean {
  if (previousCents === 0) {
    return false;
  }
  return Math.abs(nextCents - previousCents) / previousCents <= 0.05;
}
