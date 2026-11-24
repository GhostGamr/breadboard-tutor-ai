import { HealthResponseSchema } from '@breadboard/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

const EXTENSION_ORIGIN = 'chrome-extension://abcdefghijklmnop';

describe('createApp', () => {
  it('returns a validated health payload', async () => {
    const response = await request(createApp()).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('breadboard-server');
    expect(HealthResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it('reports mock mode when started with --mock', async () => {
    const response = await request(createApp({ mockMode: true }))
      .get('/health')
      .expect(200);

    expect(response.body.mockMode).toBe(true);
  });

  it('allows the exact configured extension origin', async () => {
    const response = await request(
      createApp({ extensionOrigin: EXTENSION_ORIGIN }),
    )
      .get('/health')
      .set('Origin', EXTENSION_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(
      EXTENSION_ORIGIN,
    );
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('allows only explicit localhost origins', async () => {
    const app = createApp({ port: 9000 });

    for (const origin of [
      'http://localhost:9000',
      'http://127.0.0.1:9000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]) {
      const response = await request(app)
        .get('/health')
        .set('Origin', origin)
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(origin);
    }
  });

  it('denies origins that are not explicitly allowed', async () => {
    const app = createApp({ extensionOrigin: EXTENSION_ORIGIN });

    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example')
      .expect(403);

    expect(response.body).toEqual({ error: 'Origin not allowed' });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();

    await request(app)
      .options('/health')
      .set('Origin', 'https://evil.example')
      .expect(403);
  });

  it('returns 404 for unknown routes', async () => {
    await request(createApp()).get('/does-not-exist').expect(404);
  });
});
