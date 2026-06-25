import { AuthGuard } from './auth.guard';
import { UnauthorizedException } from '@nestjs/common';

const ctx = (headers: Record<string, string>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) as any }),
  }) as any;

it('rejects when no bearer token', async () => {
  const guard = new AuthGuard(
    { verify: vi.fn() } as any,
    { findOrCreate: vi.fn() } as any,
  );
  await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(
    UnauthorizedException,
  );
});

it('rejects when bearer token is empty', async () => {
  const guard = new AuthGuard(
    { verify: vi.fn() } as any,
    { findOrCreate: vi.fn() } as any,
  );
  await expect(
    guard.canActivate(ctx({ authorization: 'Bearer ' })),
  ).rejects.toBeInstanceOf(UnauthorizedException);
});

it('rejects when verify throws', async () => {
  const privy = { verify: vi.fn().mockRejectedValue(new Error('expired')) };
  const guard = new AuthGuard(privy as any, { findOrCreate: vi.fn() } as any);
  const req: any = { headers: { authorization: 'Bearer badtoken' } };
  await expect(
    guard.canActivate({
      switchToHttp: () => ({ getRequest: () => req }),
    } as any),
  ).rejects.toBeInstanceOf(UnauthorizedException);
  expect(req.companyId).toBeUndefined();
});

it('verifies token and attaches companyId', async () => {
  const privy = {
    verify: vi.fn().mockResolvedValue({ privyUserId: 'did:privy:z' }),
  };
  const company = { findOrCreate: vi.fn().mockResolvedValue({ id: 'co_9' }) };
  const guard = new AuthGuard(privy as any, company as any);
  const req: any = { headers: { authorization: 'Bearer tok123' } };
  const c = ctx(req.headers);
  (c.switchToHttp().getRequest as any) = () => req;
  const ok = await guard.canActivate({
    switchToHttp: () => ({ getRequest: () => req }),
  } as any);
  expect(ok).toBe(true);
  expect(privy.verify).toHaveBeenCalledWith('tok123');
  expect(req.companyId).toBe('co_9');
});
