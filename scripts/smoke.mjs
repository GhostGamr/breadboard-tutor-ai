#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const artifacts = [
  'shared/dist/index.js',
  'server/dist/index.js',
  'extension/dist/manifest.json',
  'extension/dist/background.js',
  'extension/dist/sidepanel.html',
  'extension/dist/workspace.js',
  'extension/dist/dashboard-bridge.js',
  'sandbox/dist/index.html',
];

for (const artifact of artifacts) {
  try {
    await access(resolve(root, artifact));
  } catch {
    console.error(
      `Missing build artifact: ${artifact}. Run npm run build first.`,
    );
    process.exit(1);
  }
}

const { HealthResponseSchema } = await import('@breadboard/shared');
const port = Number(process.env.SMOKE_PORT ?? '8791');
const server = spawn(
  process.execPath,
  [resolve(root, 'server/dist/index.js')],
  {
    cwd: root,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      MOCK_MODE: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += String(chunk);
});
server.stderr.on('data', (chunk) => {
  serverOutput += String(chunk);
});

const deadline = Date.now() + 5000;

try {
  let health;

  while (Date.now() < deadline && server.exitCode === null) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        health = await response.json();
        break;
      }
    } catch {
      await new Promise((done) => setTimeout(done, 100));
    }
  }

  if (!health) {
    throw new Error(`Server did not become healthy.\n${serverOutput}`);
  }

  const validated = HealthResponseSchema.parse(health);
  console.log(`smoke ok: ${validated.service} ${validated.status}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
}
