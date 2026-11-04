/**
 * Os erros desta pasta nunca carregam endereço. O filtro global escreve a exceção
 * inteira no log, então a mensagem precisa ser segura para qualquer lugar.
 */

/** Endereço, apelido ou rede inválidos. A resposta é genérica: não ecoa o valor. */
export class WalletInvalidError extends Error {
  constructor() {
    super('Endereço ou apelido inválido.');
    this.name = 'WalletInvalidError';
  }
}

export class WalletAccountNotFoundError extends Error {
  constructor() {
    super('conta não encontrada nesta rede');
    this.name = 'WalletAccountNotFoundError';
  }
}

export class WalletDuplicateError extends Error {
  constructor() {
    super('Esta carteira já está no grupo.');
    this.name = 'WalletDuplicateError';
  }
}

export class WalletNotFoundError extends Error {
  constructor() {
    super('Carteira não encontrada.');
    this.name = 'WalletNotFoundError';
  }
}

export class WalletForbiddenError extends Error {
  constructor() {
    super('Só quem adicionou a carteira pode alterar.');
    this.name = 'WalletForbiddenError';
  }
}

export class WalletUpstreamError extends Error {
  constructor() {
    super('Não foi possível consultar a rede agora.');
    this.name = 'WalletUpstreamError';
  }
}

/** Horizon ou BCB fora do ar, ou resposta inesperada. */
export class GatewayUnavailableError extends Error {
  constructor(readonly status: number | null = null) {
    super('Serviço externo indisponível.');
    this.name = 'GatewayUnavailableError';
  }
}

/** 429 do Horizon. O sync para e volta depois do Retry-After. */
export class GatewayRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number | null) {
    super('Limite de pedidos do serviço externo.');
    this.name = 'GatewayRateLimitedError';
  }
}

/** 404 do Horizon. */
export class GatewayNotFoundError extends Error {
  constructor() {
    super('Recurso não encontrado no serviço externo.');
    this.name = 'GatewayNotFoundError';
  }
}
