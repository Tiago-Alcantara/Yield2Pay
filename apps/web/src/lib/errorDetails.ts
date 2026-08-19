import type {
  ApiErrorPayload,
  ErrorStatusCode,
  ErrorTechnicalDetails,
} from '@yield2pay/shared';
import { ApiError } from './apiError';
import { SHOW_TECHNICAL_DETAILS } from './appEnv';

/** Status que ErrorPage e ErrorDialog sabem apresentar (ver errorCopy.ts). */
const RENDERABLE_STATUS_CODES: ErrorStatusCode[] = [400, 401, 403, 404, 408, 500, 502, 503];

/** Tudo que as telas de erro precisam para se desenhar. */
export interface ErrorDetails {
  statusCode: ErrorStatusCode;
  errorId: string;
  timestamp: string;
  /** Só existe em staging; em produção é sempre undefined. */
  technicalDetails?: ErrorTechnicalDetails;
}

export interface BuildErrorDetailsOptions {
  /** Status para as rotas que não têm objeto de erro (not-found). */
  statusCode?: ErrorStatusCode;
  /** Injetável só para teste; o padrão é o gate de build time. */
  showTechnicalDetails?: boolean;
}

/**
 * Normaliza qualquer erro capturado — resposta da API, crash de render ou valor
 * solto — no formato que ErrorPage e ErrorDialog consomem.
 *
 * O corte de `technicalDetails` aqui é a segunda barreira: a primeira é o
 * backend, que em produção nem serializa o campo.
 */
export function buildErrorDetails(
  error: unknown,
  options: BuildErrorDetailsOptions = {},
): ErrorDetails {
  const showTechnicalDetails = options.showTechnicalDetails ?? SHOW_TECHNICAL_DETAILS;
  const payload = readErrorPayload(error);

  const statusCode = normalizeStatusCode(
    options.statusCode ?? payload?.statusCode ?? (error instanceof ApiError ? error.status : 500),
  );

  const details: ErrorDetails = {
    statusCode,
    errorId: payload?.errorId ?? generateClientErrorId(),
    timestamp: payload?.timestamp ?? new Date().toISOString(),
  };

  if (!showTechnicalDetails) return details;

  const technicalDetails = payload?.technicalDetails ?? describeClientError(error);
  if (technicalDetails) details.technicalDetails = technicalDetails;
  return details;
}

/** Só aceita o corpo se ele tiver a cara do contrato de erro da API. */
function readErrorPayload(error: unknown): ApiErrorPayload | null {
  if (!(error instanceof ApiError)) return null;
  const body = error.body as Partial<ApiErrorPayload> | null;
  if (!body || typeof body.errorId !== 'string' || typeof body.statusCode !== 'number') {
    return null;
  }
  return body as ApiErrorPayload;
}

function normalizeStatusCode(rawStatus: number): ErrorStatusCode {
  if (RENDERABLE_STATUS_CODES.includes(rawStatus as ErrorStatusCode)) {
    return rawStatus as ErrorStatusCode;
  }
  return rawStatus >= 500 ? 500 : 400;
}

/**
 * Erro que nasceu no browser não tem errorId do servidor — geramos um no mesmo
 * formato para o usuário ter o que informar ao suporte.
 */
function generateClientErrorId(): string {
  const hex = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .toUpperCase()
    .padStart(8, '0');
  return `ERR-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/**
 * Painel técnico para um crash de render, que não passou pelo backend. O
 * `digest` do Next entra como requestId porque é por ele que se acha a linha
 * correspondente no log do servidor.
 */
function describeClientError(error: unknown): ErrorTechnicalDetails | null {
  if (!(error instanceof Error)) return null;
  const digest = (error as Error & { digest?: string }).digest;
  return {
    method: '—',
    endpoint: typeof window !== 'undefined' ? window.location.pathname : '—',
    requestId: digest ? `digest_${digest}` : '—',
    message: `${error.name}: ${error.message}`,
    stack: error.stack ?? '',
  };
}
