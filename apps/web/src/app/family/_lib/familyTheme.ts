import type { CSSProperties } from 'react';

/**
 * Paleta e primitivas visuais das telas "Yield2Pay para famílias".
 *
 * Os valores espelham design/nemPages/*.dc.html. Onde o token global já existe
 * (src/app/tokens/*.css) apontamos para a variável CSS; o restante é literal,
 * como já acontece nas telas autenticadas de empresas.
 */
export const C = {
  // superfícies
  bg: 'var(--fx-bg)',                     // #0c0d0f
  bgRadial: 'radial-gradient(120% 50% at 50% -10%,#1b1d20 0%,#0c0d0f 55%)',
  bgRadialTall: 'radial-gradient(120% 60% at 50% -10%,#1b1d20 0%,#0c0d0f 60%)',
  card: '#1A1C1F',                        // card padrão das telas de família
  well: 'var(--fx-surface-2)',            // #16181B
  wellDeep: '#0f1113',                    // campo dentro de well
  metal: 'var(--fx-metal)',

  // bordas
  border: 'var(--fx-border)',             // #2A2D31
  borderStrong: '#3A3D41',
  borderMetal: 'var(--fx-border-metal)',  // #4a4d52
  borderFaint: 'rgba(255,255,255,.07)',
  borderFainter: 'rgba(255,255,255,.06)',
  borderHairline: 'rgba(255,255,255,.08)',

  // texto
  text: 'var(--fx-text)',                 // #EDEFF1
  textStrong: 'var(--fx-text-strong)',    // #F2F3F4
  textSoft: '#C8CACD',                    // corpo sobre metal
  text2: 'var(--fx-text-2)',              // #9A9DA1
  text3: 'var(--fx-text-3)',              // #8a8d91
  text4: 'var(--fx-text-4)',              // #7E8186
  placeholder: '#6b6e73',

  // prata / cromo
  silver: 'var(--fx-silver)',             // #C0C2C5
  silverBright: 'var(--fx-silver-bright)',// #D4D6D9
  chrome: 'var(--fx-chrome)',
  chromeInk: 'var(--fx-chrome-ink)',      // #0E0F11
  chromeSoft: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)',
  fill: 'linear-gradient(90deg,#A8AAAD,#E6E8EA)',
  tile: 'linear-gradient(160deg,#43464b,#1b1d21)',

  // estados
  danger: '#D98A8A',
  dangerBorder: '#5a3a3a',
  dangerEdge: '#3a2a2a',
  inputError: '#A24A4A',

  // fontes
  mono: 'var(--fx-font-mono)',
  sans: 'var(--fx-font-display)',
} as const;

/** Sombra do botão de cromo (repouso). */
export const CHROME_SHADOW =
  '0 1px 0 rgba(255,255,255,.5) inset,0 8px 22px rgba(0,0,0,.4)';

/** Sombra do painel escovado. */
export const PANEL_SHADOW =
  '0 18px 44px rgba(0,0,0,.4),0 2px 0 rgba(255,255,255,.1) inset';

/** Sombra dos painéis maiores (hero, cofre, detalhe). */
export const PANEL_SHADOW_LG =
  '0 24px 56px rgba(0,0,0,.5),0 2px 0 rgba(255,255,255,.1) inset';

/** Eyebrow em mono maiúsculo — usado no topo de cada seção. */
export const eyebrow = (size = 12, tracking = '.2em'): CSSProperties => ({
  fontFamily: C.mono,
  fontSize: size,
  letterSpacing: tracking,
  textTransform: 'uppercase',
  color: C.silver,
});

/** Label pequeno em mono (dentro de cards). */
export const cardLabel: CSSProperties = {
  fontFamily: C.mono,
  fontSize: 11,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: C.text3,
};

/** Botão de cromo (ação primária). */
export const chromeButton: CSSProperties = {
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
};

/** Botão secundário (contorno de metal). */
export const outlineButton: CSSProperties = {
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
};

/** Campo de texto padrão das telas de família. */
export const fieldStyle = (opts: { error?: boolean; mono?: boolean } = {}): CSSProperties => ({
  width: '100%',
  background: C.well,
  border: `1px solid ${opts.error ? C.inputError : C.border}`,
  borderRadius: 12,
  padding: '13px 14px',
  color: C.textStrong,
  fontFamily: opts.mono === false ? 'inherit' : C.mono,
  fontSize: 15,
  outline: 'none',
  transition: 'border-color .2s ease',
});

/** Card padrão (superfície #1A1C1F com hairline). */
export const cardStyle = (radius = 18, padding = 26): CSSProperties => ({
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: radius,
  padding,
});
