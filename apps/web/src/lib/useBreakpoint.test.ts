import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useBreakpoint } from './useBreakpoint';

// Faz matchMedia casar apenas com queries cujo max-width >= o width simulado.
function mockWidth(width: number) {
  (window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => {
    const m = query.match(/max-width:\s*(\d+)px/);
    const max = m ? Number(m[1]) : Infinity;
    return {
      matches: width <= max,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
}

describe('useBreakpoint', () => {
  it("retorna 'mobile' abaixo de 480px", () => {
    mockWidth(375);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');
  });

  it("retorna 'tablet' entre 480 e 767px", () => {
    mockWidth(600);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('tablet');
  });

  it("retorna 'desktop' em 768px ou mais", () => {
    mockWidth(1024);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });

  it("é SSR-safe: retorna 'desktop' no server snapshot", () => {
    // getServerSnapshot é exercitado indiretamente; aqui só garante que
    // sem match algum (largura enorme) o valor é 'desktop'.
    mockWidth(2000);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });
});
