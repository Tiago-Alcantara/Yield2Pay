'use client';

import React from 'react';
import { ErrorPage } from '@/components/ErrorPage';
import { buildErrorDetails } from '@/lib/errorDetails';

/**
 * Boundary de erro das rotas: entra quando o render ou o carregamento de dados
 * de um segmento estoura — não há conteúdo válido para preservar, então é a
 * tela cheia. Falha de uma ação isolada abre o popup (ErrorDialogProvider).
 */
export default function ErrorRoute({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // Memoizado porque um erro sem payload do backend recebe um errorId gerado
  // aqui: sem isso o código mudaria a cada render, embaixo dos olhos do usuário.
  const details = React.useMemo(() => buildErrorDetails(error), [error]);

  React.useEffect(() => {
    console.error(`[ErrorPage] ${details.errorId}`, error);
  }, [details.errorId, error]);

  return <ErrorPage details={details} onRetry={unstable_retry} />;
}
