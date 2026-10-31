/**
 * Módulo: auth.guard
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: O guarda só deixa passar um token que o Privy confirma, e grava o companyId no pedido.
 * Sequência: rejects when no bearer token; rejects when bearer token is empty; rejects when verify throws; verifies token and attaches companyId; o e-mail do identity token vence o e-mail gravado.
 */
import { AuthGuard } from './auth.guard';
import { UnauthorizedException } from '@nestjs/common';

const ctx = (headers: Record<string, string>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) as any }),
  }) as any;

describe('auth.guard', () => {
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
      verify: vi
        .fn()
        .mockResolvedValue({ privyUserId: 'did:privy:z', email: null }),
      emailFromIdentity: vi.fn(),
      getEmail: vi.fn(),
    };
    const company = {
      findOrCreate: vi.fn().mockResolvedValue({ id: 'co_9' }),
      storedEmail: vi.fn().mockResolvedValue('antigo@example.com'),
    };
    const guard = new AuthGuard(privy as any, company as any);
    const req: any = { headers: { authorization: 'Bearer tok123' } };
    const ok = await guard.canActivate({
      switchToHttp: () => ({ getRequest: () => req }),
    } as any);
    expect(ok).toBe(true);
    expect(privy.verify).toHaveBeenCalledWith('tok123');
    expect(company.storedEmail).not.toHaveBeenCalled();
    expect(privy.getEmail).not.toHaveBeenCalled();
    expect(req.companyId).toBe('co_9');
    expect(req.email).toBeNull();
  });

  it('usa o e-mail do identity token e ignora o e-mail gravado', async () => {
    const privy = {
      verify: vi
        .fn()
        .mockResolvedValue({ privyUserId: 'did:privy:z', email: null }),
      emailFromIdentity: vi.fn().mockResolvedValue('novo@example.com'),
      getEmail: vi.fn(),
    };
    const company = {
      findOrCreate: vi.fn().mockResolvedValue({ id: 'co_9' }),
      storedEmail: vi.fn().mockResolvedValue('antigo@example.com'),
    };
    const guard = new AuthGuard(privy as any, company as any);
    const req: any = {
      headers: {
        authorization: 'Bearer tok123',
        'privy-id-token': 'id.tok.en',
      },
    };
    const ok = await guard.canActivate({
      switchToHttp: () => ({ getRequest: () => req }),
    } as any);
    expect(ok).toBe(true);
    expect(privy.emailFromIdentity).toHaveBeenCalledWith(
      'id.tok.en',
      'did:privy:z',
    );
    expect(company.storedEmail).not.toHaveBeenCalled();
    expect(privy.getEmail).not.toHaveBeenCalled();
    expect(req.email).toBe('novo@example.com');
  });
});
