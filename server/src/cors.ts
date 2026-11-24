export const DEFAULT_LOCALHOST_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
] as const;

export interface AllowedOriginsOptions {
  port?: number;
  extensionOrigin?: string;
}

export function resolveAllowedOrigins(
  options: AllowedOriginsOptions = {},
): readonly string[] {
  const port = options.port ?? 8787;
  const origins = [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    ...DEFAULT_LOCALHOST_ORIGINS,
  ];

  if (options.extensionOrigin) {
    origins.push(options.extensionOrigin);
  }

  return [...new Set(origins)];
}
