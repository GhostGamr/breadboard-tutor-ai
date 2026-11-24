import { expect, it } from 'vitest';
import { createGemini } from './gemini.js';
import { seed } from './seed.js';

function analyze(software: string) {
  const lesson = {
    ...seed,
    software,
    steps: [
      {
        id: 'first',
        index: 0,
        source: 'video',
        seconds: 15,
        skill: 'task',
        instruction: 'Create a new design.',
      },
    ],
  };
  const request = async () =>
    Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(lesson) }] } }],
    });
  return createGemini('test', undefined, request).lesson(lesson.videoId);
}

it.each(['canva', 'figma', 'photopea'])(
  'preserves the web software identified in a video for %s',
  async (software) => {
    expect((await analyze(software)).lesson.software).toBe(software);
  },
);
it('rejects unrecognized destinations from video analysis', async () => {
  await expect(analyze('https://example.org')).rejects.toMatchObject({
    status: 422,
  });
});
