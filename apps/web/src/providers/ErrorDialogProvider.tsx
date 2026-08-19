'use client';

import React from 'react';
import { ErrorDialog } from '@/components/ErrorDialog';
import {
  subscribeToErrorNotifications,
  getErrorNotification,
  getServerErrorNotification,
  dismissErrorNotification,
} from '@/lib/errorNotifications';

/**
 * Liga o store de notificações de erro à árvore React: qualquer falha de
 * chamada publicada por lib/api.ts abre o popup, sem a tela precisar tratar.
 *
 * "Tentar novamente" apenas fecha o diálogo — refazer a chamada daqui repetiria
 * um POST (depósito, saque) sem o usuário pedir. Quem quiser refazer a ação
 * clica nela de novo, com a tela intacta atrás.
 */
export function ErrorDialogProvider({ children }: { children: React.ReactNode }) {
  const notification = React.useSyncExternalStore(
    subscribeToErrorNotifications,
    getErrorNotification,
    getServerErrorNotification,
  );

  return (
    <>
      {/* display:contents mantém o layout das telas intacto; `inert` tira o
          conteúdo de trás do Tab e da árvore de acessibilidade enquanto o
          diálogo modal está aberto (aria-hidden sozinho não impediria o foco). */}
      <div data-testid="app-content" style={{ display: 'contents' }} inert={notification !== null}>
        {children}
      </div>
      {notification && (
        <ErrorDialog details={notification} onClose={dismissErrorNotification} />
      )}
    </>
  );
}
