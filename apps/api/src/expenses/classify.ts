import type { ExpenseCategory } from '@yield2pay/shared';

const CATEGORY_KEYWORDS: { category: ExpenseCategory; keywords: string[] }[] = [
  {
    category: 'housing',
    keywords: [
      'aluguel', 'condominio', 'iptu', 'financiamento', 'quintoandar',
      'enel', 'cemig', 'copel', 'eletropaulo', 'sabesp', 'comgas', 'sanepar',
    ],
  },
  {
    category: 'health',
    keywords: [
      'farmacia', 'hospital', 'clinica', 'laboratorio', 'drogaria', 'drogasil',
      'raia', 'pacheco', 'unimed', 'amil', 'hapvida', 'odonto',
    ],
  },
  {
    category: 'education',
    keywords: ['escola', 'faculdade', 'colegio', 'universidade', 'mensalidade'],
  },
  {
    category: 'subscriptions',
    keywords: [
      'netflix', 'spotify', 'disney', 'globoplay', 'deezer', 'youtube',
      'icloud', 'adobe', 'vivo', 'claro', 'hbo', 'prime video',
    ],
  },
  {
    category: 'groceries',
    keywords: [
      'mercado', 'supermercado', 'hortifruti', 'padaria', 'acougue',
      'carrefour', 'assai', 'atacadao', 'oxxo', 'pao de acucar',
    ],
  },
  {
    category: 'restaurant',
    keywords: [
      'restaurante', 'ifood', 'rappi', 'uber eats', 'ubereats',
      'pizzaria', 'mcdonald', 'habib', 'outback', 'cafeteria',
    ],
  },
  {
    category: 'transport',
    keywords: [
      'uber', '99 pop', '99pop', '99app', 'posto', 'ipiranga', 'shell',
      'combustivel', 'estacionamento', 'pedagio', 'sem parar', 'cabify',
      'metro', 'onibus', 'cptm',
    ],
  },
];

const SHORT_KEYWORDS: { category: ExpenseCategory; keyword: string }[] = [
  { category: 'subscriptions', keyword: 'tim' },
  { category: 'subscriptions', keyword: 'oi' },
  { category: 'transport', keyword: '99' },
  { category: 'housing', keyword: 'light' },
];

export function classifyMerchant(merchant: string): ExpenseCategory {
  const text = fold(merchant);
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => hasKeyword(text, keyword))) {
      return category;
    }
  }
  for (const { category, keyword } of SHORT_KEYWORDS) {
    if (hasKeyword(text, keyword)) {
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

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function hasKeyword(text: string, keyword: string): boolean {
  if (keyword.length > 3) {
    return text.includes(keyword);
  }
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}
