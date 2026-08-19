import type { ErrorStatusCode } from '@yield2pay/shared';
import type { ErrorDetails } from './errorDetails';
import { DIALOG_STATUS_CODES, type DialogStatusCode } from './errorCopy';

/**
 * Canal entre quem descobre o erro (o client de API, que é função pura) e quem
 * o desenha (o ErrorDialogProvider, que é componente). Store de módulo, e não
 * context, porque createApi é chamado fora da árvore React.
 *
 * Um diálogo por vez: o popup é modal, então empilhar não faria sentido.
 */
let currentNotification: ErrorDetails | null = null;
const listeners = new Set<() => void>();

/**
 * Status sem cópia de popup viram o vizinho mais próximo que tem: um 502/503
 * continua sendo "falha do nosso lado" e um 404 de ação continua sendo um
 * pedido que não pôde ser atendido. Sem isso o erro sumiria da tela.
 */
const DIALOG_STATUS_FALLBACK: Record<number, DialogStatusCode> = {
  404: 400,
  502: 500,
  503: 500,
};

function toDialogStatusCode(statusCode: ErrorStatusCode): DialogStatusCode {
  if ((DIALOG_STATUS_CODES as readonly number[]).includes(statusCode)) {
    return statusCode as DialogStatusCode;
  }
  return DIALOG_STATUS_FALLBACK[statusCode] ?? 500;
}

export function publishErrorNotification(details: ErrorDetails): void {
  const statusCode = toDialogStatusCode(details.statusCode);

  // Uma tela que refaz a chamada sozinha (retry, polling) produziria o mesmo
  // erro várias vezes; trocar o diálogo por outro idêntico só piscaria a tela.
  if (currentNotification && currentNotification.statusCode === statusCode) return;

  currentNotification = { ...details, statusCode };
  emit();
}

export function dismissErrorNotification(): void {
  if (currentNotification === null) return;
  currentNotification = null;
  emit();
}

export function subscribeToErrorNotifications(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Snapshot para useSyncExternalStore. */
export function getErrorNotification(): ErrorDetails | null {
  return currentNotification;
}

/** No servidor nunca há diálogo aberto — ele nasce de uma ação do usuário. */
export function getServerErrorNotification(): ErrorDetails | null {
  return null;
}

function emit(): void {
  for (const listener of listeners) listener();
}
