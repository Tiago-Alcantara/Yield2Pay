import type { ExpenseCategory } from '@yield2pay/shared';

const CATEGORY_KEYWORDS: { category: ExpenseCategory; keywords: string[] }[] = [
  {
    category: 'housing',
    keywords: [
      'aluguel',
      'condominio',
      'iptu',
      'financiamento',
      'quintoandar',
      'enel',
      'cemig',
      'copel',
      'eletropaulo',
      'sabesp',
      'comgas',
      'sanepar',
      'conta de luz',
      'energia',
      'cpfl',
      'celesc',
      'neoenergia',
      'tarifa',
    ],
  },
  {
    category: 'health',
    keywords: [
      'farmacia',
      'hospital',
      'clinica',
      'laboratorio',
      'drogaria',
      'drogasil',
      'raia',
      'pacheco',
      'unimed',
      'amil',
      'hapvida',
      'odonto',
    ],
  },
  {
    category: 'education',
    keywords: ['escola', 'faculdade', 'colegio', 'universidade', 'mensalidade'],
  },
  {
    category: 'subscriptions',
    keywords: [
      'netflix',
      'spotify',
      'disney',
      'globoplay',
      'deezer',
      'youtube',
      'icloud',
      'adobe',
      'vivo',
      'claro',
      'hbo',
      'prime video',
    ],
  },
  {
    category: 'groceries',
    keywords: [
      'mercado',
      'supermercado',
      'hortifruti',
      'padaria',
      'acougue',
      'carrefour',
      'assai',
      'atacadao',
      'oxxo',
      'pao de acucar',
    ],
  },
  {
    category: 'restaurant',
    keywords: [
      'restaurante',
      'ifood',
      'rappi',
      'uber eats',
      'ubereats',
      'pizzaria',
      'mcdonald',
      'habib',
      'outback',
      'cafeteria',
    ],
  },
  {
    category: 'transport',
    keywords: [
      'uber',
      '99 pop',
      '99pop',
      '99app',
      'posto',
      'ipiranga',
      'shell',
      'combustivel',
      'estacionamento',
      'pedagio',
      'sem parar',
      'cabify',
      'ipva',
      'dpvat',
      'licenciamento',
      'metro',
      'onibus',
      'cptm',
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

const MONTH_WORD =
  /\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/g;

export function merchantKey(name: string): string {
  const folded = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[.\-_/]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(MONTH_WORD, ' ')
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return folded || name.trim().toLowerCase();
}

export function sharedMerchantKey(
  key: string,
  keys: readonly string[] | ReadonlySet<string>,
): string {
  const keySet = keys instanceof Set ? keys : new Set(keys);
  const parts = key.split(' ');
  let prefix = '';
  for (let index = 0; index < parts.length - 1; index += 1) {
    prefix = index === 0 ? (parts[0] ?? '') : `${prefix} ${parts[index] ?? ''}`;
    if (prefix.length >= 4 && keySet.has(prefix)) return prefix;
  }
  return key;
}

export function idsToMarkFixed(
  rows: Array<{
    id: string;
    merchant: string;
    spentOn: string;
    amountCents: number;
    category: string;
  }>,
): string[] {
  const keys = rows.map((row) => merchantKey(row.merchant));
  const keySet = new Set(keys);
  const groups = new Map<string, typeof rows>();
  rows.forEach((row, index) => {
    const key = sharedMerchantKey(keys[index] ?? '', keySet);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  });
  const ids: string[] = [];
  for (const group of groups.values()) {
    const months = new Set(group.map((row) => row.spentOn.slice(0, 7)));
    if (months.size < 2) continue;
    const anchor = group[0]?.amountCents ?? 0;
    const stable = group.every(
      (row) =>
        isFixedRepeat(anchor, row.amountCents) ||
        isFixedRepeat(row.amountCents, anchor),
    );
    const bill = group.every(
      (row) => row.category === 'housing' || row.category === 'subscriptions',
    );
    if (!stable && !bill) continue;
    ids.push(...group.map((row) => row.id));
  }
  return ids;
}

export function isFixedRepeat(
  previousCents: number,
  nextCents: number,
): boolean {
  if (previousCents === 0) {
    return false;
  }
  return Math.abs(nextCents - previousCents) / previousCents <= 0.05;
}

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function hasKeyword(text: string, keyword: string): boolean {
  if (keyword.length > 3) {
    return text.includes(keyword);
  }
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}
