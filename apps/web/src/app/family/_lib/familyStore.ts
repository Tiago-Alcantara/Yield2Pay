import type { FamilyLang } from './familyI18n';
import type { FamilySub } from './familyMath';

/**
 * Store das telas de família.
 *
 * É um store externo (módulo) lido com useSyncExternalStore, e não useState +
 * useEffect: assim o valor guardado no localStorage entra na hidratação sem
 * setState dentro de effect — mesmo padrão de src/lib/useIsMobile.ts.
 *
 * Tudo aqui é mock. Privy (login/carteira) e DeFindex (cofre) entram depois:
 * quando entrarem, este módulo passa a hidratar da API e as telas não mudam.
 */

export interface FamilyDevice {
  id: string;
  name: string;
  sub: string;
  /** Aparelho atual: não pode ter a sessão encerrada. */
  current?: boolean;
  ended?: boolean;
}

export interface FamilyProfile {
  name: string;
  email: string;
  phone: string;
  /** CPF já mascarado — verificado e imutável. */
  cpfMask: string;
  hasPhoto: boolean;
}

export interface FamilyNotifications {
  channels: { email: boolean; push: boolean };
  events: {
    paga: boolean;
    deposito: boolean;
    saque: boolean;
    liberdade: boolean;
    lembrete: boolean;
  };
}

export interface FamilyState {
  lang: FamilyLang;
  /** Já passou pelo onboarding (login + primeiro depósito). */
  onboarded: boolean;
  /** Saldo depositado, em R$. */
  deposit: number;
  /** Cenário de rendimento escolhido: 6, 8 ou 10 (% a.a.). */
  rate: number;
  subs: FamilySub[];
  profile: FamilyProfile;
  walletAddress: string;
  pixKey: string;
  twoFA: boolean;
  devices: FamilyDevice[];
  autoDeposit: { on: boolean; amount: string; freq: string };
  notifications: FamilyNotifications;
}

export const DEFAULT_FAMILY_STATE: FamilyState = {
  lang: 'pt',
  onboarded: false,
  deposit: 0,
  rate: 8,
  subs: [
    { id: 'netflix', name: 'Netflix', price: 59.9, dia: 5 },
    { id: 'spotify', name: 'Spotify Família', price: 34.9, dia: 8 },
    { id: 'chatgpt', name: 'ChatGPT', price: 107, dia: 12 },
    { id: 'academia', name: 'Academia', price: 129.9, dia: 10 },
  ],
  profile: {
    name: 'Ana & Pedro',
    email: 'ana.pedro@email.com',
    phone: '',
    cpfMask: '•••.456.789-••',
    hasPhoto: false,
  },
  walletAddress: 'GBRL…4F2K',
  pixKey: 'ana.pedro@email.com',
  twoFA: true,
  devices: [
    { id: 'd1', name: 'iPhone de Ana', sub: 'Este aparelho · agora', current: true },
    { id: 'd2', name: 'Chrome · MacBook', sub: 'São Paulo · ontem, 21:40' },
    { id: 'd3', name: 'Pixel de Pedro', sub: 'São Paulo · há 3 dias' },
  ],
  autoDeposit: { on: true, amount: '500', freq: 'mensal' },
  notifications: {
    channels: { email: true, push: true },
    events: { paga: true, deposito: true, saque: true, liberdade: false, lembrete: true },
  },
};

/** Depósito semeado quando a família conclui o onboarding sem digitar valor. */
export const SEED_DEPOSIT = 30000;

const STORAGE_KEY = 'y2p:family:v1';

let current: FamilyState = DEFAULT_FAMILY_STATE;
let restored = false;
const listeners = new Set<() => void>();

/** Lê o localStorage uma única vez, na primeira leitura feita no cliente. */
function restore(): void {
  if (restored) return;
  restored = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) current = { ...current, ...(JSON.parse(raw) as Partial<FamilyState>) };
  } catch {
    /* storage indisponível (modo privado, por exemplo): segue com o padrão */
  }
}

export function subscribeFamilyStore(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getFamilySnapshot(): FamilyState {
  restore();
  return current;
}

/** No servidor não há storage: o snapshot é sempre o estado inicial. */
export function getFamilyServerSnapshot(): FamilyState {
  return DEFAULT_FAMILY_STATE;
}

export function updateFamilyStore(reducer: (prev: FamilyState) => FamilyState): void {
  restore();
  const next = reducer(current);
  if (next === current) return;
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* idem */
  }
  listeners.forEach((listener) => listener());
}

/** Usado nos testes para começar de um estado limpo. */
export function resetFamilyStore(): void {
  current = DEFAULT_FAMILY_STATE;
  restored = true;
  listeners.forEach((listener) => listener());
}
