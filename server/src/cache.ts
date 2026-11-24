import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TutorLessonSchema } from '@breadboard/shared';

import { seed } from './seed.js';

const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export async function loadLesson(directory: string, requestedId: string) {
  // Phase 1 has exactly one authored source. Never cache it under another ID.
  const fallback = requestedId !== seed.videoId;
  const content = JSON.stringify(seed);
  const path = join(directory, `${seed.videoId}-${digest(content)}.json`);
  let invalid = false;
  try {
    const raw = await readFile(path, 'utf8');
    if (digest(raw) !== digest(content))
      throw new Error('Invalid cache digest');
    return {
      lesson: TutorLessonSchema.parse(JSON.parse(raw)),
      source: 'cache' as const,
      cached: true,
      fallback,
    };
  } catch (error) {
    invalid = (error as NodeJS.ErrnoException).code !== 'ENOENT';
  }
  try {
    await mkdir(directory, { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, content, { mode: 0o600 });
    await rename(temporary, path);
  } catch {
    invalid = true;
  }
  return {
    lesson: seed,
    source: 'seed' as const,
    cached: false,
    fallback: fallback || invalid,
  };
}
