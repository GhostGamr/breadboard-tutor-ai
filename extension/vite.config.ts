import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build, defineConfig, type Plugin } from 'vite';

const extensionRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = resolve(extensionRoot, 'dist');

function copyManifest(): Plugin {
  return {
    name: 'breadboard-copy-manifest',
    async closeBundle() {
      await build({
        configFile: false,
        define: { 'process.env.NODE_ENV': JSON.stringify('production') },
        publicDir: false,
        build: {
          outDir,
          emptyOutDir: false,
          lib: {
            entry: resolve(extensionRoot, 'src/workspace.tsx'),
            name: 'BreadBoardTutor',
            formats: ['iife'],
            fileName: () => 'workspace.js',
          },
        },
      });
      await copyFile(
        resolve(extensionRoot, 'src/dashboard-bridge.js'),
        resolve(outDir, 'dashboard-bridge.js'),
      );
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
