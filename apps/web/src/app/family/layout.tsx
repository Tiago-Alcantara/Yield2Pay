import type { Metadata } from 'next';
import './family.css';
import { FamilyProvider } from './_lib/FamilyProvider';

export const metadata: Metadata = {
  title: 'Yield2Pay para famílias',
  description:
    'O rendimento do seu próprio dinheiro paga suas assinaturas. O principal continua seu.',
};

/**
 * Layout de /family — a vertical de famílias.
 *
 * Diferente de (app), aqui não há AuthGate: Privy e DeFindex entram numa
 * segunda etapa. Por ora o FamilyProvider guarda todo o estado das telas
 * (depósito, assinaturas, preferências) no cliente, para os fluxos poderem ser
 * percorridos de ponta a ponta.
 */
export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return <FamilyProvider>{children}</FamilyProvider>;
}
