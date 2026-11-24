import type {
  TutorDecision,
  TutorEvidence,
  TutorLesson,
  TutorStep,
} from '@breadboard/shared';

export type Action = 'guide' | 'check' | 'ask';
export interface TutorProvider {
  evaluate(context: {
    action: Action;
    lesson: TutorLesson;
    step: TutorStep;
    evidence: TutorEvidence;
    question?: string;
    baseline?: { id: string; colour?: string; jpegBase64?: string };
  }): Promise<TutorDecision>;
}

function visibleControls(e: TutorEvidence) {
  return e.controls.filter(
    (c) =>
      c.rect.x < e.viewport.width &&
      c.rect.y < e.viewport.height &&
      c.rect.x + c.rect.width > 0 &&
      c.rect.y + c.rect.height > 0,
  );
}

export function selectedText(e: TutorEvidence) {
  const layer = e.sandbox
    ? e.sandbox.layers.find((l) => l.id === e.sandbox?.selectedLayerId)
    : visibleControls(e).find(
        (c) => c.registryKey === 'text-layer' && c.isActive,
      )?.selectedTextLayer;
  return layer?.kind === 'text' && layer.text?.trim() ? layer : undefined;
}

export function canvasText(e: TutorEvidence) {
  return (
    selectedText(e) ??
    e.sandbox?.layers.find((l) => l.kind === 'text' && l.text?.trim())
  );
}

function answer(
  question: string,
  step: TutorStep,
  move: boolean,
  type: boolean,
) {
  if (
    /text/i.test(question) &&
    /show|visib|see|appear|hidden/i.test(question)
  ) {
    const tool = move
      ? 'Move is active. Select Type before entering text.'
      : type
        ? 'Type is active. Click the canvas to enter text.'
        : 'Check that Type, not Move, is active.';
    return `${tool} In Layers, check whether the text layer is hidden and turn its visibility on if needed. Compare the text colour with the background and choose a contrasting colour.`;
  }
  if (/\b(type|text|canvas|layer|colour|color|document)\b/i.test(question))
    return step.instruction;
  return `I can help with this Photopea text lesson. For the current step: ${step.instruction}`;
}

export function conflictingEvidence(e: TutorEvidence) {
  const visible = visibleControls(e);
  const sandbox = e.sandbox;
  const layer = selectedText(e);
  return (
    (visible.some((c) => c.registryKey === 'move-tool' && c.isActive) &&
      visible.some((c) => c.registryKey === 'type-tool' && c.isActive)) ||
    (sandbox &&
      visible.some((c) => {
        if (c.registryKey === 'type-tool' || c.registryKey === 'move-tool')
          return c.isActive !== (c.registryKey === `${sandbox.tool}-tool`);
        if (c.registryKey === 'project-canvas')
          return !sandbox.projectCanvasVisible;
        if (
          c.registryKey === 'text-layer' &&
          c.isActive &&
          c.selectedTextLayer
        ) {
          const dom = c.selectedTextLayer;
          return (
            dom.id !== layer?.id ||
            dom.kind !== layer.kind ||
            (dom.text !== undefined && dom.text !== layer.text) ||
            (dom.colour !== undefined &&
              layer.colour !== undefined &&
              dom.colour.toLowerCase() !== layer.colour.toLowerCase())
          );
        }
        return false;
      }))
  );
}

export const mockProvider: TutorProvider = {
  async evaluate({ action, question, step, evidence: e, baseline }) {
    const visible = visibleControls(e);
    const active = (key: 'move-tool' | 'type-tool') =>
      visible.some((c) => c.registryKey === key && c.isActive);
    const move = e.sandbox?.tool === 'move' || active('move-tool');
    const type = e.sandbox?.tool === 'type' || active('type-tool');
    const layer = selectedText(e);
    const key = (
      {
        document: 'project-canvas',
        type: 'type-tool',
        text: 'project-canvas',
        colour: 'type-colour',
      } as const
    )[step.skill];
    const control = visible.find((c) => c.registryKey === key);
    const conflict = conflictingEvidence(e);
    const pass =
      !conflict &&
      {
        document: e.sandbox?.projectCanvasVisible ?? !!control,
        type:
          !move &&
          (e.sandbox ? e.sandbox.tool === 'type' : active('type-tool')),
        text: !!canvasText(e),
        colour:
          !!baseline?.colour &&
          layer?.id === baseline.id &&
          !!layer.colour &&
          layer.colour.toLowerCase() !== baseline.colour,
      }[step.skill];
    const outcome =
      action === 'ask'
        ? 'answer'
        : action === 'guide'
          ? 'guide'
          : pass
            ? 'pass'
            : 'retry';
    const diagnosis = conflict
      ? 'The tool or layer evidence disagrees. Confirm the active tool and selected layer, then capture again.'
      : action === 'ask'
        ? answer(question ?? '', step, move, type)
        : outcome === 'pass'
          ? 'The evidence confirms this step.'
          : step.skill === 'type' && move
            ? `Move is active. ${step.instruction}`
            : step.instruction;
    return {
      outcome,
      diagnosis,
      spokenText: diagnosis,
      target: control ? { controlId: control.id } : { registryKey: key },
      confidence: pass ? 1 : 0.8,
      needsUserToExposePanel: !pass && !control && !e.sandbox,
    };
  },
};
