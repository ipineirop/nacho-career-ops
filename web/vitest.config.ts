import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Minimal vitest config: pure-Node, no jsdom. v1 tests are pure functions in
// lib/ai (brief-linter). When component tests are added, layer jsdom on top.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // matching.test.ts uses node:test (run via `npx tsx --test`), not vitest.
    exclude: ['node_modules/**', 'lib/matching/matching.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
