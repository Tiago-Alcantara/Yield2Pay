'use client';

import React from 'react';
import Link from 'next/link';
import {
  C,
  CHROME_SHADOW,
  PANEL_SHADOW,
  cardLabel,
} from '../_lib/familyTheme';

/* ── Marca ─────────────────────────────────────────────────────────────────── */

/** Losango prateado da marca. */
export function BrandDiamond({ size = 13, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg,#E6E8EA,#9A9DA1)',
        transform: 'rotate(45deg)',
        borderRadius: 2,
        boxShadow: glow ? '0 0 12px rgba(192,194,197,.35)' : undefined,
      }}
    />
  );
}

/** Logotipo "Yield2Pay", com a etiqueta "Para famílias" opcional. */
export function FamilyBrand({
  tag,
  size = 19,
  href,
}: {
  tag?: string;
  size?: number;
  href?: string;
}) {
  const inner = (
    <>
      <BrandDiamond size={size < 17 ? 11 : 13} glow={size >= 17} />
      <span style={{ fontSize: size, fontWeight: 700, letterSpacing: '-.01em', color: C.textStrong }}>
        Yield2Pay
      </span>
      {tag && (
        <span
          className="fam-brand-tag"
          style={{
            fontFamily: C.mono,
            fontSize: 10.5,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: C.text3,
            borderLeft: `1px solid ${C.border}`,
            paddingLeft: 10,
            marginLeft: 2,
          }}
        >
          {tag}
        </span>
      )}
    </>
  );

  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textDecoration: 'none',
  };

  return href ? (
    <Link href={href} style={style}>
      {inner}
    </Link>
  ) : (
    <span style={style}>{inner}</span>
  );
}

/* ── Superfícies ───────────────────────────────────────────────────────────── */

/**
 * Painel de metal escovado com o brilho que atravessa em loop.
 * Reaproveita as classes `.brushed` / `.sweep` de globals.css.
 */
export function MetalPanel({
  children,
  radius = 20,
  padding = 'var(--fam-metal-pad)',
  sweep = true,
  shadow = PANEL_SHADOW,
  style = {},
}: {
  children: React.ReactNode;
  radius?: number;
  padding?: number | string;
  sweep?: boolean;
  shadow?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="brushed"
      style={{
        position: 'relative',
        overflow: 'hidden',
        border: `1px solid ${C.borderMetal}`,
        borderRadius: radius,
        boxShadow: shadow,
        ...style,
      }}
    >
      {sweep && <span className="sweep" aria-hidden="true" />}
      <div style={{ position: 'relative', zIndex: 2, padding, height: '100%' }}>{children}</div>
    </div>
  );
}

/* ── Elementos de dado ─────────────────────────────────────────────────────── */

/** Barra de cobertura preenchida em cromo. */
export function CoverageBar({ percent, height = 10 }: { percent: number; height?: number }) {
  const v = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        height,
        borderRadius: 999,
        background: C.well,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${v}%`,
          height: '100%',
          background: C.fill,
          borderRadius: 999,
          transition: 'width .4s cubic-bezier(.2,.65,.2,1)',
        }}
      />
    </div>
  );
}

/** Pílula de status "coberta" / "ainda não". */
export function StatusPill({ covered, children }: { covered: boolean; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: C.mono,
        fontSize: 11,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: covered ? C.textStrong : C.text2,
        border: `1px solid ${covered ? C.silver : C.border}`,
        background: covered ? 'rgba(192,194,197,.08)' : 'transparent',
        borderRadius: 999,
        padding: '5px 12px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

/** Quadradinho que marca uma assinatura coberta. */
export function SubDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 10,
        height: 10,
        flexShrink: 0,
        borderRadius: 3,
        background: on ? C.chromeSoft : C.border,
      }}
    />
  );
}

/** Card simples com label em mono + valor grande. */
export function StatCard({
  label,
  value,
  sub,
  valueSize = 'clamp(22px,6.5vw,28px)',
}: {
  label: string;
  value: string;
  sub?: string;
  valueSize?: number | string;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: 'clamp(18px,4vw,22px)',
      }}
    >
      <div style={cardLabel}>{label}</div>
      <div
        style={{
          fontFamily: C.mono,
          fontSize: valueSize,
          fontWeight: 600,
          color: C.textStrong,
          marginTop: 10,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: C.text2, marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

/** Ladrilho numerado (01 / 02 / 03) usado em "Como funciona" e nos conceitos. */
export function NumberTile({ children, size = 44 }: { children: React.ReactNode; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: C.tile,
        border: `1px solid ${C.borderMetal}`,
        fontFamily: C.mono,
        fontSize: size > 42 ? 15 : 13,
        fontWeight: 600,
        color: C.silverBright,
      }}
    >
      {children}
    </span>
  );
}

/* ── Controles ─────────────────────────────────────────────────────────────── */

export interface SegOption {
  value: string;
  label: string;
}

/** Grupo de pílulas exclusivas (cenário, idioma, frequência, filtros). */
export function PillGroup({
  options,
  value,
  onChange,
  mono = false,
  ariaLabel,
}: {
  options: SegOption[];
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
  ariaLabel?: string;
}) {
  return (
    <span
      role="group"
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        border: `1px solid ${C.border}`,
        borderRadius: 999,
        padding: 3,
        gap: 2,
        background: C.well,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              fontFamily: mono ? C.mono : 'inherit',
              background: on ? '#2E3136' : 'transparent',
              color: on ? C.textStrong : C.text2,
              transition: 'all .2s ease',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </span>
  );
}

/** Interruptor 44×25 do design de família (o Toggle global é 42×24). */
export function FamilySwitch({
  checked,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      style={{
        width: 44,
        height: 25,
        borderRadius: 999,
        border: `1px solid ${checked ? C.silver : C.border}`,
        background: checked ? C.chromeSoft : C.well,
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        padding: 0,
        transition: 'all .2s ease',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 21 : 2,
          width: 19,
          height: 19,
          borderRadius: '50%',
          background: checked ? C.chromeInk : C.placeholder,
          transition: 'left .2s ease',
        }}
      />
    </button>
  );
}

/** Botão de cromo — ação primária das telas de família. */
export function ChromeButton({
  children,
  style = {},
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="btn-shine"
      style={{
        fontFamily: 'inherit',
        fontSize: 15,
        fontWeight: 600,
        color: C.chromeInk,
        background: C.chromeSoft,
        border: 'none',
        borderRadius: 12,
        padding: '14px 24px',
        cursor: 'pointer',
        boxShadow: CHROME_SHADOW,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Botão secundário com contorno de metal. */
export function OutlineButton({
  children,
  style = {},
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="fam-outline"
      style={{
        fontFamily: 'inherit',
        fontSize: 15,
        fontWeight: 600,
        color: C.textStrong,
        background: 'rgba(255,255,255,.03)',
        border: `1px solid ${C.borderMetal}`,
        borderRadius: 12,
        padding: '14px 24px',
        cursor: 'pointer',
        transition: 'border-color .2s ease',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Botão-pílula discreto (copiar, trocar chave, exportar). */
export function GhostPill({
  children,
  mono = true,
  style = {},
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { mono?: boolean }) {
  return (
    <button
      type="button"
      className="fam-outline"
      style={{
        fontFamily: mono ? C.mono : 'inherit',
        fontSize: 12.5,
        fontWeight: 600,
        color: C.textStrong,
        background: 'rgba(255,255,255,.04)',
        border: `1px solid ${C.borderMetal}`,
        borderRadius: 999,
        padding: '9px 16px',
        cursor: 'pointer',
        transition: 'border-color .2s ease',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── Cabeçalho leve (conceitos / configurações / saque) ────────────────────── */

export function BackHeader({ label, maxWidth = 720 }: { label: string; maxWidth?: number }) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'rgba(12,13,15,.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          maxWidth,
          margin: '0 auto',
          padding: '14px var(--fam-gutter)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Link
          href="/family/dashboard"
          className="fam-quiet"
          style={{
            fontSize: 14,
            color: C.text2,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
          }}
        >
          {label}
        </Link>
        <FamilyBrand size={16} />
      </div>
    </header>
  );
}
