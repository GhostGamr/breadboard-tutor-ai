import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const sandboxRoot = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(sandboxRoot, '..');

export default defineConfig({
  root: sandboxRoot,
  server: {
    port: 5173,
    fs: {
      allow: [projectRoot],
    },
  },
  build: {
    outDir: resolve(sandboxRoot, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
