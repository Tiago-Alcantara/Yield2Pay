'use client';

/* Blocos de skeleton. Só desenham forma: não carregam dados nem estado. */

import type { CSSProperties } from 'react';

type Len = number | string;

export function Sk({
  w = '100%',
  h = 12,
  r,
  shape = 'rect',
  className,
  style,
}: {
  w?: Len;
  h?: Len;
  r?: Len;
  shape?: 'rect' | 'circle' | 'pill';
  className?: string;
  style?: CSSProperties;
}) {
  const cls =
    'y2p-ld-sk' +
    (shape === 'circle' ? ' y2p-ld-sk--circle' : shape === 'pill' ? ' y2p-ld-sk--pill' : '') +
    (className ? ' ' + className : '');
  return <span aria-hidden="true" className={cls} style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : null), ...style }} />;
}

/** Várias linhas de texto com larguras irregulares (parece conteúdo real). */
export function SkLines({ widths = ['92%', '64%'], h = 10, gap = 8 }: { widths?: Len[]; h?: Len; gap?: number }) {
  return (
    <span aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap }}>
      {widths.map((w, i) => (
        <Sk key={i} w={w} h={h} />
      ))}
    </span>
  );
}
