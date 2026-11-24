import { randomUUID } from 'node:crypto';
import {
  freshCapture,
  type TutorDecision,
  type TutorLesson,
} from '@breadboard/shared';

export class TutorError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Session {
  lesson: TutorLesson;
  index: number;
  enteredAt: number;
  busy: boolean;
  captures: Set<string>;
  recent: number[];
  history: { stepId: string; outcome: TutorDecision['outcome'] }[];
  baseline?: { id: string; colour?: string; jpegBase64?: string };
  expires: number;
}

export class Sessions {
  private readonly sessions = new Map<string, Session>();
  start(lesson: TutorLesson) {
    const now = Date.now();
    for (const [key, session] of this.sessions) {
      if (session.expires <= now) this.sessions.delete(key);
    }
    if (this.sessions.size >= 1024)
      throw new TutorError(429, 'Session capacity reached');
    const id = randomUUID();
    this.sessions.set(id, {
      lesson,
      index: 0,
      enteredAt: now,
      busy: false,
      captures: new Set(),
      recent: [],
      history: [],
      expires: now + 3600000,
    });
    return id;
  }
  current(id: string, lessonId: string, stepId: string) {
    const s = this.sessions.get(id);
    if (!s || s.expires <= Date.now())
      throw new TutorError(404, 'Session not found');
    if (s.lesson.id !== lessonId || s.lesson.steps[s.index]?.id !== stepId)
      throw new TutorError(409, 'Lesson or step is not current');
    return s;
  }
}

export function assertFresh(capturedAt: number, enteredAt: number) {
  // Allow 250 ms of browser/server clock skew at a step boundary.
  if (capturedAt < enteredAt - 250)
    throw new TutorError(400, 'Evidence predates the current step');
  if (!freshCapture(capturedAt))
    throw new TutorError(400, 'Evidence is not fresh');
}

export function reserve(s: Session, captureId: string, capturedAt: number) {
  assertFresh(capturedAt, s.enteredAt);
  if (s.busy || s.captures.has(captureId))
    throw new TutorError(409, 'Concurrent or repeated evidence');
  const now = Date.now();
  s.recent = s.recent.filter((t) => t > now - 60000);
  if (s.recent.length >= 20 || s.captures.size >= 256)
    throw new TutorError(429, 'Session request limit reached');
  s.recent.push(now);
  s.captures.add(captureId);
  s.busy = true;
}
