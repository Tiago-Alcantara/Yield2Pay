/**
 * Módulo: household-wallet.service
 * Criado em: 2026-11-04
 * Última atualização: 2026-11-04
 * Intuito: O apelido não guarda pedaço de chave Stellar, mesmo dentro do limite de tamanho.
 * Sequência: recusa no apelido um fragmento de 35 caracteres de chave secreta e de endereço, sem chamar a rede nem o banco; aceita um apelido comum.
 */
import { OTHER_G, SECRET_S, WALLET_G } from '../../test/wallet-fixtures';
import type { ActiveMembership } from '../auth/authenticated-request';
import { HouseholdWalletService } from './household-wallet.service';
import { WalletInvalidError } from './wallet.errors';

const membership: ActiveMembership = {
  householdId: 'h_1',
  companyId: 'co_1',
  role: 'owner',
  personal: false,
};

function setup() {
  const prisma = {
    householdWallet: {
      create: vi.fn(async ({ data }: { data: object }) => ({
        id: 'w_1',
        syncStatus: 'pending',
        lastSyncedAt: null,
        ...data,
      })),
    },
  };
  const gateway = { accountExists: vi.fn(async () => true) };
  const service = new HouseholdWalletService(
    prisma as never,
    gateway as never,
    {} as never,
  );
  return { prisma, gateway, service };
}

describe('apelido da carteira', () => {
  it.each([
    ['chave secreta', SECRET_S.slice(0, 35)],
    ['endereço', OTHER_G.slice(0, 35)],
    ['chave no meio do texto', `Minha ${SECRET_S.slice(0, 33)}`],
  ])(
    'recusa fragmento de %s dentro do limite de tamanho',
    async (_name, label) => {
      const { prisma, gateway, service } = setup();
      expect(label.length).toBeLessThanOrEqual(40);

      await expect(
        service.add(membership, { address: WALLET_G, label }),
      ).rejects.toBeInstanceOf(WalletInvalidError);
      expect(gateway.accountExists).not.toHaveBeenCalled();
      expect(prisma.householdWallet.create).not.toHaveBeenCalled();
    },
  );

  it('aceita um apelido comum', async () => {
    const { prisma, service } = setup();

    const view = await service.add(membership, {
      address: WALLET_G,
      label: 'Nubank da família',
    });

    expect(view.label).toBe('Nubank da família');
    expect(prisma.householdWallet.create).toHaveBeenCalledTimes(1);
  });
});
