import { z } from 'zod';

const ExtensionOriginSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (value.length === 0) return true;

    try {
      const url = new URL(value);
      return (
        url.protocol === 'chrome-extension:' &&
        url.hostname.length > 0 &&
        (url.pathname === '' || url.pathname === '/') &&
        url.search === '' &&
        url.hash === '' &&
        !value.endsWith('/')
      );
    } catch {
      return false;
    }
  }, 'EXTENSION_ORIGIN must be an exact chrome-extension://<id> origin')
  .transform((value) => (value.length === 0 ? undefined : value));

export const ServerConfigSchema = z.object({
  host: z.literal('127.0.0.1').default('127.0.0.1'),
  port: z.coerce.number().int().min(1).max(65535).default(8787),
  mockMode: z.boolean().default(false),
  extensionOrigin: ExtensionOriginSchema.optional(),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export function readServerConfig(
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const result = ServerConfigSchema.safeParse({
    host: env.HOST ?? '127.0.0.1',
    port: env.PORT ?? 8787,
    mockMode: env.MOCK_MODE === 'true' || argv.includes('--mock'),
    extensionOrigin: env.EXTENSION_ORIGIN ?? '',
  });

  if (!result.success) {
    throw new Error(`Invalid server configuration: ${result.error.message}`);
  }

  return result.data;
}
