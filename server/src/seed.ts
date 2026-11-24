import { TutorLessonSchema } from '@breadboard/shared';

export const seed = TutorLessonSchema.parse({
  id: 'photopea-text',
  software: 'photopea',
  videoId: 'zVpeDyBLgiU',
  title: 'How to Add Text in Photopea [2026 Full Guide]',
  durationSeconds: 224,
  steps: [
    {
      id: 'open-document',
      index: 0,
      skill: 'document',
      source: 'practice',
      instruction:
        'Practice prerequisite: create or open a document so the project canvas is visible.',
    },
    {
      id: 'select-type',
      index: 1,
      skill: 'type',
      source: 'video',
      seconds: 70,
      instruction: 'Select the Type tool in the toolbar.',
    },
    {
      id: 'canvas-text',
      index: 2,
      skill: 'text',
      source: 'video',
      seconds: 94,
      instruction: 'Click the canvas and enter text on a text layer.',
    },
    {
      id: 'text-colour',
      index: 3,
      skill: 'colour',
      source: 'video',
      seconds: 122,
      instruction: 'Select the same text layer and change its text colour.',
    },
  ],
});
