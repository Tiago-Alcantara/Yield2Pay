/**
 * Módulo: error-id
 * Criado em: 2026-08-19
 * Última atualização: 2026-10-22
 * Intuito: Os identificadores de erro e de pedido seguem o formato que a tela mostra.
 * Sequência: generates an error id in the ERR-XXXX-XXXX format; generates a distinct error id on each call; generates a request id prefixed with req_.
 */
import { generateErrorId, generateRequestId } from './error-id';

describe('error-id', () => {
  it('generates an error id in the ERR-XXXX-XXXX format', () => {
    expect(generateErrorId()).toMatch(/^ERR-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('generates a distinct error id on each call', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateErrorId()));
    expect(ids.size).toBe(50);
  });

  it('generates a request id prefixed with req_', () => {
    expect(generateRequestId()).toMatch(/^req_[0-9a-z]{8,}$/);
  });
});
