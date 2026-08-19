'use client';

import React from 'react';
import { ErrorPage } from '@/components/ErrorPage';
import { buildErrorDetails } from '@/lib/errorDetails';

/** Rota inexistente: tela cheia com a cópia de 404 (sem "tentar novamente"). */
export default function NotFoundRoute() {
  const details = React.useMemo(() => buildErrorDetails(null, { statusCode: 404 }), []);

  return <ErrorPage details={details} />;
}
