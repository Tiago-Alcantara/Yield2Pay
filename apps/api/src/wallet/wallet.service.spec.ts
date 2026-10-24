/**
 * Módulo: wallet.service
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: A carteira só é registrada se o endereço vale, e o gastável nunca fica negativo.
 * Sequência: funds the account then registers it; rejects an invalid address without funding or persisting; throws when the address is missing; getBalance: retorna balance e spendable (balance − reserva); getBalance: spendable nunca é negativo (saldo abaixo da reserva).
 */
import { WalletService } from './wallet.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RESERVE_BUFFER_BASE_UNITS } from '../common/reserve';

const VALID_ADDRESS =
  'GDUKN35CP3SQ67QMZL5SKCUCX6MB47TX4SZBTS5UHKFMGTF35Z3723DY';

function deps(findResult: any = null) {
  const prisma = {
    wallet: {
      upsert: vi.fn().mockResolvedValue({ stellarAddress: VALID_ADDRESS }),
      findUnique: vi.fn().mockResolvedValue(findResult),
    },
  } as any;
  const stellar = {
    ensureAccountFunded: vi.fn().mockResolvedValue(undefined),
  } as any;
  return { prisma, stellar };
}

describe('wallet.service', () => {
  it('funds the account then registers it', async () => {
    const { prisma, stellar } = deps();
    const r = await new WalletService(prisma, stellar).register(
      'co_1',
      VALID_ADDRESS,
    );

    expect(stellar.ensureAccountFunded).toHaveBeenCalledWith(VALID_ADDRESS);
    expect(prisma.wallet.upsert).toHaveBeenCalledWith({
      where: { companyId: 'co_1' },
      create: { companyId: 'co_1', stellarAddress: VALID_ADDRESS },
      update: { stellarAddress: VALID_ADDRESS },
    });
    expect(r.stellarAddress).toBe(VALID_ADDRESS);
  });

  it('rejects an invalid address without funding or persisting', async () => {
    const { prisma, stellar } = deps();
    await expect(
      new WalletService(prisma, stellar).register('co_1', 'not-a-key'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(stellar.ensureAccountFunded).not.toHaveBeenCalled();
    expect(prisma.wallet.upsert).not.toHaveBeenCalled();
  });

  it('throws when the address is missing', async () => {
    const { prisma, stellar } = deps(null);
    await expect(
      new WalletService(prisma, stellar).getAddress('co_x'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getBalance: retorna balance e spendable (balance − reserva)', async () => {
    const prisma = {} as any;
    const stellar = {
      getNativeBalance: vi.fn().mockResolvedValue(120_0000000n),
    }; // 120 XLM
    const svc = new WalletService(prisma, stellar as any);
    vi.spyOn(svc, 'getAddress').mockResolvedValue('GADDR');

    const r = await svc.getBalance('co_1');
    expect(stellar.getNativeBalance).toHaveBeenCalledWith('GADDR');
    expect(r.balance).toBe('1200000000');
    expect(r.spendable).toBe(
      (1200000000n - RESERVE_BUFFER_BASE_UNITS).toString(),
    ); // 1185000000
  });

  it('getBalance: spendable nunca é negativo (saldo abaixo da reserva)', async () => {
    const stellar = { getNativeBalance: vi.fn().mockResolvedValue(5_000000n) }; // 0.5 XLM
    const svc = new WalletService({} as any, stellar as any);
    vi.spyOn(svc, 'getAddress').mockResolvedValue('GADDR');

    const r = await svc.getBalance('co_1');
    expect(r.balance).toBe('5000000');
    expect(r.spendable).toBe('0');
  });
});
