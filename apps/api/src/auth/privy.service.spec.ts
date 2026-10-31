/**
 * Módulo: PrivyService
 * Criado em: 2026-10-21
 * Última atualização: 2026-10-22
 * Intuito: a sessão local da família só vale quando o ambiente pede, e devolve o e-mail fixo.
 * Sequência: com a sessão ligada, o token local autentica e o e-mail sai; com a sessão desligada, o mesmo token é recusado.
 */
import { describe, expect, it } from 'vitest';
import { PrivyService } from './privy.service';
import type { Env } from '../config/env';

const LOCAL_DEV_USER_ID = 'did:privy:local-dev';

function service(localSession: boolean) {
  return new PrivyService({
    localSession,
    privyAppId: 'privy_app_id',
    privyAppSecret: 'privy_app_secret',
  } as Env);
}

describe('PrivyService', () => {
  it('aceita a sessão local da família quando ela está ligada', async () => {
    const privy = service(true);
    await expect(privy.verify('yield2pay-local-dev')).resolves.toEqual({
      privyUserId: LOCAL_DEV_USER_ID,
      email: 'familia@localhost',
    });
    await expect(privy.getEmail(LOCAL_DEV_USER_ID)).resolves.toBe(
      'familia@localhost',
    );
  });

  it('recusa a sessão local quando ela está desligada', async () => {
    const privy = service(false);
    await expect(privy.verify('yield2pay-local-dev')).rejects.toThrow();
  });
});
