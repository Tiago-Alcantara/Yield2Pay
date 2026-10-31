/**
 * Módulo: Dock logout
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: Sair da conta tira o nome da doca.
 * Sequência: com a sessão Privy encerrada, a doca zera a conta em memória.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/providers/PrivyProviderWrapper', () => ({
  isPrivyConfigured: true,
}));
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    ready: true,
    authenticated: false,
    getAccessToken: async () => null,
    logout: vi.fn(),
  }),
}));

import { getAccountView, setAccountView } from '../_lib/accountStore';
import { resetFamilyStore } from '../_lib/familyStore';
import { FamilyProvider } from '../_lib/FamilyProvider';
import { Dock } from './Dock';

describe('logout na doca', () => {
  beforeEach(() => {
    localStorage.clear();
    resetFamilyStore();
    setAccountView({
      displayName: 'Marina',
      fullName: 'Marina Alves',
      email: 'marina@email.com',
      initials: 'MA',
      accountType: 'family',
      household: { id: 'h1', name: 'Casa', role: 'owner', onboardingCompleted: true },
    });
  });

  it('zera a conta quando a sessão Privy acaba', () => {
    render(
      <FamilyProvider>
        <Dock />
      </FamilyProvider>,
    );
    expect(getAccountView()).toBeNull();
  });
});
