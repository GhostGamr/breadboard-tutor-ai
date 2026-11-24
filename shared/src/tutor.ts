import { z } from 'zod';

import { Box2DSchema } from './schemas.js';

const id = z.string().regex(/^[\w-]{1,80}$/);
const videoId = z.string().regex(/^[\w-]{11}$/);
const text = z.string().trim().min(1).max(1000);
const colour = z.string().regex(/^#[a-fA-F0-9]{6}$/);
const dimension = z.number().finite().positive().max(65536);

export function youtubeVideoId(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
      return undefined;
    const candidate =
      url.hostname === 'youtu.be'
        ? url.pathname.slice(1)
        : ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(
              url.hostname,
            ) && url.pathname === '/watch'
          ? url.searchParams.get('v')
          : null;
    return videoId.safeParse(candidate).data;
  } catch {
    return undefined;
  }
}

export const TutorStartSchema = z
  .object({
    url: z
      .string()
      .max(2048)
      .refine((url) => !!youtubeVideoId(url))
      .optional(),
  })
  .strict();

const skill = z.enum(['document', 'type', 'text', 'colour']);
const step = z
  .object({
    id,
    index: z.number().int().nonnegative(),
    skill,
    instruction: text,
    source: z.enum(['practice', 'video']),
    seconds: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine((s) => (s.source === 'video') === (s.seconds !== undefined));
export const TutorLessonSchema = z
  .object({
    id,
    videoId,
    title: text,
    durationSeconds: z.number().int().positive(),
    steps: z.array(step).min(1).max(64),
  })
  .strict()
  .refine(
    (l) =>
      new Set(l.steps.map((s) => s.id)).size === l.steps.length &&
      l.steps.every(
        (s, i) =>
          s.index === i &&
          (s.seconds === undefined || s.seconds < l.durationSeconds),
      ),
  );

export const TutorStartResponseSchema = z
  .object({
    sessionId: id,
    lesson: TutorLessonSchema,
    step,
    source: z.enum(['seed', 'cache', 'provider']),
    cached: z.boolean(),
    mock: z.boolean(),
    fallback: z.boolean(),
  })
  .strict();

const registry = z.enum([
  'project-canvas',
  'move-tool',
  'type-tool',
  'text-layer',
  'type-colour',
  'layers-panel',
]);
const layer = z
  .object({
    id,
    kind: z.enum(['text', 'paint']),
    text: z.string().max(512).optional(),
    colour: colour.optional(),
  })
  .strict();
const control = z
  .object({
    id,
    registryKey: registry,
    label: z.string().max(128),
    isActive: z.boolean(),
    rect: z
      .object({
        x: z.number().finite(),
        y: z.number().finite(),
        width: dimension,
        height: dimension,
      })
      .strict(),
    selectedTextLayer: layer.optional(),
  })
  .strict();
// Check Huffman DCT headers; this does not decode tables, coefficients or pixels.
function hasJpegFrame(bytes: string): boolean {
  if (!bytes.endsWith('\xff\xd9')) return false;
  const byte = (i: number) => bytes.charCodeAt(i);
  const frame = new Set<number>();
  let frameType: number | undefined;
  let scanned = false;
  let i = 2;
  while (i < bytes.length && byte(i++) === 255) {
    while (byte(i) === 255) i++;
    const marker = byte(i++);
    if (marker === 0xd9) return scanned && i === bytes.length;
    const size = (byte(i) << 8) | byte(i + 1);
    if (size < 2 || i + size > bytes.length - 2) return false;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      frameType = marker;
      const precision = byte(i + 2);
      const count = byte(i + 7);
      if (
        frame.size ||
        (precision !== 8 && !(marker !== 0xc0 && precision === 12)) ||
        !count ||
        size !== 8 + 3 * count ||
        !(byte(i + 3) | byte(i + 4)) ||
        !(byte(i + 5) | byte(i + 6))
      )
        return false;
      for (let n = 0; n < count; n++) {
        const component = i + 8 + 3 * n;
        const sampling = byte(component + 1);
        const h = sampling >> 4,
          v = sampling & 15;
        if (h < 1 || h > 4 || v < 1 || v > 4 || byte(component + 2) > 3)
          return false;
        frame.add(byte(component));
      }
      if (frame.size !== count) return false;
    } else if (marker === 0xda) {
      const count = byte(i + 2);
      if (!count || count > 4 || count > frame.size || size !== 6 + 2 * count)
        return false;
      const scan = new Set<number>();
      const first = byte(i + size - 3),
        last = byte(i + size - 2);
      const approximation = byte(i + size - 1);
      const high = approximation >> 4,
        low = approximation & 15;
      if (frameType === 0xc2) {
        if (
          first > last ||
          last > 63 ||
          (first === 0 ? last !== 0 : count !== 1) ||
          high > 13 ||
          low > 13 ||
          (high !== 0 && high !== low + 1)
        )
          return false;
      } else if (first !== 0 || last !== 63 || approximation !== 0)
        return false;
      for (let n = 0; n < count; n++) {
        const id = byte(i + 3 + 2 * n);
        const selectors = byte(i + 4 + 2 * n);
        const dc = selectors >> 4,
          ac = selectors & 15;
        const maxTable = frameType === 0xc0 ? 1 : 3;
        if (
          dc > maxTable ||
          ac > maxTable ||
          (frameType === 0xc2 && (first === 0 ? ac !== 0 : dc !== 0))
        )
          return false;
        if (!frame.has(id) || scan.has(id)) return false;
        scan.add(id);
      }
      i += size;
      const start = i;
      while (i < bytes.length) {
        if (byte(i) !== 255) {
          i++;
          continue;
        }
        const next = byte(i + 1);
        if (next !== 0 && !(next >= 0xd0 && next <= 0xd7)) break;
        i += 2;
      }
      if (i === start) return false;
      scanned = true;
      continue;
    } else if (
      !(marker >= 0xe0 && marker <= 0xef) &&
      ![0xfe, 0xdb, 0xc4, 0xdd].includes(marker)
    )
      return false;
    i += size;
  }
  return false;
}

export function freshCapture(capturedAt: number): boolean {
  const age = Date.now() - capturedAt;
  return age >= -2000 && age <= 30000;
}

const jpeg = z
  .string()
  .min(8)
  .max(512 * 1024)
  .refine((value) => {
    if (
      !value.startsWith('/9j/') ||
      value.length % 4 ||
      /[^A-Za-z0-9+/=]/.test(value)
    )
      return false;
    try {
      const bytes = atob(value);
      return btoa(bytes) === value && hasJpegFrame(bytes);
    } catch {
      return false;
    }
  }, 'Expected bounded base64 JPEG evidence');

export const TutorEvidenceSchema = z
  .object({
    captureId: id,
    capturedAt: z.number().int().nonnegative().refine(freshCapture),
    jpegBase64: jpeg,
    viewport: z.object({ width: dimension, height: dimension }).strict(),
    controls: z
      .array(control)
      .max(80)
      .refine((cs) => new Set(cs.map((c) => c.id)).size === cs.length),
    sandbox: z
      .object({
        tool: z.enum(['move', 'type', 'brush']),
        projectCanvasVisible: z.boolean(),
        layers: z
          .array(layer)
          .max(80)
          .refine((ls) => new Set(ls.map((l) => l.id)).size === ls.length),
        selectedLayerId: id.nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const TutorGuideSchema = z
  .object({
    sessionId: id,
    lessonId: id,
    stepId: id,
    evidence: TutorEvidenceSchema,
  })
  .strict();
export const TutorCheckSchema = TutorGuideSchema;
export const TutorAskSchema = TutorGuideSchema.extend({ question: text });

export const TutorDecisionSchema = z
  .object({
    outcome: z.enum(['guide', 'answer', 'retry', 'pass']),
    diagnosis: text,
    spokenText: text,
    target: z
      .union([
        z.object({ controlId: id }).strict(),
        z.object({ registryKey: registry }).strict(),
        z.object({ box2d: Box2DSchema }).strict(),
      ])
      .optional(),
    confidence: z.number().min(0).max(1),
    needsUserToExposePanel: z.boolean(),
  })
  .strict();
export const TutorResponseSchema = TutorDecisionSchema.extend({
  timestampRef: z
    .object({ videoId, seconds: z.number().int().nonnegative() })
    .strict()
    .optional(),
  step: step.nullable(),
  completed: z.boolean(),
});
export type TutorLesson = z.infer<typeof TutorLessonSchema>;
export type TutorStep = TutorLesson['steps'][number];
export type TutorEvidence = z.infer<typeof TutorEvidenceSchema>;
export type TutorDecision = z.infer<typeof TutorDecisionSchema>;
