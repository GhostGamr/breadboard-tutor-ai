import { HealthResponseSchema, type HealthResponse } from '@breadboard/shared';
import express, { type ErrorRequestHandler, type Express } from 'express';

import { resolveAllowedOrigins } from './cors.js';
import { TutorError } from './session.js';
import { tutorRouter, type TutorOptions } from './tutor-router.js';

export const SERVICE_VERSION = '0.0.0';

export interface CreateAppOptions extends TutorOptions {
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

  app.use(express.json({ limit: '640kb' }));
  app.use(tutorRouter(options));
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof TutorError)
      res.status(error.status).json({ error: error.message });
    else if (error.status === 413)
      res.status(413).json({ error: 'JSON body too large' });
    else if (error.status >= 400 && error.status < 500)
      res.status(error.status).json({ error: 'Invalid request body' });
    else res.status(500).json({ error: 'Tutor request failed' });
  };
  app.use(handleError);
  return app;
}
