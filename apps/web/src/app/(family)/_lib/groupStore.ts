/**
 * Escolha de grupo na doca. Em produção o seletor de vários grupos fica
 * desligado: a doca mostra só a casa que veio de /account, sem saldo nem meta
 * de exemplo. Um valor de localStorage só passa se for um id curto e seguro.
 */
export const GROUP_STORAGE_KEY = 'y2p-grupo';
const EVENT = 'y2p-grupo';
const MAX_ID_LENGTH = 64;

/**
 * Lista que a API ainda não entrega. Vazia de propósito: nenhum grupo
 * fictício entra aqui. Com a flag ligada, um id só vale se estiver nesta lista.
 */
function knownGroupIds(): readonly string[] {
  return [];
}

/** Seletor de vários grupos. Desligado por padrão. */
export function multiGroupSelectorEnabled(): boolean {
  return false;
}

export function isAllowedGroupId(value: string | null): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_ID_LENGTH) return false;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return false;
  return knownGroupIds().includes(value);
}

export function readGroup(): string | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(GROUP_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!isAllowedGroupId(raw)) return null;
  return raw;
}

export function readGroupServer(): string | null {
  return null;
}

export function writeGroup(id: string): void {
  if (!isAllowedGroupId(id) || !multiGroupSelectorEnabled()) return;
  try {
    localStorage.setItem(GROUP_STORAGE_KEY, id);
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
