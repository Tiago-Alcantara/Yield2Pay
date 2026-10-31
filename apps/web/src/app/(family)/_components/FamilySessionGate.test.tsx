/**
 * Módulo: FamilySessionGate
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: A área da família renderiza os filhos sem criar uma carteira.
 * Sequência: renders children without creating a wallet.
 */
const ensureWallet = vi.fn();
const auth = vi.hoisted(() => ({ ready: true, authenticated: true }));
vi.mock("@/lib/useWallet", () => ({ useWallet: () => ({ ensureWallet }) }));
vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({
    ready: auth.ready,
    authenticated: auth.authenticated,
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
import { getAccountView, setAccountView } from "../_lib/accountStore";
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

  it("limpa a conta vista pela doca quando a sessão acaba", () => {
    setAccountView({
      displayName: "Marina",
      fullName: "Marina Alves",
      email: "marina@email.com",
      initials: "MA",
      accountType: "family",
      household: { id: "h1", name: "Casa", role: "owner", onboardingCompleted: true },
    });
    auth.ready = true;
    auth.authenticated = false;
    render(
      <FamilySessionGate>
        <p>painel</p>
      </FamilySessionGate>,
    );
    expect(getAccountView()).toBeNull();
    auth.authenticated = true;
  });
});
