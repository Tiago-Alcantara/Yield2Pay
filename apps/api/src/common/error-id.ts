import { randomBytes } from 'node:crypto';

/**
 * Código curto que o usuário vê na tela de erro e informa ao suporte
 * (formato ERR-8F3A-2C91). O mesmo valor vai para o log do servidor, então é
 * ele que liga o print do cliente à linha de log.
 */
export function generateErrorId(): string {
  const hex = randomBytes(4).toString('hex').toUpperCase();
  return `ERR-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/**
 * Identificador da requisição exibido no painel técnico (só em staging).
 * Distinto do errorId: o errorId é do erro, o requestId é da chamada HTTP.
 */
export function generateRequestId(): string {
  return `req_${randomBytes(6).toString('hex')}`;
}
