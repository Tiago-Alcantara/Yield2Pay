import { PrivyService } from './privy.service';
import type { Env } from '../config/env';

function service(localSession: boolean) {
  return new PrivyService({
    localSession,
    privyAppId: 'privy_app_id',
    privyAppSecret: 'privy_app_secret',
  } as Env);
}

it('accepts the local family session when it is enabled', async () => {
  const privy = service(true);
  await expect(privy.verify('yield2pay-local-dev')).resolves.toEqual({
    privyUserId: 'did:privy:local-dev',
  });
  await expect(privy.getEmail(LOCAL_DEV_USER_ID)).resolves.toBe('familia@localhost');
});

it('rejects the local family session when it is disabled', async () => {
  const privy = service(false);
  await expect(privy.verify('yield2pay-local-dev')).rejects.toThrow();
});
