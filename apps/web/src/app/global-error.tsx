'use client';

import React from 'react';
import './globals.css';
import { ErrorPage } from '@/components/ErrorPage';
import { buildErrorDetails } from '@/lib/errorDetails';

/**
 * Rede de segurança para quando o próprio root layout quebra: este arquivo
 * substitui o layout, então precisa trazer <html>, <body> e os estilos globais
 * por conta própria. Sem fontes: se chegamos aqui, o layout que as carrega não
 * está de pé.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const details = React.useMemo(() => buildErrorDetails(error), [error]);

  React.useEffect(() => {
    console.error(`[GlobalError] ${details.errorId}`, error);
  }, [details.errorId, error]);

  return (
    <html lang="pt-BR">
      <body>
        <ErrorPage details={details} onRetry={unstable_retry} />
      </body>
    </html>
  );
}
