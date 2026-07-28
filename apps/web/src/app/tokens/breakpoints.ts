// Espelho TS dos tokens de breakpoint (app/tokens/breakpoints.css).
// Usado pelo pouco de JS responsivo restante (useBreakpoint).
export const BP = { mobile: 480, tablet: 768, desktop: 1200 } as const;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';
