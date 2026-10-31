/**
 * Módulo: identity-email
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: O claim assinado entrega o e-mail atual da conta.
 * Sequência: Google vence o e-mail solto; JSON inválido não inventa e-mail.
 */
import { emailFromLinkedAccounts } from './identity-email';

describe('emailFromLinkedAccounts', () => {
  it('prefere o e-mail do Google e aceita a lista em JSON', () => {
    const raw = JSON.stringify([
      { type: 'email', address: 'antigo@example.com' },
      { type: 'google_oauth', email: 'Novo@Example.com' },
    ]);
    expect(emailFromLinkedAccounts(raw)).toBe('novo@example.com');
  });

  it('usa o e-mail solto quando não há Google', () => {
    expect(
      emailFromLinkedAccounts([{ type: 'email', address: 'bia@example.com' }]),
    ).toBe('bia@example.com');
    expect(emailFromLinkedAccounts('nao-json')).toBeNull();
  });
});
