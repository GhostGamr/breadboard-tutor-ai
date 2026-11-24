import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

interface ManifestLike {
  name: string;
  manifest_version: number;
  permissions: string[];
  host_permissions: string[];
  background: {
    service_worker: string;
    type: string;
  };
  action: Record<string, unknown>;
  side_panel: {
    default_path: string;
  };
}

const manifestPath = fileURLToPath(
  new URL('../manifest.json', import.meta.url),
);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestLike;

describe('Chrome MV3 manifest', () => {
  it('declares a side panel opened from the toolbar action', () => {
    expect(manifest.name).toBe('BreadBoard Side Panel');
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(expect.arrayContaining(['activeTab']));
    expect(manifest.permissions).toEqual(expect.arrayContaining(['sidePanel']));
    expect(manifest.side_panel.default_path).toBe('sidepanel.html');
    expect(manifest.action).toBeDefined();
  });

  it('limits host permissions to Photopea and localhost', () => {
    expect(manifest.host_permissions).toEqual([
      'https://photopea.com/*',
      'https://www.photopea.com/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ]);
    expect(manifest.host_permissions).not.toContain('<all_urls>');
  });

  it('uses a module service worker', () => {
    expect(manifest.background.service_worker).toBe('background.js');
    expect(manifest.background.type).toBe('module');
  });
});
