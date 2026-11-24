import { describe, expect, it } from 'vitest';

import { readServerConfig } from './config.js';

describe('readServerConfig', () => {
  it('binds only to 127.0.0.1', () => {
    expect(readServerConfig([], {}).host).toBe('127.0.0.1');
    expect(readServerConfig([], { HOST: '127.0.0.1' }).host).toBe('127.0.0.1');
    for (const host of ['0.0.0.0', 'localhost', '192.168.1.2']) {
      expect(() => readServerConfig([], { HOST: host })).toThrow();
    }
  });

  it('accepts an exact extension origin', () => {
    const config = readServerConfig([], {
      EXTENSION_ORIGIN: 'chrome-extension://abcdefghijklmnop',
    });

    expect(config.extensionOrigin).toBe('chrome-extension://abcdefghijklmnop');
  });

  it('rejects extension origins with paths or other schemes', () => {
    expect(() =>
      readServerConfig([], {
        EXTENSION_ORIGIN: 'chrome-extension://abcdefghijklmnop/',
      }),
    ).toThrow(/EXTENSION_ORIGIN/);
    expect(() =>
      readServerConfig([], { EXTENSION_ORIGIN: 'https://evil.example' }),
    ).toThrow(/EXTENSION_ORIGIN/);
  });
});
