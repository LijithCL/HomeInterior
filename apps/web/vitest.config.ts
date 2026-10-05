import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Only the pure-logic layer (apps/web/src/lib) is covered so far — no
// React Testing Library / jsdom setup, since Canvas/Scene3D/etc. were
// already verified live via Playwright during each phase. This config
// exists to cover the document schema logic (migration, NaN sanitization,
// geometry math) with fast, no-browser tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
