import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./test/setup.ts'], globals: true },
  resolve: {
    alias: {
      '@fixearn/shared': new URL('../../packages/shared/src', import.meta.url).pathname,
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
