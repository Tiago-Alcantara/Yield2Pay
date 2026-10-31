import type { Metadata } from 'next';
import './family.css';
import './themes.css';
import { FamilySessionGate } from './_components/FamilySessionGate';
import { FamilyProvider } from './_lib/FamilyProvider';
import { Dock } from './_components/Dock';
import { ThemeProvider } from './_lib/ThemeProvider';

export const metadata: Metadata = {
  title: 'Yield2Pay para famílias',
  description:
    'O rendimento do seu próprio dinheiro paga suas assinaturas. O principal continua seu.',
};

/**
 * Layout da vertical de famílias, agora na raiz do site.
 *
 * A landing em / é pública. FamilySessionGate pede sessão Privy nas outras
 * rotas e não cria carteira Stellar. FamilyProvider guarda o estado no cliente.
 */
export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="fam-shell">
        <FamilyProvider>
          <FamilySessionGate>
            {children}
            <Dock />
          </FamilySessionGate>
        </FamilyProvider>
      </div>
    </ThemeProvider>
  );
}
