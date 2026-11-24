import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  installSidePanelBehavior,
  type SidePanelBehaviorHost,
} from './sidepanel-behavior';

interface FakeHost {
  host: SidePanelBehaviorHost;
  installedListeners: Array<() => void>;
  startupListeners: Array<() => void>;
  calls: Array<{ openPanelOnActionClick: boolean }>;
}

function createFakeHost(): FakeHost {
  const installedListeners: Array<() => void> = [];
  const startupListeners: Array<() => void> = [];
  const calls: Array<{ openPanelOnActionClick: boolean }> = [];

  return {
    installedListeners,
    startupListeners,
    calls,
    host: {
      runtime: {
        onInstalled: {
          addListener(listener) {
            installedListeners.push(listener);
          },
        },
        onStartup: {
          addListener(listener) {
            startupListeners.push(listener);
          },
        },
      },
      sidePanel: {
        async setPanelBehavior(behavior) {
          calls.push(behavior);
        },
      },
    },
  };
}

describe('installSidePanelBehavior', () => {
  it('sets toolbar action open behavior on load, install, and startup', () => {
    const fake = createFakeHost();

    installSidePanelBehavior(fake.host);

    expect(fake.calls).toEqual([{ openPanelOnActionClick: true }]);
    expect(fake.installedListeners).toHaveLength(1);
    expect(fake.startupListeners).toHaveLength(1);

    fake.installedListeners[0]?.();
    fake.startupListeners[0]?.();

    expect(fake.calls).toEqual([
      { openPanelOnActionClick: true },
      { openPanelOnActionClick: true },
      { openPanelOnActionClick: true },
    ]);
  });

  it('reports failures through the supplied error handler', async () => {
    const fake = createFakeHost();
    const onError = vi.fn();
    fake.host.sidePanel.setPanelBehavior = async () => {
      throw new Error('unavailable');
    };

    installSidePanelBehavior(fake.host, onError);
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('does not synthesize a grant or open the panel manually', () => {
    const backgroundPath = fileURLToPath(
      new URL('./background.ts', import.meta.url),
    );
    const source = readFileSync(backgroundPath, 'utf8');

    expect(source).not.toMatch(/onClicked/);
    expect(source).not.toMatch(/sidePanel\.open/);
    expect(source).not.toMatch(/tabs\.get/);
    expect(source).not.toMatch(/onMessage/);
    expect(source).not.toMatch(/actionGrantedTabId/);
  });
});
