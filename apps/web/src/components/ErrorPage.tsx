'use client';

import React from 'react';
import type { ErrorDetails } from '@/lib/errorDetails';
import {
  PAGE_COPY,
  ACTION_LABELS,
  SUPPORT_EMAIL,
  type ErrorAction,
} from '@/lib/errorCopy';
import { TechnicalPanel } from './TechnicalPanel';

const MONO = 'var(--fx-font-mono)';

/**
 * Gate do painel técnico, deliberadamente declarado NESTE módulo e comparado
 * com um literal: o bundler troca process.env.NEXT_PUBLIC_APP_ENV pelo valor do
 * build, a constante vira `false` e o minificador elimina o ramo — junto com o
 * import do TechnicalPanel. Importar a constante de outro módulo quebra isso: a
 * dobra não atravessa a fronteira do módulo e o painel volta para o bundle.
 * Não trocar por flag de runtime, feature flag remota ou prop booleana.
 */
const SHOW_TECHNICAL_DETAILS = process.env.NEXT_PUBLIC_APP_ENV === 'staging';

export interface ErrorPageProps {
  details: ErrorDetails;
  /** Refaz o carregamento da rota. Padrão: recarregar a página. */
  onRetry?: () => void;
  /** Padrão: navegar para a raiz. */
  onHome?: () => void;
  /** Padrão: navegar para /login. */
  onLogin?: () => void;
  /** Padrão: abrir um e-mail para o suporte com o código do erro no assunto. */
  onSupport?: () => void;
}

/**
 * Tela cheia de erro: usada quando falhou o carregamento da rota e não há
 * conteúdo válido para preservar atrás (404, 500, 502, 503 de carregamento, e
 * qualquer crash de render). Falha de UMA ação usa o popup (ErrorDialog).
 */
export function ErrorPage({ details, onRetry, onHome, onLogin, onSupport }: ErrorPageProps) {
  const copy = PAGE_COPY[details.statusCode];
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const [copiedId, setCopiedId] = React.useState(false);
  const copyResetTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sem isso o leitor de tela continuaria no contexto da página anterior.
  React.useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    return () => clearTimeout(copyResetTimer.current);
  }, []);

  function runAction(action: ErrorAction) {
    switch (action) {
      case 'retry':
        if (onRetry) return onRetry();
        return window.location.reload();
      case 'login':
        if (onLogin) return onLogin();
        return window.location.assign('/login');
      case 'support':
        if (onSupport) return onSupport();
        return window.location.assign(supportMailto(details));
      case 'home':
      case 'review':
      default:
        if (onHome) return onHome();
        return window.location.assign('/');
    }
  }

  async function copyErrorId() {
    try {
      await navigator.clipboard.writeText(details.errorId);
    } catch {
      // O código continua selecionável na tela; só não confirmamos a cópia.
      return;
    }
    setCopiedId(true);
    clearTimeout(copyResetTimer.current);
    copyResetTimer.current = setTimeout(() => setCopiedId(false), 1800);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(120% 50% at 50% -10%,#1b1d20 0%,var(--fx-bg) 55%)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header style={{ borderBottom: '1px solid var(--fx-border)' }}>
        <div
          style={{
            maxWidth: 1040,
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
          }}
        >
          <span
            style={{
              width: 11,
              height: 11,
              background: 'var(--fx-chrome)',
              transform: 'rotate(45deg)',
              borderRadius: 2,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--fx-font-display)',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '-.01em',
              color: 'var(--fx-text-strong)',
            }}
          >
            Yield2Pay
          </span>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(28px,6vw,72px) 24px',
        }}
      >
        <section
          role="alert"
          aria-live="assertive"
          style={{
            width: '100%',
            maxWidth: 620,
            background: '#1A1C1F',
            border: '1px solid var(--fx-border)',
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: '0 30px 70px rgba(0,0,0,.45)',
          }}
        >
          {SHOW_TECHNICAL_DETAILS && details.technicalDetails && <StagingBanner />}

          <div style={{ padding: 'clamp(26px,3.4vw,42px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span
                className="brushed"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 64,
                  height: 52,
                  borderRadius: 14,
                  border: '1px solid var(--fx-border-metal)',
                  boxShadow: '0 1px 0 rgba(255,255,255,.12) inset,0 10px 24px rgba(0,0,0,.4)',
                }}
              >
                <span
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    fontFamily: MONO,
                    fontSize: 20,
                    fontWeight: 500,
                    color: 'var(--fx-silver-bright)',
                  }}
                >
                  {details.statusCode}
                </span>
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  color: 'var(--fx-text-2)',
                  lineHeight: 1.5,
                }}
              >
                {copy.kicker}
              </span>
            </div>

            <h1
              ref={titleRef}
              tabIndex={-1}
              style={{
                fontSize: 'clamp(25px,2.7vw,34px)',
                fontWeight: 700,
                letterSpacing: '-.025em',
                lineHeight: 1.15,
                color: 'var(--fx-text-strong)',
                margin: '22px 0 0',
                textWrap: 'pretty',
              }}
            >
              {copy.title}
            </h1>
            <p
              style={{
                fontSize: 15.5,
                lineHeight: 1.6,
                color: 'var(--fx-text-2)',
                margin: '12px 0 0',
                maxWidth: '52ch',
                textWrap: 'pretty',
              }}
            >
              {copy.msg}
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
              <button
                type="button"
                className="btn-shine"
                onClick={() => runAction(copy.primary)}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 14.5,
                  fontWeight: 700,
                  letterSpacing: '-.005em',
                  color: 'var(--fx-chrome-ink)',
                  background: 'var(--fx-chrome)',
                  border: 'none',
                  borderRadius: 'var(--fx-radius-pill)',
                  padding: '13px 24px',
                  minHeight: 44,
                  cursor: 'pointer',
                  boxShadow: '0 1px 0 rgba(255,255,255,.45) inset,0 10px 26px rgba(0,0,0,.45)',
                }}
              >
                {ACTION_LABELS[copy.primary]}
              </button>
              {copy.secondary && (
                <button
                  type="button"
                  onClick={() => runAction(copy.secondary as ErrorAction)}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 14.5,
                    fontWeight: 600,
                    color: 'var(--fx-text)',
                    background: 'rgba(255,255,255,.03)',
                    border: '1px solid var(--fx-border-metal)',
                    borderRadius: 'var(--fx-radius-pill)',
                    padding: '13px 22px',
                    minHeight: 44,
                    cursor: 'pointer',
                  }}
                >
                  {ACTION_LABELS[copy.secondary]}
                </button>
              )}
            </div>

            <div
              style={{
                marginTop: 32,
                paddingTop: 20,
                borderTop: '1px solid var(--fx-border-faint)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10.5,
                    letterSpacing: '.16em',
                    textTransform: 'uppercase',
                    color: 'var(--fx-text-3)',
                  }}
                >
                  Código do erro
                </span>
                <code
                  style={{
                    fontFamily: MONO,
                    fontSize: 13,
                    color: 'var(--fx-silver-bright)',
                    background: 'var(--fx-surface-2)',
                    border: '1px solid var(--fx-border)',
                    borderRadius: 'var(--fx-radius-sm)',
                    padding: '5px 9px',
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
                    fontSize: 11,
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    color: 'var(--fx-text-2)',
                    background: 'none',
                    border: '1px solid var(--fx-border)',
                    borderRadius: 'var(--fx-radius-pill)',
                    padding: '6px 12px',
                    minHeight: 32,
                    cursor: 'pointer',
                  }}
                >
                  {copiedId ? 'Copiado' : 'Copiar'}
                </button>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: 'var(--fx-text-4)',
                    marginLeft: 'auto',
                  }}
                >
                  {formatTimestamp(details.timestamp)}
                </span>
              </div>
              <p
                style={{
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: 'var(--fx-text-4)',
                  margin: '12px 0 0',
                  maxWidth: '56ch',
                }}
              >
                Informe este código ao suporte — com ele conseguimos localizar exatamente o que
                aconteceu.
              </p>
            </div>
          </div>

          {/* Gate de build time: em produção o minificador elimina este ramo, e
              nem o painel nem o stack existem no bundle. */}
          {SHOW_TECHNICAL_DETAILS && details.technicalDetails && (
            <TechnicalPanel details={details} />
          )}
        </section>
      </main>
    </div>
  );
}

/** Faixa que separa visualmente um erro de teste de um erro real do cliente. */
function StagingBanner() {
  return (
    <div
      className="brushed"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '11px 20px',
        borderBottom: '1px solid var(--fx-border-metal)',
        boxShadow: '0 1px 0 rgba(255,255,255,.12) inset',
      }}
    >
      <span
        style={{
          position: 'relative',
          zIndex: 2,
          fontFamily: MONO,
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '.2em',
          textTransform: 'uppercase',
          color: 'var(--fx-chrome-ink)',
          background: 'var(--fx-chrome)',
          borderRadius: 'var(--fx-radius-pill)',
          padding: '4px 11px',
        }}
      >
        staging
      </span>
      <span
        style={{
          position: 'relative',
          zIndex: 2,
          fontSize: 12.5,
          color: 'var(--fx-silver)',
          lineHeight: 1.5,
        }}
      >
        Ambiente de teste. Este erro não vem de produção e os dados abaixo são de depuração.
      </span>
    </div>
  );
}

export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

export function supportMailto(details: ErrorDetails): string {
  const subject = encodeURIComponent(`Erro ${details.statusCode} — ${details.errorId}`);
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
}
