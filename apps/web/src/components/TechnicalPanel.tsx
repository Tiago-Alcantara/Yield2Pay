'use client';

import React from 'react';
import type { ErrorDetails } from '@/lib/errorDetails';
import { APP_ENV } from '@/lib/appEnv';

const MONO = 'var(--fx-font-mono)';

export interface TechnicalPanelProps {
  details: ErrorDetails;
  /** Altura máxima da área rolável do painel. */
  maxHeight?: number;
}

/**
 * Bloco de depuração da tela de erro — endpoint, método, requestId, mensagem e
 * stack, mais o botão que copia tudo como JSON.
 *
 * Só é montado em staging: quem decide é o gate de build time em ErrorPage
 * (SHOW_TECHNICAL_DETAILS), para este componente não existir no bundle de
 * produção. Ele não repete a checagem — se foi renderizado, é porque pode.
 */
export function TechnicalPanel({ details, maxHeight = 300 }: TechnicalPanelProps) {
  const technicalDetails = details.technicalDetails;
  // Fechado no celular, onde o painel tomaria a tela inteira; aberto no desktop.
  const [open, setOpen] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > 760;
  });
  const [copied, setCopied] = React.useState(false);
  const copyResetTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(copyResetTimer.current), []);

  if (!technicalDetails) return null;

  const panelId = `tech-${details.errorId}`;

  const payload = {
    errorId: details.errorId,
    statusCode: details.statusCode,
    environment: APP_ENV,
    timestamp: details.timestamp,
    endpoint: technicalDetails.endpoint,
    method: technicalDetails.method,
    requestId: technicalDetails.requestId,
    message: technicalDetails.message,
    stack: technicalDetails.stack,
  };

  async function copyEverything() {
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Sem permissão de clipboard o usuário ainda pode selecionar o texto na
      // tela; confirmar mesmo assim seria mentira, então só não confirmamos.
      return;
    }
    setCopied(true);
    clearTimeout(copyResetTimer.current);
    copyResetTimer.current = setTimeout(() => setCopied(false), 1800);
  }

  const fields = [
    { label: 'endpoint', value: technicalDetails.endpoint },
    { label: 'método', value: technicalDetails.method },
    { label: 'statusCode', value: String(details.statusCode) },
    { label: 'requestId', value: technicalDetails.requestId },
    { label: 'message', value: technicalDetails.message },
  ];

  return (
    <div style={{ borderTop: '1px solid var(--fx-border)', background: 'var(--fx-surface-1)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          padding: '14px clamp(20px,3vw,28px)',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls={panelId}
          style={{
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: 'var(--fx-silver)',
            background: 'none',
            border: 'none',
            padding: '8px 0',
            minHeight: 36,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textAlign: 'left',
          }}
        >
          <span>Detalhes técnicos</span>
          <span style={{ color: 'var(--fx-text-4)', letterSpacing: '.08em' }}>
            {open ? '— ocultar' : '+ mostrar'}
          </span>
        </button>
        <button
          type="button"
          onClick={copyEverything}
          style={{
            marginLeft: 'auto',
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: 'var(--fx-text-2)',
            background: 'rgba(255,255,255,.03)',
            border: '1px solid var(--fx-border)',
            borderRadius: 'var(--fx-radius-pill)',
            padding: '7px 13px',
            minHeight: 34,
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copiado' : 'Copiar tudo'}
        </button>
      </div>

      {open && (
        <div
          id={panelId}
          className="err-scroll"
          style={{
            maxHeight,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            padding: '4px clamp(20px,3vw,28px) 24px',
          }}
        >
          <div className="err-fields">
            {fields.map((field) => (
              <React.Fragment key={field.label}>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10.5,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: 'var(--fx-text-3)',
                    paddingTop: 2,
                  }}
                >
                  {field.label}
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: 'var(--fx-text)',
                    wordBreak: 'break-word',
                    userSelect: 'text',
                  }}
                >
                  {field.value}
                </span>
              </React.Fragment>
            ))}
          </div>

          <div
            style={{
              fontFamily: MONO,
              fontSize: 10.5,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: 'var(--fx-text-3)',
              margin: '20px 0 8px',
            }}
          >
            Stack trace
          </div>
          <pre
            style={{
              margin: 0,
              fontFamily: MONO,
              fontSize: 12,
              lineHeight: 1.65,
              color: 'var(--fx-silver)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              userSelect: 'text',
              background: '#0f1113',
              border: '1px solid var(--fx-border)',
              borderRadius: 12,
              padding: 14,
            }}
          >
            {technicalDetails.stack}
          </pre>
        </div>
      )}
    </div>
  );
}
