import type {
  SandboxState,
  TutorDecision,
  TutorEvidence,
} from '@breadboard/shared';

export type PageContext = Pick<
  TutorEvidence,
  'viewport' | 'controls' | 'sandbox'
>;

// Self-contained: Chrome serializes this function into the active page.
export function inspectPage(): PageContext {
  document.getElementById('breadboard-pointer')?.remove();
  const controls: TutorEvidence['controls'] = [];
  const add = (
    key: TutorEvidence['controls'][number]['registryKey'],
    element: Element | null,
    active = false,
  ) => {
    if (!element) return;
    const r = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (
      !r.width ||
      !r.height ||
      style.visibility === 'hidden' ||
      style.display === 'none' ||
      r.right <= 0 ||
      r.bottom <= 0 ||
      r.left >= innerWidth ||
      r.top >= innerHeight
    )
      return;
    controls.push({
      id: key,
      registryKey: key,
      label: key.replaceAll('-', ' '),
      isActive: active,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    });
  };
  const root = document.querySelector<HTMLElement>('[data-sandbox-state]');
  if (root) {
    const state = JSON.parse(root.dataset.sandboxState || '{}') as SandboxState;
    add('project-canvas', document.querySelector('#artboard'));
    add(
      'move-tool',
      document.querySelector('[data-tool="move"]'),
      state.tool === 'move',
    );
    add(
      'type-tool',
      document.querySelector('[data-tool="type"]'),
      state.tool === 'type',
    );
    add('type-colour', document.querySelector('#color-input'));
    add('layers-panel', document.querySelector('#layer-list'));
    const layer = state.layers.find(
      (l) => l.id === state.selectedLayerId && l.kind === 'text' && l.visible,
    );
    if (layer)
      add(
        'text-layer',
        document.querySelector(`[data-layer-id="${layer.id}"]`),
        true,
      );
    return {
      viewport: { width: innerWidth, height: innerHeight },
      controls,
      sandbox: {
        tool: state.tool,
        projectCanvasVisible: !!document.querySelector('#artboard'),
        layers: state.layers
          .filter((l) => l.visible)
          .map((l) => ({
            id: l.id,
            kind: l.kind,
            colour: l.color,
            ...(l.kind === 'text' ? { text: l.text } : {}),
          })),
        selectedLayerId: state.selectedLayerId,
      },
    };
  }
  const firstVisible = (selector: string) =>
    [...document.querySelectorAll(selector)].find((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        getComputedStyle(el).visibility !== 'hidden'
      );
    }) ?? null;
  const move = firstVisible('button.toolbtn[title^="Move Tool"]');
  const type = firstVisible('button.toolbtn[title^="Type Tool"]');
  add('move-tool', move, move?.classList.contains('active'));
  add('type-tool', type, type?.classList.contains('active'));
  add('project-canvas', firstVisible('div.pbody > canvas'));
  add('type-colour', firstVisible('span.fitem.colorsample.bbtn'));
  add('layers-panel', firstVisible('div[title="Layers"]'));
  const selected = document
    .querySelector('.headL .thumb.active')
    ?.closest('.headL');
  // Do not infer a text layer or its colour from the layer's name. Live vision verifies it.
  if (selected) add('text-layer', selected, true);
  return { viewport: { width: innerWidth, height: innerHeight }, controls };
}

// Passive overlay: never moves or clicks the user's real cursor.
export function pointOnPage(
  target: TutorDecision['target'],
  confidence: number,
  expose: boolean,
  expectedViewport?: { width: number; height: number },
): boolean {
  document.getElementById('breadboard-pointer')?.remove();
  if (!target || confidence < 0.75 || expose) return false;
  let rect: { x: number; y: number; width: number; height: number } | undefined;
  const registry: Record<string, string> = document.querySelector(
    '[data-sandbox-state]',
  )
    ? {
        'project-canvas': '#artboard',
        'move-tool': '[data-tool="move"]',
        'type-tool': '[data-tool="type"]',
        'type-colour': '#color-input',
        'layers-panel': '#layer-list',
        'text-layer': '.layer.is-selected',
      }
    : {
        'project-canvas': 'div.pbody > canvas',
        'move-tool': 'button.toolbtn[title^="Move Tool"]',
        'type-tool': 'button.toolbtn[title^="Type Tool"]',
        'type-colour': 'span.fitem.colorsample.bbtn',
        'layers-panel': 'div[title="Layers"]',
        'text-layer': '.headL:has(.thumb.active)',
      };
  if ('box2d' in target) {
    if (
      !expectedViewport ||
      expectedViewport.width !== innerWidth ||
      expectedViewport.height !== innerHeight
    )
      return false;
    const [y, x, y2, x2] = target.box2d;
    rect = {
      x: x * innerWidth,
      y: y * innerHeight,
      width: (x2 - x) * innerWidth,
      height: (y2 - y) * innerHeight,
    };
  } else {
    const key = 'controlId' in target ? target.controlId : target.registryKey;
    const selector = registry[key];
    if (!selector) return false;
    const element = [...document.querySelectorAll(selector)].find(
      (el) =>
        el.getBoundingClientRect().width > 0 &&
        getComputedStyle(el).visibility !== 'hidden',
    );
    if (element) rect = element.getBoundingClientRect();
  }
  if (
    !rect ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.x >= innerWidth ||
    rect.y >= innerHeight ||
    rect.x + rect.width <= 0 ||
    rect.y + rect.height <= 0
  )
    return false;
  const overlay = document.createElement('div');
  overlay.id = 'breadboard-pointer';
  Object.assign(overlay.style, {
    position: 'fixed',
    left: `${Math.max(0, rect.x)}px`,
    top: `${Math.max(0, rect.y)}px`,
    width: `${Math.min(rect.width, innerWidth - Math.max(0, rect.x))}px`,
    height: `${Math.min(rect.height, innerHeight - Math.max(0, rect.y))}px`,
    border: '3px solid #fb923c',
    borderRadius: '8px',
    boxShadow: '0 0 0 5px #fb923c33',
    pointerEvents: 'none',
    zIndex: '2147483647',
    boxSizing: 'border-box',
  });
  const label = document.createElement('span');
  label.textContent = '↖ BreadBoard';
  Object.assign(label.style, {
    position: 'absolute',
    top: rect.y > 35 ? '-30px' : '4px',
    left: '0',
    background: '#17221e',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '5px',
    font: '600 13px system-ui',
    whiteSpace: 'nowrap',
  });
  overlay.append(label);
  document.documentElement.append(overlay);
  const clear = () => overlay.remove();
  window.addEventListener('scroll', clear, { once: true, capture: true });
  window.addEventListener('resize', clear, { once: true });
  window.setTimeout(() => {
    clear();
    window.removeEventListener('scroll', clear, true);
    window.removeEventListener('resize', clear);
  }, 9000);
  return true;
}
