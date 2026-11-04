/**
 * Módulo: all-exceptions.filter
 * Criado em: 2026-08-19
 * Última atualização: 2026-10-22
 * Intuito: Todo erro da API sai no mesmo corpo, sem stack, e a mensagem de produção não vaza detalhe interno.
 * Sequência: responds with the payload contract and the exception status; omits technicalDetails in production; includes technicalDetails in staging; reuses the incoming x-request-id as requestId; turns an unhandled throw into a 500; replaces the message of a 5xx in production so no internal detail leaks; keeps the 4xx message in production because the UI relies on it; normalizes a status outside the closed set; keeps the statuses the error screens know how to render; flattens the array of messages from the ValidationPipe; logs the errorId together with the request so the log matches the screen; a body parser error answers "JSON inválido" and leaves its text out of the response, the technical details and the log, whether it arrives raw or already converted by Nest; a 400 raised inside a route keeps its message; a bad path encoding keeps its message.
 */
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
} from '@nestjs/common';
import type { ApiErrorPayload } from '@yield2pay/shared';
import { AllExceptionsFilter } from './all-exceptions.filter';

type Captured = { status: number; body: ApiErrorPayload };

/**
 * ArgumentsHost mínimo: o filter só usa getRequest/getResponse do contexto HTTP.
 * `captured` recebe o que o filter escreveu na resposta.
 */
function makeHost(
  captured: Captured,
  request: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    route?: object;
  } = {},
): ArgumentsHost {
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: ApiErrorPayload) {
      captured.body = body;
      return this;
    },
  };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({
        method: request.method ?? 'GET',
        url: request.url ?? '/dashboard',
        headers: request.headers ?? {},
        route: request.route,
      }),
    }),
  } as unknown as ArgumentsHost;
}

function capture(
  filter: AllExceptionsFilter,
  exception: unknown,
  request?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    route?: object;
  },
): Captured {
  const captured = {} as Captured;
  filter.catch(exception, makeHost(captured, request));
  return captured;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('all-exceptions.filter', () => {
  it('responds with the payload contract and the exception status', () => {
    const filter = new AllExceptionsFilter('production');
    const { status, body } = capture(
      filter,
      new HttpException('Sessão expirada', HttpStatus.UNAUTHORIZED),
    );

    expect(status).toBe(401);
    expect(body.statusCode).toBe(401);
    expect(body.message).toBe('Sessão expirada');
    expect(body.errorId).toMatch(/^ERR-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('omits technicalDetails in production', () => {
    const filter = new AllExceptionsFilter('production');
    const { body } = capture(filter, new Error('Cannot read balanceCents'));

    expect(body.technicalDetails).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('balanceCents');
  });

  it('includes technicalDetails in staging', () => {
    const filter = new AllExceptionsFilter('staging');
    const { body } = capture(filter, new Error('Cannot read balanceCents'), {
      method: 'POST',
      url: '/deposit/build',
    });

    expect(body.technicalDetails).toMatchObject({
      method: 'POST',
      endpoint: '/deposit/build',
      message: 'Error: Cannot read balanceCents',
    });
    expect(body.technicalDetails).not.toHaveProperty('stack');
    expect(JSON.stringify(body)).not.toContain('all-exceptions.filter.spec');
    expect(body.technicalDetails?.requestId).toMatch(/^req_/);
  });

  it('reuses the incoming x-request-id as requestId', () => {
    const filter = new AllExceptionsFilter('staging');
    const { body } = capture(filter, new Error('boom'), {
      headers: { 'x-request-id': 'req_from_gateway' },
    });

    expect(body.technicalDetails?.requestId).toBe('req_from_gateway');
  });

  it('turns an unhandled throw into a 500', () => {
    const filter = new AllExceptionsFilter('production');
    const { status, body } = capture(filter, new Error('boom'));

    expect(status).toBe(500);
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe(
      'Não foi possível concluir a operação. Tente novamente em alguns instantes.',
    );
  });

  it('replaces the message of a 5xx in production so no internal detail leaks', () => {
    const filter = new AllExceptionsFilter('production');
    const { body } = capture(
      filter,
      new HttpException('pg: relation "wallet" does not exist', 500),
    );

    expect(body.message).not.toContain('relation');
  });

  it('keeps the 4xx message in production because the UI relies on it', () => {
    const filter = new AllExceptionsFilter('production');
    const { body } = capture(
      filter,
      new HttpException('amount must be positive', 400),
    );

    expect(body.message).toBe('amount must be positive');
  });

  it('normalizes a status outside the closed set', () => {
    const filter = new AllExceptionsFilter('production');

    expect(
      capture(filter, new HttpException('unprocessable', 422)).body.statusCode,
    ).toBe(400);
    expect(
      capture(filter, new HttpException('too many', 429)).body.statusCode,
    ).toBe(400);
    expect(
      capture(filter, new HttpException('gateway timeout', 504)).body
        .statusCode,
    ).toBe(500);
  });

  it('keeps the statuses the error screens know how to render', () => {
    const filter = new AllExceptionsFilter('production');

    for (const code of [400, 401, 403, 404, 409, 408, 500, 502, 503]) {
      expect(
        capture(filter, new HttpException('x', code)).body.statusCode,
      ).toBe(code);
    }
  });

  it('flattens the array of messages from the ValidationPipe', () => {
    const filter = new AllExceptionsFilter('production');
    const { body } = capture(
      filter,
      new HttpException(
        { message: ['amount must be positive', 'amount is required'] },
        400,
      ),
    );

    expect(body.message).toBe('amount must be positive');
  });

  it('logs the errorId together with the request so the log matches the screen', () => {
    const logged: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation(
      (...args) => void logged.push(args),
    );

    const filter = new AllExceptionsFilter('production');
    const { body } = capture(filter, new Error('boom'), {
      method: 'POST',
      url: '/deposit/build',
    });

    const line = logged.map((args) => args.join(' ')).join('\n');
    expect(line).toContain(body.errorId);
    expect(line).toContain('POST /deposit/build');
  });

  describe('body parser error', () => {
    const FRAGMENT = 'SABAEAQCAI';
    const parserText = `Unexpected token 'S', "{"address":${FRAGMENT}"... is not valid JSON`;
    // Como o body-parser entrega: SyntaxError com type e o corpo cru.
    const rawParserError = () =>
      Object.assign(new SyntaxError(parserText), {
        type: 'entity.parse.failed',
        status: 400,
        body: `{"address":${FRAGMENT}`,
      });

    function logged() {
      const lines: unknown[][] = [];
      vi.spyOn(console, 'error').mockImplementation(
        (...args) => void lines.push(args),
      );
      return () =>
        lines
          .flat()
          .map((arg) =>
            arg instanceof Error
              ? `${arg.message} ${arg.stack} ${JSON.stringify(arg)}`
              : String(arg),
          )
          .join('\n');
    }

    it.each([
      ['raw, with type', rawParserError],
      [
        'raw, without type',
        () => {
          const error = rawParserError() as unknown as { type?: string };
          delete error.type;
          return error;
        },
      ],
      // Como o Nest entrega ao filtro: mapExternalException troca o SyntaxError.
      ['converted by Nest', () => new BadRequestException(parserText)],
    ])(
      'answers "JSON inválido" and leaves its text out of everything: %s',
      (_name, makeError) => {
        const readLog = logged();
        const { status, body } = capture(
          new AllExceptionsFilter('staging'),
          makeError(),
          { method: 'POST', url: '/household-wallets' },
        );

        expect(status).toBe(400);
        expect(body.message).toBe('JSON inválido');
        expect(body.technicalDetails?.message).toBe('JSON inválido');
        expect(JSON.stringify(body)).not.toContain(FRAGMENT);
        const log = readLog();
        expect(log).toContain(body.errorId);
        expect(log).toContain('POST /household-wallets');
        expect(log).not.toContain(FRAGMENT);
      },
    );

    it('a 400 raised inside a route keeps its message', () => {
      const { body } = capture(
        new AllExceptionsFilter('production'),
        new BadRequestException('Endereço ou apelido inválido.'),
        { route: { path: '/household-wallets' } },
      );

      expect(body.message).toBe('Endereço ou apelido inválido.');
    });

    it('a SyntaxError from our own code is still a 500', () => {
      const { status, body } = capture(
        new AllExceptionsFilter('production'),
        new SyntaxError('bad cached json'),
      );

      expect(status).toBe(500);
      expect(body.message).not.toContain('bad cached json');
    });

    it('a bad path encoding keeps its message', () => {
      const { body } = capture(
        new AllExceptionsFilter('production'),
        new BadRequestException("Failed to decode param '%FF'"),
      );

      expect(body.message).toBe("Failed to decode param '%FF'");
    });
  });
});
