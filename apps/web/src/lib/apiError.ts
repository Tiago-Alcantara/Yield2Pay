/**
 * Erro lançado pelo client de API em toda resposta fora da faixa 2xx.
 *
 * Mora num módulo próprio (e não em api.ts) para que errorDetails.ts possa
 * reconhecê-lo sem fechar um ciclo de import: api.ts importa errorDetails.ts
 * para publicar a notificação do popup.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`ApiError: ${status}`);
    this.name = 'ApiError';
  }
}
