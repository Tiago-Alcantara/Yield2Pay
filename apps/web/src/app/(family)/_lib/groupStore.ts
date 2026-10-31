/**
 * Grupo de finanças escolhido na doca. Persistido em localStorage['y2p-grupo']
 * e lido com useSyncExternalStore, como familyStore.
 *
 * Os grupos ainda são de exemplo: quando a API expuser vários grupos por
 * usuário, GROUPS passa a vir de householdApi e o painel filtra por `id`.
 */
export type GroupId = 'fam' | 'casa' | 'eu';

export interface FinanceGroup {
  id: GroupId;
  name: string;
  meta: string;
  balance: string;
  initials: string;
}

export const GROUPS: readonly FinanceGroup[] = [
  { id: 'fam', name: 'Família Souza', meta: '4 membros · você é admin', balance: 'R$ 8.240', initials: 'FS' },
  { id: 'casa', name: 'Casa da praia', meta: '2 membros · divide 50/50', balance: 'R$ 1.180', initials: 'CP' },
  { id: 'eu', name: 'Pessoal', meta: 'Gastos individuais', balance: 'R$ 2.065', initials: 'TS' },
];

const KEY = 'y2p-grupo';
const EVENT = 'y2p-grupo';
const DEFAULT: GroupId = 'fam';

function isGroupId(v: string | null): v is GroupId {
  return GROUPS.some((g) => g.id === v);
}

export function readGroup(): GroupId {
  try {
    const v = localStorage.getItem(KEY);
    return isGroupId(v) ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function readGroupServer(): GroupId {
  return DEFAULT;
}

export function writeGroup(id: GroupId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* armazenamento indisponível */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function onGroupChange(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}
