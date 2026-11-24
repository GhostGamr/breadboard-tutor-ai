import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@breadboard/shared': fileURLToPath(
        new URL('./shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: [
      'shared/**/*.test.ts',
      'server/**/*.test.ts',
      'extension/**/*.test.ts',
    ],
    environment: 'node',
    clearMocks: true,
  },
});
