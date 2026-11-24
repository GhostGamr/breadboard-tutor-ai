// @vitest-environment jsdom

import { SandboxStateSchema } from '@breadboard/shared';
import { describe, expect, it } from 'vitest';

import { createSandbox, type SandboxApi } from './sandbox';

const sandboxMarkup = `
  <div id="sandbox-app" data-testid="sandbox-root">
    <div class="toolbar" role="toolbar">
      <button type="button" data-tool="move" aria-pressed="true">Move</button>
      <button type="button" data-tool="type" aria-pressed="false">Type</button>
      <button type="button" data-tool="brush" aria-pressed="false">Brush</button>
      <input id="text-input" type="text" value="BreadBoard" />
      <input id="color-input" type="color" value="#2563eb" />
      <input id="brush-size" type="range" min="1" max="40" value="8" />
    </div>
    <canvas id="artboard" width="900" height="560"></canvas>
    <ul id="layer-list" data-testid="layer-list"></ul>
    <pre id="sandbox-state" data-testid="sandbox-state"></pre>
  </div>
`;

function mountSandbox(): {
  root: HTMLElement;
  stateElement: HTMLElement;
  api: SandboxApi;
} {
  document.body.innerHTML = sandboxMarkup;
  const root = document.querySelector<HTMLElement>('#sandbox-app');
  const stateElement = document.querySelector<HTMLElement>(
    '[data-testid="sandbox-state"]',
  );
  if (!root || !stateElement) throw new Error('Test sandbox did not mount.');

  return { root, stateElement, api: createSandbox(root, { render: false }) };
}

describe('sandbox', () => {
  it.each(['pointercancel', 'lostpointercapture'])(
    'maps bordered canvas coordinates and ends owned gestures on %s',
    (endEvent) => {
      const { root, api } = mountSandbox();
      const canvas = root.querySelector('canvas')!;
      Object.defineProperties(canvas, {
        clientLeft: { value: 2 },
        clientTop: { value: 3 },
        clientWidth: { value: 450 },
        clientHeight: { value: 140 },
      });
      canvas.getBoundingClientRect = () => new DOMRect(10, 20, 454, 146);
      function send(type: string, pointerId: number, x = 0, y = 0) {
        const event = new MouseEvent(type, {
          bubbles: true,
          clientX: 12 + x,
          clientY: 23 + y,
        });
        canvas.dispatchEvent(Object.assign(event, { pointerId }));
      }

      api.setTool('brush');
      send('pointerdown', 1, 5, 5);
      send('pointerdown', 2);
      send('pointermove', 2);
      send('pointerup', 2);
      send('pointermove', 1, 8, 10);
      send(endEvent, 1);
      send('pointermove', 1);
      expect(api.getState().layers).toMatchObject([
        {
          points: [
            { x: 10, y: 20 },
            { x: 16, y: 40 },
          ],
        },
      ]);

      api.setTool('move');
      send('pointerdown', 2, 5, 5);
      send('pointermove', 1);
      expect(api.getState().layers[0]).toMatchObject({ x: 10, y: 20 });
      send(endEvent, 1);
      send('pointermove', 2, 7, 8);
      send(endEvent, 2);
      send('pointermove', 2);
      expect(api.getState().layers[0]).toMatchObject({ x: 14, y: 32 });
      api.dispose();
    },
  );

  it('exposes inspectable initial state in the DOM', () => {
    const { root } = mountSandbox();
    const rawState = root.dataset.sandboxState;

    expect(rawState).toBeTruthy();
    expect(
      SandboxStateSchema.parse(JSON.parse(rawState ?? '{}')),
    ).toMatchObject({
      tool: 'move',
      layers: [],
      selectedLayerId: null,
      canvas: { width: 900, height: 560 },
    });
  });

  it('switches tools from the toolbar', () => {
    const { api } = mountSandbox();
    const brushButton = document.querySelector<HTMLButtonElement>(
      '[data-tool="brush"]',
    );

    brushButton?.click();

    expect(api.getState().tool).toBe('brush');
    expect(brushButton?.getAttribute('aria-pressed')).toBe('true');
  });

  it('adds a text layer and mirrors it into state attributes', () => {
    const { root, stateElement, api } = mountSandbox();
    const layerId = api.addTextLayer({ x: 12, y: 34 }, 'Hello');

    const stateFromPre = JSON.parse(stateElement.dataset.state ?? '{}');
    const stateFromRoot = JSON.parse(root.dataset.sandboxState ?? '{}');

    expect(stateFromPre.layers[0]).toMatchObject({
      id: layerId,
      kind: 'text',
      text: 'Hello',
      x: 12,
      y: 34,
      visible: true,
    });
    expect(stateFromRoot.selectedLayerId).toBe(layerId);
    expect(
      document.querySelector(`[data-layer-id="${layerId}"]`),
    ).not.toBeNull();
  });

  it('toggles layer visibility from the layer list', () => {
    const { api } = mountSandbox();
    const layerId = api.addTextLayer({ x: 20, y: 40 }, 'Layer');
    const toggle = document.querySelector<HTMLButtonElement>(
      `[data-layer-id="${layerId}"] button[data-action="toggle"]`,
    );

    toggle?.click();
    const refreshedToggle = document.querySelector<HTMLButtonElement>(
      `[data-layer-id="${layerId}"] button[data-action="toggle"]`,
    );

    expect(api.getState().layers[0]?.visible).toBe(false);
    expect(refreshedToggle?.textContent).toBe('Show');
  });

  it('moves a selected layer and preserves brush strokes', () => {
    const { api } = mountSandbox();
    const strokeId = api.beginStroke({ x: 10, y: 10 });

    api.extendStroke({ x: 30, y: 40 });
    api.endStroke();
    api.moveLayer(strokeId, { x: 20, y: 25 });

    const layer = api.getState().layers[0];
    expect(layer).toMatchObject({ id: strokeId, kind: 'paint', x: 20, y: 25 });
    expect(layer?.kind === 'paint' ? layer.points : []).toEqual([
      { x: 20, y: 25 },
      { x: 40, y: 55 },
    ]);
  });
});
