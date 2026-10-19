import type { Metadata } from 'next';
import './family.css';
import { FamilySessionGate } from './_components/FamilySessionGate';
import { FamilyProvider } from './_lib/FamilyProvider';

export const metadata: Metadata = {
  title: 'Yield2Pay para famílias',
  description:
    'O rendimento do seu próprio dinheiro paga suas assinaturas. O principal continua seu.',
};

/**
 * Layout de /family — a vertical de famílias.
 *
 * FamilySessionGate exige sessão Privy e não cria carteira Stellar
 * (diferente do AuthGate do grupo (app)). FamilyProvider guarda o estado
 * das telas no cliente.
 */
export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return (
    <FamilyProvider>
      <FamilySessionGate>{children}</FamilySessionGate>
    </FamilyProvider>
  );
}
