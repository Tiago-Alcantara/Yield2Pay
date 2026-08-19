import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type {
  AppEnv,
  ApiErrorPayload,
  ErrorStatusCode,
} from '@yield2pay/shared';
import { generateErrorId, generateRequestId } from './error-id';

/**
 * Status que as telas de erro sabem apresentar (STATUS_COPY em
 * apps/web/src/lib/errorCopy.ts). Qualquer outro é normalizado para um destes.
 */
const RENDERABLE_STATUS_CODES: ErrorStatusCode[] = [
  400, 401, 403, 404, 408, 500, 502, 503,
];

/**
 * Mensagem devolvida no lugar da original quando um 5xx acontece em produção:
 * a mensagem de um erro interno costuma carregar detalhe de infraestrutura
 * (SQL, host, caminho de arquivo) que não deve chegar ao cliente.
 */
const GENERIC_SERVER_ERROR_MESSAGE =
  'Não foi possível concluir a operação. Tente novamente em alguns instantes.';

/**
 * Traduz toda exceção da API para o mesmo corpo (ApiErrorPayload), que é o que
 * a tela cheia (ErrorPage) e o popup (ErrorDialog) consomem.
 *
 * Regra de exposição: `technicalDetails` só é serializado fora de produção.
 * É o par obrigatório do gate de build time do front — em produção o painel
 * técnico não existe no bundle e o backend também não manda o dado.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly appEnv: AppEnv) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const rawStatus =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const statusCode = normalizeStatusCode(rawStatus);
    const errorId = generateErrorId();
    const requestId = readRequestId(request);
    const timestamp = new Date().toISOString();
    const isProduction = this.appEnv === 'production';

    // O log do servidor guarda sempre o erro inteiro, independente do ambiente:
    // é o errorId que liga o print do cliente a esta linha.
    console.error(
      `[ERROR] ${errorId} ${requestId} ${request.method} ${request.url} -> ${statusCode}`,
      exception,
    );

    const payload: ApiErrorPayload = {
      statusCode,
      errorId,
      timestamp,
      message: buildSafeMessage(exception, statusCode, isProduction),
    };

    if (!isProduction) {
      payload.technicalDetails = {
        method: request.method,
        endpoint: request.url,
        requestId,
        message: describeException(exception),
        stack:
          exception instanceof Error
            ? (exception.stack ?? '')
            : String(exception),
      };
    }

    response.status(statusCode).json(payload);
  }
}

function normalizeStatusCode(rawStatus: number): ErrorStatusCode {
  if (RENDERABLE_STATUS_CODES.includes(rawStatus as ErrorStatusCode)) {
    return rawStatus as ErrorStatusCode;
  }
  return rawStatus >= 500 ? 500 : 400;
}

function readRequestId(request: Request): string {
  const incoming = request.headers?.['x-request-id'];
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  return value && value.trim() ? value : generateRequestId();
}

/**
 * Mensagem que vai para o cliente. Em produção um 5xx perde a mensagem
 * original; um 4xx a mantém, porque as mensagens de validação são seguras e o
 * tratamento inline das telas depende delas (ver lib/errors.ts no web).
 */
function buildSafeMessage(
  exception: unknown,
  statusCode: ErrorStatusCode,
  isProduction: boolean,
): string {
  if (isProduction && statusCode >= 500) return GENERIC_SERVER_ERROR_MESSAGE;
  if (!(exception instanceof HttpException))
    return GENERIC_SERVER_ERROR_MESSAGE;

  const body = exception.getResponse();
  if (typeof body === 'string') return body;

  // A ValidationPipe responde { message: string[] }; a tela mostra a primeira.
  const message = (body as { message?: string | string[] }).message;
  if (Array.isArray(message)) return message[0] ?? exception.message;
  return message ?? exception.message;
}

function describeException(exception: unknown): string {
  if (exception instanceof Error)
    return `${exception.name}: ${exception.message}`;
  return String(exception);
}
