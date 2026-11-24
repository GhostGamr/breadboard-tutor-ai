import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGemini } from './gemini.js';
const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envPath))
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]])
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
import { createApp } from './app.js';
import { readServerConfig } from './config.js';

const config = readServerConfig();
const live =
  !config.mockMode && process.env.GEMINI_API_KEY
    ? createGemini(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL)
    : undefined;
const app = createApp({
  provider: live?.provider,
  generateLesson: live?.lesson,
  mockMode: !live,
  extensionOrigin: config.extensionOrigin,
  port: config.port,
});

app.listen(config.port, config.host, () => {
  const mode = !live ? ' (scripted practice mode)' : ' (live Gemini mode)';

  console.log(
    `BreadBoard server listening on http://${config.host}:${config.port}${mode}`,
  );
});
