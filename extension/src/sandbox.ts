import type {
  SandboxLayer,
  SandboxPoint,
  SandboxState,
  ToolName,
} from '@breadboard/shared';

export interface SandboxApi {
  getState(): SandboxState;
  setTool(tool: ToolName): void;
  addTextLayer(point: SandboxPoint, text?: string): string;
  beginStroke(point: SandboxPoint): string;
  extendStroke(point: SandboxPoint): void;
  endStroke(): void;
  selectLayer(id: string): void;
  toggleLayerVisibility(id: string): void;
  moveLayer(id: string, point: SandboxPoint): void;
  dispose(): void;
}

export interface CreateSandboxOptions {
  render?: boolean;
}

const TOOLS: readonly ToolName[] = ['move', 'type', 'brush'];

function isTool(value: string | undefined): value is ToolName {
  return value !== undefined && TOOLS.includes(value as ToolName);
}

function requireElement<T extends Element>(
  selector: string,
  scope: ParentNode,
): T {
  const element = scope.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

export function createSandbox(
  root: HTMLElement,
  options: CreateSandboxOptions = {},
): SandboxApi {
  const canvas = requireElement<HTMLCanvasElement>('#artboard', root);
  const stateElement = requireElement<HTMLElement>(
    '[data-testid="sandbox-state"]',
    root,
  );
  const layerList = requireElement<HTMLUListElement>('#layer-list', root);
  const textInput = root.querySelector<HTMLInputElement>('#text-input');
  const colorInput = root.querySelector<HTMLInputElement>('#color-input');
  const brushSizeInput = root.querySelector<HTMLInputElement>('#brush-size');
  const cleanups: Array<() => void> = [];

  let nextId = 1;
  let activePointerId: number | undefined;
  let activeStrokeId: string | undefined;
  let draggingLayerId: string | undefined;
  let dragOffset: SandboxPoint = { x: 0, y: 0 };

  let state: SandboxState = {
    tool: 'move',
    layers: [],
    selectedLayerId: null,
    canvas: { width: canvas.width, height: canvas.height },
    draft: {
      text: textInput?.value ?? 'BreadBoard',
      color: colorInput?.value || '#2563eb',
      brushSize: Number.parseInt(brushSizeInput?.value ?? '8', 10) || 8,
    },
  };

  function createId(prefix: string): string {
    const id = `${prefix}-${nextId}`;
    nextId += 1;
    return id;
  }

  function getState(): SandboxState {
    return JSON.parse(JSON.stringify(state)) as SandboxState;
  }

  function commit(next: SandboxState): void {
    state = next;

    const compact = JSON.stringify(state);
    stateElement.textContent = JSON.stringify(state, null, 2);
    stateElement.dataset.state = compact;
    root.dataset.sandboxState = compact;

    renderTools();
    renderLayers();
    renderCanvas();
  }

  function renderTools(): void {
    for (const button of root.querySelectorAll<HTMLButtonElement>(
      '[data-tool]',
    )) {
      const tool = button.dataset.tool;
      if (!isTool(tool)) continue;

      button.setAttribute('aria-pressed', String(tool === state.tool));
    }
  }

  function renderLayers(): void {
    layerList.replaceChildren();

    for (const layer of state.layers) {
      const item = document.createElement('li');
      item.dataset.layerId = layer.id;
      item.className =
        layer.id === state.selectedLayerId ? 'layer is-selected' : 'layer';

      const selectButton = document.createElement('button');
      selectButton.type = 'button';
      selectButton.dataset.action = 'select';
      selectButton.textContent = layer.name;
      selectButton.addEventListener('click', () => api.selectLayer(layer.id));

      const visibilityButton = document.createElement('button');
      visibilityButton.type = 'button';
      visibilityButton.dataset.action = 'toggle';
      visibilityButton.textContent = layer.visible ? 'Hide' : 'Show';
      visibilityButton.setAttribute(
        'aria-label',
        `${layer.visible ? 'Hide' : 'Show'} ${layer.name}`,
      );
      visibilityButton.addEventListener('click', () =>
        api.toggleLayerVisibility(layer.id),
      );

      item.append(selectButton, visibilityButton);
      layerList.append(item);
    }
  }

  function getCanvasContext(): CanvasRenderingContext2D | null {
    try {
      return canvas.getContext('2d');
    } catch {
      return null;
    }
  }

  function renderCanvas(): void {
    if (options.render === false) return;

    const context = getCanvasContext();
    if (!context) return;

    const { width, height } = state.canvas;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    context.strokeStyle = '#e2e8f0';
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += 40) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 40) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    for (const layer of state.layers) {
      if (!layer.visible) continue;

      if (layer.kind === 'paint') {
        context.strokeStyle = layer.color;
        context.fillStyle = layer.color;
        context.lineWidth = layer.brushSize;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.beginPath();

        layer.points.forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });

        if (layer.points.length === 1) {
          const point = layer.points[0];
          if (point) {
            context.arc(point.x, point.y, layer.brushSize / 2, 0, Math.PI * 2);
            context.fill();
          }
        } else {
          context.stroke();
        }
      } else {
        context.fillStyle = layer.color;
        context.font = `600 ${layer.fontSize}px system-ui, sans-serif`;
        context.fillText(layer.text, layer.x, layer.y + layer.fontSize);
      }

      if (layer.id === state.selectedLayerId) {
        context.save();
        context.strokeStyle = '#f97316';
        context.setLineDash([4, 3]);
        context.lineWidth = 1;
        const selectionWidth = textWidth(layer);
        const selectionHeight =
          layer.kind === 'text' ? layer.fontSize * 1.4 : layer.brushSize * 3;
        context.strokeRect(
          layer.x - 4,
          layer.y - 4,
          selectionWidth + 8,
          selectionHeight + 8,
        );
        context.restore();
      }
    }
  }

  function textWidth(layer: SandboxLayer): number {
    if (layer.kind === 'paint') return layer.brushSize;
    return Math.max(layer.text.length * layer.fontSize * 0.6, layer.fontSize);
  }

  function hitTest(point: SandboxPoint): SandboxLayer | undefined {
    return [...state.layers].reverse().find((layer) => {
      if (!layer.visible) return false;

      if (layer.kind === 'paint') {
        return layer.points.some(
          (candidate) =>
            Math.hypot(candidate.x - point.x, candidate.y - point.y) <=
            layer.brushSize,
        );
      }

      return (
        point.x >= layer.x &&
        point.x <= layer.x + textWidth(layer) &&
        point.y >= layer.y &&
        point.y <= layer.y + layer.fontSize
      );
    });
  }

  const api: SandboxApi = {
    getState,

    setTool(tool) {
      commit({ ...state, tool });
    },

    addTextLayer(point, text) {
      const label = text ?? state.draft.text;
      const name = label.trim() || 'Text layer';
      const id = createId('text');
      const layer: SandboxLayer = {
        id,
        name,
        kind: 'text',
        visible: true,
        x: point.x,
        y: point.y,
        text: label,
        color: state.draft.color,
        fontSize: 24,
      };

      commit({
        ...state,
        layers: [...state.layers, layer],
        selectedLayerId: id,
      });
      return id;
    },

    beginStroke(point) {
      const id = createId('brush');
      const layer: SandboxLayer = {
        id,
        name: `Brush ${nextId - 1}`,
        kind: 'paint',
        visible: true,
        x: point.x,
        y: point.y,
        color: state.draft.color,
        brushSize: state.draft.brushSize,
        points: [{ ...point }],
      };

      activeStrokeId = id;
      commit({
        ...state,
        layers: [...state.layers, layer],
        selectedLayerId: id,
      });
      return id;
    },

    extendStroke(point) {
      if (activeStrokeId === undefined) return;

      const layers = state.layers.map((layer) =>
        layer.id === activeStrokeId && layer.kind === 'paint'
          ? { ...layer, points: [...layer.points, { ...point }] }
          : layer,
      );
      commit({ ...state, layers });
    },

    endStroke() {
      activeStrokeId = undefined;
    },

    selectLayer(id) {
      if (!state.layers.some((layer) => layer.id === id)) return;
      commit({ ...state, selectedLayerId: id });
    },

    toggleLayerVisibility(id) {
      const layers = state.layers.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer,
      );
      commit({ ...state, layers });
    },

    moveLayer(id, point) {
      const current = state.layers.find((layer) => layer.id === id);
      if (!current) return;

      const deltaX = point.x - current.x;
      const deltaY = point.y - current.y;
      const layers = state.layers.map((layer) => {
        if (layer.id !== id) return layer;
        if (layer.kind === 'paint') {
          return {
            ...layer,
            x: point.x,
            y: point.y,
            points: layer.points.map((candidate) => ({
              x: candidate.x + deltaX,
              y: candidate.y + deltaY,
            })),
          };
        }
        return { ...layer, x: point.x, y: point.y };
      });

      commit({ ...state, layers });
    },

    dispose() {
      for (const cleanup of cleanups) cleanup();
    },
  };

  function pointFromEvent(event: PointerEvent): SandboxPoint {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(
        ((event.clientX - rect.left - canvas.clientLeft) * canvas.width) /
          canvas.clientWidth,
      ),
      y: Math.round(
        ((event.clientY - rect.top - canvas.clientTop) * canvas.height) /
          canvas.clientHeight,
      ),
    };
  }

  function capturePointer(pointerId: number): void {
    activePointerId = pointerId;
    try {
      canvas.setPointerCapture(pointerId);
    } catch {
      // Pointer capture is optional in test environments and older browsers.
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (activePointerId !== undefined) return;
    const point = pointFromEvent(event);

    if (state.tool === 'brush') {
      api.beginStroke(point);
      capturePointer(event.pointerId);
      return;
    }

    if (state.tool === 'type') {
      api.addTextLayer(point);
      return;
    }

    const layer = hitTest(point);
    if (!layer) return;

    api.selectLayer(layer.id);
    draggingLayerId = layer.id;
    dragOffset = { x: point.x - layer.x, y: point.y - layer.y };
    capturePointer(event.pointerId);
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) return;
    const point = pointFromEvent(event);

    if (state.tool === 'brush' && activeStrokeId !== undefined) {
      api.extendStroke(point);
    }

    if (draggingLayerId !== undefined) {
      api.moveLayer(draggingLayerId, {
        x: point.x - dragOffset.x,
        y: point.y - dragOffset.y,
      });
    }
  }

  function onPointerEnd(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) return;
    activePointerId = undefined;
    if (activeStrokeId !== undefined) api.endStroke();
    draggingLayerId = undefined;

    try {
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture may be unavailable after the canvas is detached.
    }
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>(
    '[data-tool]',
  )) {
    const handleClick = () => {
      const tool = button.dataset.tool;
      if (isTool(tool)) api.setTool(tool);
    };
    button.addEventListener('click', handleClick);
    cleanups.push(() => button.removeEventListener('click', handleClick));
  }

  if (textInput) {
    const handleInput = () =>
      commit({
        ...state,
        draft: { ...state.draft, text: textInput.value },
      });
    textInput.addEventListener('input', handleInput);
    cleanups.push(() => textInput.removeEventListener('input', handleInput));
  }

  if (colorInput) {
    const handleInput = () =>
      commit({
        ...state,
        draft: { ...state.draft, color: colorInput.value || '#2563eb' },
        layers: state.layers.map((layer) =>
          layer.id === state.selectedLayerId && layer.kind === 'text'
            ? { ...layer, color: colorInput.value || '#2563eb' }
            : layer,
        ),
      });
    colorInput.addEventListener('input', handleInput);
    cleanups.push(() => colorInput.removeEventListener('input', handleInput));
  }

  if (brushSizeInput) {
    const handleInput = () => {
      const brushSize = Number.parseInt(brushSizeInput.value, 10);
      if (!Number.isFinite(brushSize) || brushSize <= 0) return;

      commit({
        ...state,
        draft: { ...state.draft, brushSize },
      });
    };
    brushSizeInput.addEventListener('input', handleInput);
    cleanups.push(() =>
      brushSizeInput.removeEventListener('input', handleInput),
    );
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerEnd);
  window.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('lostpointercapture', onPointerEnd);
  cleanups.push(() => canvas.removeEventListener('pointerdown', onPointerDown));
  cleanups.push(() => window.removeEventListener('pointermove', onPointerMove));
  cleanups.push(() => window.removeEventListener('pointerup', onPointerEnd));
  cleanups.push(() =>
    window.removeEventListener('pointercancel', onPointerEnd),
  );
  cleanups.push(() =>
    canvas.removeEventListener('lostpointercapture', onPointerEnd),
  );

  commit(state);
  return api;
}
