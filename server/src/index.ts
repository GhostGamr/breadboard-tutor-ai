import { createApp } from './app.js';
import { readServerConfig } from './config.js';

const config = readServerConfig();
const app = createApp({
  mockMode: config.mockMode,
  extensionOrigin: config.extensionOrigin,
  port: config.port,
});

app.listen(config.port, config.host, () => {
  const mode = config.mockMode ? ' (mock mode)' : '';

  console.log(
    `BreadBoard server listening on http://${config.host}:${config.port}${mode}`,
  );
});
