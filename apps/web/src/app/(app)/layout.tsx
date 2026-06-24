import { LangProvider } from '@/lib/i18n';
import { AuthGate } from '@/providers/AuthGate';
import { Header } from '@/components/Header';

/**
 * Layout for authenticated app pages (route group: (app)).
 *
 * Wraps the subtree in:
 *   LangProvider  — makes useLang() work in all authed screens
 *   AuthGate      — redirects unauthenticated users to /login and provisions
 *                   the Stellar embedded wallet once per session
 *   Header        — sticky app header
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <AuthGate>
        <Header />
        <main>{children}</main>
      </AuthGate>
    </LangProvider>
  );
}
