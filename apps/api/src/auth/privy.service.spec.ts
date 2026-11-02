/**
 * Módulo: PrivyService
 * Criado em: 2026-10-21
 * Última atualização: 2026-11-01
 * Intuito: a sessão local da família só vale quando o ambiente pede, e devolve o e-mail fixo.
 * Sequência: com a sessão ligada, o token local autentica e o e-mail sai; com a sessão desligada, o mesmo token é recusado; a sessão ligada só vale com APP_ENV development ou test.
 */
import { describe, expect, it } from 'vitest';
import { PrivyService } from './privy.service';
import type { Env } from '../config/env';

const LOCAL_DEV_USER_ID = 'did:privy:local-dev';

function service(localSession: boolean) {
  return withAppEnv(localSession, 'development');
}

/** Env montado à mão: o appEnv pode vir com qualquer valor, ou sem valor. */
function withAppEnv(localSession: boolean, appEnv: string | undefined) {
  return new PrivyService({
    localSession,
    appEnv,
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

  it.each(['development', 'test'])(
    'aceita a sessão local ligada com APP_ENV=%s',
    async (appEnv) => {
      const privy = withAppEnv(true, appEnv);
      await expect(privy.verify('yield2pay-local-dev')).resolves.toEqual({
        privyUserId: LOCAL_DEV_USER_ID,
        email: 'familia@localhost',
      });
    },
  );

  it.each([
    ['production'],
    ['staging'],
    ['prod'],
    ['homolog'],
    ['DEVELOPMENT'],
    [''],
    [undefined],
  ])('recusa a sessão local ligada com APP_ENV=%s', async (appEnv) => {
    const privy = withAppEnv(true, appEnv);
    await expect(privy.verify('yield2pay-local-dev')).rejects.toThrow(
      'DEV_LOCAL_SESSION=true só é permitido com APP_ENV=development ou APP_ENV=test',
    );
  });
});
