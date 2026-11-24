import { describe, expect, it } from 'vitest';

import {
  Box2DSchema,
  CheckInputSchema,
  CheckOutputSchema,
  CheckResponseSchema,
  ControlInfoSchema,
  ExposePanelInputSchema,
  ExposePanelOutputSchema,
  GuideInputSchema,
  GuideOutputSchema,
  GuideResponseSchema,
  HealthInputSchema,
  HealthOutputSchema,
  LessonSchema,
  routeVoiceCommand,
  SandboxStateSchema,
  StartLessonInputSchema,
  StartLessonOutputSchema,
  StepSchema,
  TargetSchema,
  VoiceCommandInputSchema,
} from './index.js';

const control = {
  id: 'brush-button',
  label: 'Brush',
  role: 'button',
  rect: { x: 12, y: 20, width: 80, height: 32 },
  isActive: false,
};

const step = {
  id: 'step-1',
  index: 0,
  startSeconds: 70,
  endSeconds: 94,
  title: 'Select the brush',
  instruction: 'Click Brush in the toolbar. Draw one short stroke.',
  expectedState: { tool: 'brush' },
  targetHint: 'The Brush toolbar button.',
  commonMistakes: ['Painting before selecting the brush.'],
};

const lesson = {
  id: 'lesson-1',
  videoId: 'zVpeDyBLgiU',
  title: 'Photoshop basics',
  steps: [step],
  metadata: {
    sourceUrl: 'https://www.youtube.com/watch?v=zVpeDyBLgiU',
    durationSeconds: 224,
    chapters: [
      { label: 'Select the brush', startSeconds: 70 },
      { label: 'Draw a stroke', startSeconds: 94 },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
};

const guideResponse = {
  matchesExpected: false,
  diagnosis: 'The Move tool is still active.',
  spokenText: 'Click Brush in the toolbar.',
  target: { controlId: control.id },
  confidence: 0.91,
  timestampRef: { seconds: 70, label: 'Brush selection' },
  needsUserToExposePanel: false,
};

const checkResponse = {
  passed: true,
  reason: 'The brush stroke is visible.',
  spokenText: 'Nice work. Continue to the next step.',
  nextAction: 'advance',
  target: { box2d: [0.1, 0.2, 0.4, 0.7] },
};

describe('requested entity contracts', () => {
  it('accepts a lesson with video id, timed steps, and session metadata', () => {
    expect(LessonSchema.parse(lesson)).toEqual(lesson);
    expect(StepSchema.parse(step)).toEqual(step);
    expect(ControlInfoSchema.parse(control)).toEqual(control);
  });

  it('requires videoId and rejects invalid step timing', () => {
    const missingVideoId = {
      id: lesson.id,
      title: lesson.title,
      steps: lesson.steps,
      metadata: lesson.metadata,
    };
    expect(LessonSchema.safeParse(missingVideoId).success).toBe(false);

    expect(
      StepSchema.safeParse({ ...step, endSeconds: step.startSeconds }).success,
    ).toBe(false);
  });

  it('limits instructions to one or two sentences', () => {
    expect(
      StepSchema.safeParse({
        ...step,
        instruction: 'Click Brush. Draw a stroke. Save the file',
      }).success,
    ).toBe(false);
    expect(
      StepSchema.safeParse({
        ...step,
        instruction: 'Click Brush. Draw a stroke. Save the file.',
      }).success,
    ).toBe(false);
    expect(
      StepSchema.safeParse({ ...step, instruction: 'Click Brush and draw.' })
        .success,
    ).toBe(true);
  });

  it('validates normalized target boxes and requires a locator', () => {
    expect(Box2DSchema.parse([0.1, 0.2, 0.4, 0.7])).toEqual([
      0.1, 0.2, 0.4, 0.7,
    ]);
    expect(Box2DSchema.safeParse([0.4, 0.2, 0.1, 0.7]).success).toBe(false);
    expect(TargetSchema.safeParse({}).success).toBe(false);
    expect(
      TargetSchema.safeParse({ registryKey: 'layers-panel' }).success,
    ).toBe(true);
  });

  it('validates guide and check response contracts', () => {
    expect(GuideResponseSchema.parse(guideResponse)).toEqual(guideResponse);
    expect(CheckResponseSchema.parse(checkResponse)).toEqual(checkResponse);

    expect(
      CheckResponseSchema.safeParse({
        ...checkResponse,
        nextAction: 'ask',
      }).success,
    ).toBe(false);
    expect(
      GuideResponseSchema.safeParse({
        ...guideResponse,
        confidence: 1.5,
      }).success,
    ).toBe(false);
  });
});

describe('API input and output schemas', () => {
  it('validates start lesson input and output', () => {
    const input = { lessonId: lesson.id, sessionId: 'session-1' };
    const output = {
      sessionId: 'session-1',
      lesson,
      currentStep: step,
    };

    expect(StartLessonInputSchema.parse(input)).toEqual(input);
    expect(StartLessonOutputSchema.parse(output)).toEqual(output);
  });

  it('validates guide input and output', () => {
    const input = {
      sessionId: 'session-1',
      stepId: step.id,
      snapshot: { tool: 'move' },
      controls: [control],
    };

    expect(GuideInputSchema.parse(input)).toEqual(input);
    expect(GuideOutputSchema.parse({ response: guideResponse })).toEqual({
      response: guideResponse,
    });
  });

  it('validates check input and output', () => {
    const input = {
      sessionId: 'session-1',
      stepId: step.id,
      snapshot: { tool: 'brush' },
    };

    expect(CheckInputSchema.parse(input)).toEqual(input);
    expect(CheckOutputSchema.parse({ response: checkResponse })).toEqual({
      response: checkResponse,
    });
  });

  it('validates expose panel and health contracts', () => {
    expect(
      ExposePanelInputSchema.parse({ sessionId: 'session-1', exposed: true }),
    ).toEqual({ sessionId: 'session-1', exposed: true });
    expect(
      ExposePanelOutputSchema.parse({
        accepted: true,
        needsUserToExposePanel: false,
      }),
    ).toEqual({ accepted: true, needsUserToExposePanel: false });
    expect(HealthInputSchema.parse({})).toEqual({});
    expect(
      HealthOutputSchema.safeParse({
        status: 'ok',
        service: 'breadboard-server',
        version: '0.0.0',
        mockMode: false,
        timestamp: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});

describe('future command and sandbox contracts', () => {
  it('routes Help and Check my step to guide and check', () => {
    expect(routeVoiceCommand('Help')).toBe('guide');
    expect(routeVoiceCommand('  check   my step ')).toBe('check');
    expect(routeVoiceCommand('What is this?')).toBeUndefined();
    expect(
      VoiceCommandInputSchema.parse({ text: 'Help', route: 'guide' }),
    ).toEqual({ text: 'Help', route: 'guide' });
  });

  it('validates sandbox state for DOM inspection', () => {
    const state = {
      tool: 'brush',
      layers: [
        {
          id: 'brush-1',
          name: 'Brush 1',
          kind: 'paint',
          visible: true,
          x: 10,
          y: 20,
          color: '#2563eb',
          brushSize: 8,
          points: [{ x: 10, y: 20 }],
        },
      ],
      selectedLayerId: 'brush-1',
      canvas: { width: 900, height: 560 },
      draft: { text: 'BreadBoard', color: '#2563eb', brushSize: 8 },
    };

    expect(SandboxStateSchema.parse(state)).toEqual(state);
  });
});
