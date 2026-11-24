import { HealthResponseSchema, type HealthResponse } from '@breadboard/shared';
import express, { type Express } from 'express';

import { resolveAllowedOrigins } from './cors.js';

export const SERVICE_VERSION = '0.0.0';

export interface CreateAppOptions {
  mockMode?: boolean;
  extensionOrigin?: string;
  port?: number;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const allowedOrigins = new Set(
    resolveAllowedOrigins({
      extensionOrigin: options.extensionOrigin,
      port: options.port,
    }),
  );

  app.disable('x-powered-by');
  app.use(express.json());
  app.use((request, response, next) => {
    response.setHeader('Vary', 'Origin');

    const origin = request.headers.origin;
    if (origin === undefined) {
      next();
      return;
    }

    if (!allowedOrigins.has(origin)) {
      response.status(403).json({ error: 'Origin not allowed' });
      return;
    }

    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PATCH,DELETE,OPTIONS',
    );
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }

    next();
  });

  app.get('/health', (_request, response) => {
    const body: HealthResponse = HealthResponseSchema.parse({
      status: 'ok',
      service: 'breadboard-server',
      version: SERVICE_VERSION,
      mockMode: options.mockMode ?? false,
      timestamp: new Date().toISOString(),
    });

    response.status(200).json(body);
  });

  return app;
}
