/**
 * Módulo: FamilySessionGate
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: A área da família renderiza os filhos sem criar uma carteira.
 * Sequência: renders children without creating a wallet.
 */
const ensureWallet = vi.fn();
vi.mock("@/lib/useWallet", () => ({ useWallet: () => ({ ensureWallet }) }));
vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({
    ready: true,
    authenticated: true,
    getAccessToken: async () => "tok",
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));
vi.mock("@/providers/PrivyProviderWrapper", () => ({
  isPrivyConfigured: true,
}));

import { render, screen } from "@testing-library/react";
import { FamilySessionGate } from "./FamilySessionGate";

describe("FamilySessionGate", () => {
  it("renders children without creating a wallet", () => {
    render(
      <FamilySessionGate>
        <p>painel</p>
      </FamilySessionGate>,
    );
    expect(screen.getByText("painel")).toBeTruthy();
    expect(ensureWallet).not.toHaveBeenCalled();
  });
});
