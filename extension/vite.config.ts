import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';

const extensionRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = resolve(extensionRoot, 'dist');

function copyManifest(): Plugin {
  return {
    name: 'breadboard-copy-manifest',
    async closeBundle() {
      await mkdir(outDir, { recursive: true });
      await copyFile(
        resolve(extensionRoot, 'manifest.json'),
        resolve(outDir, 'manifest.json'),
      );
    },
  };
}

export default defineConfig({
  root: extensionRoot,
  base: './',
  publicDir: false,
  plugins: [copyManifest()],
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        background: resolve(extensionRoot, 'src/background.ts'),
        sidepanel: resolve(extensionRoot, 'sidepanel.html'),
        sandbox: resolve(extensionRoot, 'sandbox.html'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background'
            ? 'background.js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
});
