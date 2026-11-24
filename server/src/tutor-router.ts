import { resolve } from 'node:path';
import { Router } from 'express';
import {
  TutorAskSchema,
  TutorCheckSchema,
  TutorDecisionSchema,
  TutorGuideSchema,
  TutorResponseSchema,
  TutorStartResponseSchema,
  TutorStartSchema,
  youtubeVideoId,
} from '@breadboard/shared';

import { loadLesson } from './cache.js';
import {
  canvasText,
  conflictingEvidence,
  mockProvider,
  selectedText,
  type TutorProvider,
} from './provider.js';
import { seed } from './seed.js';
import { assertFresh, reserve, Sessions, TutorError } from './session.js';

export interface TutorOptions {
  cacheDir?: string;
  provider?: TutorProvider;
}

export function tutorRouter(options: TutorOptions) {
  const router = Router();
  const sessions = new Sessions();
  const provider = options.provider ?? mockProvider;
  router.post('/lesson/start', async (req, res, next) => {
    try {
      const input = TutorStartSchema.safeParse(req.body);
      if (!input.success) throw new TutorError(400, 'Invalid lesson request');
      const requested = input.data.url
        ? youtubeVideoId(input.data.url)!
        : seed.videoId;
      const result = await loadLesson(
        options.cacheDir ?? resolve('.breadboard-cache'),
        requested,
      );
      res.json(
        TutorStartResponseSchema.parse({
          ...result,
          mock: provider === mockProvider,
          sessionId: sessions.start(result.lesson),
          step: result.lesson.steps[0],
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  for (const [action, schema] of [
    ['guide', TutorGuideSchema],
    ['check', TutorCheckSchema],
    ['ask', TutorAskSchema],
  ] as const) {
    router.post(`/${action}`, async (req, res, next) => {
      try {
        const input = schema.safeParse(req.body);
        if (!input.success) throw new TutorError(400, 'Invalid tutor request');
        const { sessionId, lessonId, stepId, evidence } = input.data;
        const s = sessions.current(sessionId, lessonId, stepId);
        reserve(s, evidence.captureId, evidence.capturedAt);
        try {
          const step = s.lesson.steps[s.index];
          const question =
            'question' in input.data && typeof input.data.question === 'string'
              ? input.data.question
              : undefined;
          const decision = TutorDecisionSchema.parse(
            await provider.evaluate({
              action,
              lesson: s.lesson,
              step,
              evidence,
              baseline: s.baseline,
              question,
            }),
          );
          sessions.current(sessionId, lessonId, stepId);
          assertFresh(evidence.capturedAt, s.enteredAt);
          const { target, outcome } = decision;
          if (
            (action === 'check'
              ? outcome !== 'retry' && outcome !== 'pass'
              : outcome !== (action === 'guide' ? 'guide' : 'answer')) ||
            (target &&
              'controlId' in target &&
              !evidence.controls.some((c) => c.id === target.controlId))
          ) {
            throw new TutorError(502, 'Invalid provider decision');
          }
          const index = s.index + Number(outcome === 'pass');
          const response = TutorResponseSchema.parse({
            ...decision,
            timestampRef:
              step.seconds === undefined
                ? undefined
                : { videoId: s.lesson.videoId, seconds: step.seconds },
            step: s.lesson.steps[index] ?? null,
            completed: index === s.lesson.steps.length,
          });
          if (outcome === 'pass' && step.skill === 'text') {
            const layer = canvasText(evidence);
            if (layer)
              s.baseline = {
                id: layer.id,
                colour: layer.colour?.toLowerCase(),
              };
          } else if (
            outcome === 'retry' &&
            step.skill === 'colour' &&
            s.baseline &&
            !s.baseline.colour &&
            !conflictingEvidence(evidence)
          ) {
            const layer = selectedText(evidence);
            if (layer?.id === s.baseline.id && layer.colour)
              s.baseline.colour = layer.colour.toLowerCase();
          }
          if (index !== s.index) s.enteredAt = Date.now();
          s.index = index;
          s.history.push({ stepId, outcome });
          if (s.history.length > 32) s.history.shift();
          res.json(response);
        } finally {
          s.busy = false;
        }
      } catch (error) {
        next(error);
      }
    });
  }
  return router;
}
