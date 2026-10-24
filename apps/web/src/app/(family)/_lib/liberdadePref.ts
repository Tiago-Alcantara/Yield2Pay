const KEY = 'y2p-liberdade-v1';
const EVENT = 'y2p-liberdade';

export function readLiberdade(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeLiberdade(on: boolean): void {
  localStorage.setItem(KEY, on ? '1' : '0');
  window.dispatchEvent(new Event(EVENT));
}

export function onLiberdadeChange(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
