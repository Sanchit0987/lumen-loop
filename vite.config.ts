import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 9000,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
  },
});
