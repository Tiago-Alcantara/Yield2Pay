import type { CryptoExperience, HouseholdSize, HouseholdSummary } from '@yield2pay/shared';

export const MES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export const nf = (v: number, d = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export const brl = (v: number) => (v < 0 ? '− ' : '') + 'R$ ' + nf(Math.abs(v), 2);
export const brl0 = (v: number) => (v < 0 ? '− ' : '') + 'R$ ' + nf(Math.round(Math.abs(v)));
export const brlK = (v: number) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '− ' : '';
  if (abs >= 1_000_000) return sign + 'R$ ' + (abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
  if (abs >= 1000) return sign + 'R$ ' + (abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
  return brl0(v);
};
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const mesNome = (m: string) => MES[Number(m.slice(5, 7)) - 1] ?? m;

export const reais = (cents: number) => cents / 100;

export const SHADES = ['#E6E8EA', '#C0C2C5', '#A8AAAD', '#8A8D91', '#6A6D72', '#4A4D52', '#3A3D42', '#2A2D31'];
export const PESSOAS = ['Só eu', '2 pessoas', '3 a 4 pessoas', '5 ou mais'] as const;
export const SENTIDOS = [
  'Não depender do salário',
  'Aposentar mais cedo',
  'Sair das dívidas',
  'Estudo dos filhos',
  'Casa própria',
  'Mais tempo com a família',
  'Viajar sem culpa',
];
export const METAS = [
  [6, '6 meses'],
  [12, '1 ano'],
  [24, '2 anos'],
  [60, '5 anos'],
] as const;
export const CRIPTO = [
  ['zero', 'Sim, quero aprender do zero', 'Começo pelo básico, no meu ritmo.'],
  ['fundo', 'Já conheço, quero ir além', 'Rendimento, custódia e planejamento.'],
  ['nao', 'Agora não', 'Posso ver isso depois.'],
] as const;
export const CHARTS = [
  ['cat', 'Categorias'],
  ['mes', 'Mês a mês'],
  ['ritmo', 'Ritmo do mês'],
  ['fixo', 'Fixos × variáveis'],
] as const;

export type ChartId = (typeof CHARTS)[number][0];
export type CriptoAnswer = (typeof CRIPTO)[number][0];
export type MetaMonths = (typeof METAS)[number][0];

export type PainelDraft = {
  pessoas: (typeof PESSOAS)[number] | null;
  renda: number;
  reserva: number;
  sentidos: string[];
  meta: MetaMonths;
  cripto: CriptoAnswer | null;
};

export const DEF: PainelDraft = {
  pessoas: null,
  renda: 12000,
  reserva: 30000,
  sentidos: [],
  meta: 12,
  cripto: null,
};

export const CATEGORY_LABEL = {
  housing: 'Casa',
  health: 'Saúde',
  education: 'Educação',
  subscriptions: 'Assinaturas',
  groceries: 'Mercado',
  restaurant: 'Restaurante',
  transport: 'Transporte',
  shopping: 'Compras e lazer',
} as const;

const SIZE_BY_LABEL: Record<(typeof PESSOAS)[number], HouseholdSize> = {
  'Só eu': 'solo',
  '2 pessoas': 'two',
  '3 a 4 pessoas': 'three_to_four',
  '5 ou mais': 'five_or_more',
};

const LABEL_BY_SIZE: Record<HouseholdSize, (typeof PESSOAS)[number]> = {
  solo: 'Só eu',
  two: '2 pessoas',
  three_to_four: '3 a 4 pessoas',
  five_or_more: '5 ou mais',
};

const CRYPTO_TO_API: Record<CriptoAnswer, CryptoExperience> = {
  zero: 'beginner',
  fundo: 'fund',
  nao: 'declined',
};

const CRYPTO_FROM_API: Record<CryptoExperience, CriptoAnswer> = {
  beginner: 'zero',
  fund: 'fundo',
  declined: 'nao',
};

export const metaLabel = (m: number) => (METAS.find((x) => x[0] === m) || [0, `${m} meses`])[1];

export const mesesTxt = (n: number) => {
  if (n < 12) return n + (n === 1 ? ' mês' : ' meses');
  const a = Math.floor(n / 12);
  const r = n % 12;
  return a + (a === 1 ? ' ano' : ' anos') + (r ? ' e ' + r + (r === 1 ? ' mês' : ' meses') : '');
};

export function saoPauloToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function saoPauloMonth(now = new Date()): string {
  return saoPauloToday(now).slice(0, 7);
}

export function saoPauloDay(now = new Date()): number {
  return Number(saoPauloToday(now).slice(8, 10));
}

export function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

export const MONTH_RANGE_CAP = 36;

export const MONTH_RANGE_CAP_NOTE = 'Mostramos só os primeiros 36 meses deste período.';

export function monthsCovering(from: string, to: string): { months: string[]; truncated: boolean } {
  if (!from || !to) return { months: [], truncated: false };
  const [start, end] = from <= to ? [from.slice(0, 7), to.slice(0, 7)] : [to.slice(0, 7), from.slice(0, 7)];
  const months: string[] = [];
  let cursor = start;
  while (cursor <= end && months.length < MONTH_RANGE_CAP) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return { months, truncated: cursor <= end };
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

export function sortMonths(months: string[]): string[] {
  return [...months].sort();
}

export function openingMonth(months: string[], today = saoPauloToday()): string {
  void months;
  return today.slice(0, 7);
}

export function draftFromProfile(profile: {
  householdSize: HouseholdSize | null;
  monthlyIncomeCents: number | null;
  reserveCents: number | null;
  priorities: string[];
  goalMonths: 6 | 12 | 24 | 60 | null;
  cryptoExperience: CryptoExperience | null;
}): PainelDraft {
  return {
    pessoas: profile.householdSize ? LABEL_BY_SIZE[profile.householdSize] : null,
    renda: profile.monthlyIncomeCents != null ? profile.monthlyIncomeCents / 100 : DEF.renda,
    reserva: profile.reserveCents != null ? profile.reserveCents / 100 : DEF.reserva,
    sentidos: profile.priorities ?? [],
    meta: profile.goalMonths ?? DEF.meta,
    cripto: profile.cryptoExperience ? CRYPTO_FROM_API[profile.cryptoExperience] : null,
  };
}

export function draftToProfile(draft: PainelDraft) {
  if (!draft.pessoas || !draft.cripto) {
    throw new Error('Onboarding incompleto');
  }
  return {
    householdSize: SIZE_BY_LABEL[draft.pessoas],
    monthlyIncomeCents: Math.round(draft.renda * 100),
    reserveCents: Math.round(draft.reserva * 100),
    priorities: draft.sentidos,
    goalMonths: draft.meta,
    cryptoExperience: CRYPTO_TO_API[draft.cripto],
  };
}

export function libertySentence(
  freedom: HouseholdSummary['freedom'],
  reserveCents: number | null | undefined,
  goal: number | null | undefined,
): string {
  if (!freedom || reserveCents == null) return freedomPhrase(freedom);
  const reserva = brl0(reais(reserveCents));
  const meses = nf(freedom.months, 1);
  if (!goal) {
    return 'Se a renda parasse hoje, a reserva de ' + reserva + ' cobriria ' + meses + ' meses de gastos.';
  }
  if (freedom.missingCents > 0 && freedom.deadlineMonths < 0) return freedomPhrase(freedom);
  const reached = Math.round((freedom.months / goal) * 100) >= 100;
  if (reached) {
    const extra = freedom.months - goal;
    const beyond = extra >= 0.1
      ? ', ' + extra.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' além da meta'
      : '';
    return 'Se a renda parasse hoje, a reserva de ' + reserva + ' cobriria ' + meses + ' meses de gastos' + beyond + '.';
  }
  return 'Se a renda parasse hoje, a reserva de ' + reserva + ' cobriria ' + meses + ' meses. Faltam ' + brl0(reais(Math.max(0, freedom.missingCents))) + ' para ' + metaLabel(goal) + '.';
}

export function freedomPhrase(freedom: HouseholdSummary['freedom']): string {
  if (!freedom) {
    return 'Quando a renda, a reserva e a meta estiverem preenchidas, este número mostra por quanto tempo a casa se sustenta.';
  }
  if (freedom.missingCents <= 0) {
    return 'Meta alcançada. A reserva já cobre o tempo que vocês querem.';
  }
  if (freedom.deadlineMonths < 0) {
    return 'Hoje os gastos passam da renda. O primeiro passo é abrir espaço no orçamento.';
  }
  if (freedom.deadlineMonths === 0) {
    return 'Vocês chegam lá em menos de um mês.';
  }
  return 'Vocês chegam lá em ' + mesesTxt(Math.ceil(freedom.deadlineMonths)) + '.';
}

export function lessonTrack(crypto: CryptoExperience | null | undefined): 'beginner' | 'fund' | null {
  if (crypto === 'declined') return null;
  if (crypto === 'fund') return 'fund';
  return 'beginner';
}
