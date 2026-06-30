import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Suíte e2e / integração — separada da unit (`vitest.config.ts`, que só inclui
 * `src/**' + '/*.spec.ts` e é hermética).
 *
 * Inclui os specs de `test/`:
 *   - *.e2e-spec.ts        — sobem o AppModule do Nest (health faz app.init →
 *                            conecta no Postgres; bootstrap só compila o grafo DI).
 *   - *.integration-spec.ts — integrações externas (Postgres / on-chain),
 *                             cada uma com seu próprio guard de env:
 *                               RUN_DB_TESTS=1   → prisma.integration (só Postgres)
 *                               RUN_INTEGRATION=1 → deposit/vault (testnet + chaves)
 *
 * Rodar (com `pnpm db:up` antes — health.e2e precisa do banco):
 *   pnpm --filter @yield2pay/api test:e2e
 *   RUN_DB_TESTS=1 pnpm --filter @yield2pay/api test:e2e
 *   RUN_INTEGRATION=1 ... (após credenciais de testnet — ver itens 4/6)
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: [
      'test/**/*.e2e-spec.ts',
      'test/**/*.integration-spec.ts',
    ],
    setupFiles: ['./test/setup-env.ts'],
    alias: {
      '@yield2pay/shared': new URL(
        '../../packages/shared/src/index.ts',
        import.meta.url,
      ).pathname,
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
