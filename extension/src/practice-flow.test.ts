// @vitest-environment jsdom
import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { mockProvider, canvasText } from '../../server/src/provider';
import { seed } from '../../server/src/seed';
import { createSandbox } from './sandbox';
import { inspectPage, pointOnPage } from './page-context';

it('runs the free practice journey from real canvas state through mistake recovery to completion', async () => {
  document.body.innerHTML = `<div id="sandbox-app"><button data-tool="move">Move</button><button data-tool="type">Type</button><button data-tool="brush">Brush</button><input id="text-input" value="BreadBoard"><input id="color-input" type="color" value="#2563eb"><canvas id="artboard" width="900" height="560"></canvas><ul id="layer-list"></ul><pre data-testid="sandbox-state"></pre></div>`;
  const rect = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(10, 10, 100, 30));
  const sandbox = createSandbox(document.querySelector('#sandbox-app')!, {
    render: false,
  });
  let index = 0;
  let baseline: { id: string; colour?: string } | undefined;
  const jpeg =
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';
  const send = async (path: string) => {
    const evidence = {
      ...inspectPage(),
      jpegBase64: jpeg,
      captureId: randomUUID(),
      capturedAt: Date.now(),
    };
    const result = await mockProvider.evaluate({
      action: path === '/guide' ? 'guide' : 'check',
      lesson: seed,
      step: seed.steps[index],
      evidence,
      baseline,
    });
    if (result.outcome === 'pass') {
      if (seed.steps[index].skill === 'text') {
        const layer = canvasText(evidence)!;
        baseline = { id: layer.id, colour: layer.colour };
      }
      index++;
    }
    return {
      ...result,
      completed: index === seed.steps.length,
      step: seed.steps[index] ?? null,
    };
  };
  try {
    expect((await send('/check')).outcome).toBe('pass');
    expect((await send('/check')).outcome).toBe('retry');
    const help = await send('/guide');
    expect(help.diagnosis).toContain('Move is active');
    expect(
      pointOnPage(help.target, help.confidence, help.needsUserToExposePanel),
    ).toBe(true);
    expect(
      document.getElementById('breadboard-pointer')?.style.pointerEvents,
    ).toBe('none');
    (document.querySelector('[data-tool="type"]') as HTMLButtonElement).click();
    expect((await send('/check')).outcome).toBe('pass');
    expect((await send('/check')).outcome).toBe('retry');
    const id = sandbox.addTextLayer({ x: 100, y: 100 });
    expect((await send('/check')).outcome).toBe('pass');
    expect((await send('/check')).outcome).toBe('retry');
    const colour = document.querySelector<HTMLInputElement>('#color-input')!;
    colour.value = '#ff0000';
    colour.dispatchEvent(new Event('input', { bubbles: true }));
    expect(sandbox.getState().layers.find((l) => l.id === id)?.color).toBe(
      '#ff0000',
    );
    expect(await send('/check')).toMatchObject({
      outcome: 'pass',
      completed: true,
      step: null,
    });
  } finally {
    sandbox.dispose();
    rect.mockRestore();
    document.getElementById('breadboard-pointer')?.remove();
  }
});

it('withholds uncertain or stale vision pointers and maps normalized boxes', () => {
  const target = {
    box2d: [0.1, 0.2, 0.3, 0.4] as [number, number, number, number],
  };
  const viewport = { width: innerWidth, height: innerHeight };
  expect(pointOnPage(target, 0.7, false, viewport)).toBe(false);
  expect(pointOnPage(target, 1, true, viewport)).toBe(false);
  expect(
    pointOnPage(target, 1, false, {
      width: innerWidth + 1,
      height: innerHeight,
    }),
  ).toBe(false);
  expect(pointOnPage(target, 1, false, viewport)).toBe(true);
  const pointer = document.getElementById('breadboard-pointer')!;
  expect(Number.parseFloat(pointer.style.left)).toBeCloseTo(innerWidth * 0.2);
  expect(Number.parseFloat(pointer.style.top)).toBeCloseTo(innerHeight * 0.1);
  window.dispatchEvent(new Event('resize'));
  expect(document.getElementById('breadboard-pointer')).toBeNull();
});
