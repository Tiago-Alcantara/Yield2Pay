import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Vitest substitui jest+ts-jest na API. O plugin swc compila os decorators do
 * NestJS com emitDecoratorMetadata (lendo o tsconfig), que o esbuild padrão do
 * vite não suporta — necessário para a injeção de dependências funcionar.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
    alias: {
      '@yield2pay/shared': new URL(
        '../../packages/shared/src/index.ts',
        import.meta.url,
      ).pathname,
      '@yield2pay/venue-core': new URL(
        '../../packages/venue-core/src/index.ts',
        import.meta.url,
      ).pathname,
      '@yield2pay/venue-stellar-blend': new URL(
        '../../venues/stellar-blend/src/index.ts',
        import.meta.url,
      ).pathname,
      '@yield2pay/venue-solana-kamino': new URL(
        '../../venues/solana-kamino/src/index.ts',
        import.meta.url,
      ).pathname,
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
