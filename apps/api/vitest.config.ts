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
      '@fixearn/shared': new URL(
        '../../packages/shared/src/index.ts',
        import.meta.url,
      ).pathname,
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
