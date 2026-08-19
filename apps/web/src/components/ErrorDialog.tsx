'use client';

import React from 'react';
import type { ErrorDetails } from '@/lib/errorDetails';
import { DIALOG_COPY, ACTION_LABELS, type DialogStatusCode, type ErrorAction } from '@/lib/errorCopy';
import { formatTimestamp, supportMailto } from './ErrorPage';

const MONO = 'var(--fx-font-mono)';

export interface ErrorDialogProps {
  details: ErrorDetails;
  onClose: () => void;
  /** Refaz a AÇÃO que falhou — não a página. Padrão: apenas fechar. */
  onRetry?: () => void;
  /** Padrão: navegar para /login. */
  onLogin?: () => void;
  /** Padrão: abrir um e-mail para o suporte com o código do erro no assunto. */
  onSupport?: () => void;
}

/**
 * Popup de erro: usado quando falhou UMA ação e a tela atrás continua válida —
 * fechar devolve o usuário ao que ele estava fazendo. Erro de carregamento de
 * rota usa a tela cheia (ErrorPage).
 *
 * Por decisão de produto o popup nunca mostra detalhe técnico, nem em staging:
 * stack e endpoint só aparecem na tela cheia e no console.
 */
export function ErrorDialog({ details, onClose, onRetry, onLogin, onSupport }: ErrorDialogProps) {
  const copy = DIALOG_COPY[details.statusCode as DialogStatusCode] ?? DIALOG_COPY[500];
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const [copiedId, setCopiedId] = React.useState(false);
  const copyResetTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    return () => clearTimeout(copyResetTimer.current);
  }, []);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function runAction(action: ErrorAction) {
    switch (action) {
      case 'retry':
        if (onRetry) return onRetry();
        return onClose();
      case 'login':
        if (onLogin) return onLogin();
        return window.location.assign('/login');
      case 'support':
        if (onSupport) return onSupport();
        return window.location.assign(supportMailto(details));
      // "Revisar dados" devolve o usuário ao formulário que já está atrás.
      case 'review':
      default:
        return onClose();
    }
  }

  async function copyErrorId() {
    try {
      await navigator.clipboard.writeText(details.errorId);
    } catch {
      return;
    }
    setCopiedId(true);
    clearTimeout(copyResetTimer.current);
    copyResetTimer.current = setTimeout(() => setCopiedId(false), 1800);
  }

  return (
    <div
      data-testid="error-dialog-veil"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(9,10,11,.74)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`dlg-title-${details.errorId}`}
        aria-describedby={`dlg-desc-${details.errorId}`}
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 452,
          background: '#1A1C1F',
          border: '1px solid var(--fx-border)',
          borderRadius: 'var(--fx-radius-2xl)',
          padding: 26,
          boxShadow: '0 34px 80px rgba(0,0,0,.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span
            className="brushed"
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 46,
              height: 38,
              borderRadius: 'var(--fx-radius-md)',
              border: '1px solid var(--fx-border-metal)',
              boxShadow: '0 1px 0 rgba(255,255,255,.12) inset,0 8px 18px rgba(0,0,0,.4)',
            }}
          >
            <span
              style={{
                position: 'relative',
                zIndex: 2,
                fontFamily: MONO,
                fontSize: 15,
                fontWeight: 500,
                color: 'var(--fx-silver-bright)',
              }}
            >
              {details.statusCode}
            </span>
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: MONO,
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: 'var(--fx-text-2)',
              lineHeight: 1.6,
              paddingTop: 5,
            }}
          >
            {copy.kicker}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar diálogo"
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              margin: '-8px -8px 0 0',
              fontFamily: 'inherit',
              fontSize: 20,
              lineHeight: 1,
              color: 'var(--fx-text-2)',
              background: 'none',
              border: 'none',
              borderRadius: 'var(--fx-radius-pill)',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <h2
          id={`dlg-title-${details.errorId}`}
          ref={titleRef}
          tabIndex={-1}
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-.015em',
            lineHeight: 1.25,
            color: 'var(--fx-text-strong)',
            margin: '18px 0 0',
            textWrap: 'pretty',
          }}
        >
          {copy.title}
        </h2>
        <p
          id={`dlg-desc-${details.errorId}`}
          style={{
            fontSize: 14.5,
            lineHeight: 1.6,
            color: 'var(--fx-text-2)',
            margin: '9px 0 0',
            textWrap: 'pretty',
          }}
        >
          {copy.msg}
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
          <button
            type="button"
            className="btn-shine"
            onClick={() => runAction(copy.primary)}
            style={{
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '-.005em',
              color: 'var(--fx-chrome-ink)',
              background: 'var(--fx-chrome)',
              border: 'none',
              borderRadius: 'var(--fx-radius-pill)',
              padding: '12px 20px',
              minHeight: 44,
              cursor: 'pointer',
              boxShadow: '0 1px 0 rgba(255,255,255,.45) inset,0 8px 20px rgba(0,0,0,.45)',
            }}
          >
            {ACTION_LABELS[copy.primary]}
          </button>
          {/* A secundária é sempre fechar: mandar o usuário para o início
              custaria o contexto que ele ainda tem atrás do diálogo. */}
          <button
            type="button"
            onClick={onClose}
            style={{
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--fx-text)',
              background: 'rgba(255,255,255,.03)',
              border: '1px solid var(--fx-border-metal)',
              borderRadius: 'var(--fx-radius-pill)',
              padding: '12px 18px',
              minHeight: 44,
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 22,
            paddingTop: 16,
            borderTop: '1px solid var(--fx-border-faint)',
          }}
        >
          <code
            style={{
              fontFamily: MONO,
              fontSize: 12,
              color: 'var(--fx-silver-bright)',
              background: 'var(--fx-surface-2)',
              border: '1px solid var(--fx-border)',
              borderRadius: 'var(--fx-radius-sm)',
              padding: '4px 8px',
              userSelect: 'all',
            }}
          >
            {details.errorId}
          </code>
          <button
            type="button"
            onClick={copyErrorId}
            style={{
              fontFamily: MONO,
              fontSize: 10.5,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'var(--fx-text-2)',
              background: 'none',
              border: '1px solid var(--fx-border)',
              borderRadius: 'var(--fx-radius-pill)',
              padding: '6px 11px',
              minHeight: 32,
              cursor: 'pointer',
            }}
          >
            {copiedId ? 'Copiado' : 'Copiar'}
          </button>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10.5,
              color: 'var(--fx-text-4)',
              marginLeft: 'auto',
            }}
          >
            {formatTimestamp(details.timestamp)}
          </span>
          <p
            style={{
              flex: '1 0 100%',
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--fx-text-4)',
              margin: '10px 0 0',
            }}
          >
            Informe este código ao suporte se o erro voltar a acontecer.
          </p>
        </div>
      </div>
    </div>
  );
}
