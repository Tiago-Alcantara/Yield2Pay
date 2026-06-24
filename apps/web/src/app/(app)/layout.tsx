import { LangProvider } from '@/lib/i18n';
import { AuthGate } from '@/providers/AuthGate';

/**
 * Layout for authenticated app pages (route group: (app)).
 *
 * Wraps the subtree in:
 *   LangProvider  — makes useLang() work in all authed screens
 *   AuthGate      — redirects unauthenticated users to /login and provisions
 *                   the Stellar embedded wallet once per session
 *
 * Note: the marketing Header is intentionally absent here — every authed
 * screen (dashboard, deposit, withdraw) is self-chromed with its own
 * sidebar/header. The marketing Header remains available for public pages.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <AuthGate>
        {children}
      </AuthGate>
    </LangProvider>
  );
}
