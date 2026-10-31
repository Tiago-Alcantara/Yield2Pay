/**
 * Módulo: company.service
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: A empresa é achada ou criada a partir do usuário do Privy.
 * Sequência: find-or-creates by privyUserId.
 */
import { CompanyService } from './company.service';

const prisma = {
  company: {
    upsert: vi.fn().mockResolvedValue({ id: 'co_1' }),
  },
} as any;

describe('company.service', () => {
  it('find-or-creates by privyUserId', async () => {
    const svc = new CompanyService(prisma);
    const c = await svc.findOrCreate('did:privy:abc');
    expect(c.id).toBe('co_1');
    expect(prisma.company.upsert).toHaveBeenCalledWith({
      where: { privyUserId: 'did:privy:abc' },
      create: { privyUserId: 'did:privy:abc' },
      update: {},
    });
  });

  it('devolve o e-mail gravado da pessoa', async () => {
    const db = {
      personName: {
        findUnique: vi.fn().mockResolvedValue({ email: ' Ana@Casa.com ' }),
      },
    } as any;
    const svc = new CompanyService(db);
    await expect(svc.storedEmail('co_1')).resolves.toBe('ana@casa.com');
  });

  it('devolve nulo quando a pessoa não tem e-mail', async () => {
    const db = {
      personName: { findUnique: vi.fn().mockResolvedValue({ email: '  ' }) },
    } as any;
    const svc = new CompanyService(db);
    await expect(svc.storedEmail('co_1')).resolves.toBeNull();
  });
});
