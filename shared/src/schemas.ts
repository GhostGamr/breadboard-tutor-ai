import { z } from 'zod';

export const IdentifierSchema = z.string().trim().min(1);
export const SnapshotSchema = z.record(z.string(), z.unknown());

export const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});

export const ControlInfoSchema = z.object({
  id: IdentifierSchema,
  label: z.string().min(1),
  role: z.string().min(1),
  rect: RectSchema,
  isActive: z.boolean(),
});

export const Box2DSchema = z
  .tuple([
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().min(0).max(1),
  ])
  .refine(
    ([ymin, xmin, ymax, xmax]) => ymin < ymax && xmin < xmax,
    'box2d must be normalized as [ymin, xmin, ymax, xmax] with positive area',
  );

export const TargetSchema = z
  .object({
    controlId: IdentifierSchema.optional(),
    registryKey: z.string().min(1).optional(),
    box2d: Box2DSchema.optional(),
  })
  .refine(
    (target) =>
      target.controlId !== undefined ||
      target.registryKey !== undefined ||
      target.box2d !== undefined,
    'target must include controlId, registryKey, or box2d',
  );

function countSentences(value: string): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/[.!?]+(?:\s+|$)/).filter(Boolean).length;
}

export const InstructionSchema = z.string().refine((value) => {
  const sentences = countSentences(value);
  return sentences >= 1 && sentences <= 2;
}, 'instruction must be one or two sentences');

export const StepSchema = z
  .object({
    id: IdentifierSchema,
    index: z.number().int().nonnegative(),
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().nonnegative(),
    title: z.string().min(1),
    instruction: InstructionSchema,
    expectedState: SnapshotSchema,
    targetHint: z.string().min(1),
    commonMistakes: z.array(z.string().min(1)),
  })
  .refine((step) => step.endSeconds > step.startSeconds, {
    path: ['endSeconds'],
    message: 'endSeconds must be greater than startSeconds',
  });

export const LessonChapterSchema = z.object({
  label: z.string().min(1),
  startSeconds: z.number().nonnegative(),
});

export const LessonSessionMetadataSchema = z.object({
  sourceUrl: z.string().url().optional(),
  durationSeconds: z.number().positive().optional(),
  chapters: z.array(LessonChapterSchema).optional(),
  model: z.string().min(1).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const LessonSchema = z.object({
  id: IdentifierSchema,
  videoId: z.string().min(1),
  title: z.string().min(1),
  steps: z.array(StepSchema).min(1),
  metadata: LessonSessionMetadataSchema.optional(),
});

export const TimestampRefSchema = z.object({
  seconds: z.number().nonnegative(),
  label: z.string().min(1),
});

export const GuideResponseSchema = z.object({
  matchesExpected: z.boolean(),
  diagnosis: z.string().min(1),
  spokenText: z.string().min(1),
  target: TargetSchema,
  confidence: z.number().min(0).max(1),
  timestampRef: TimestampRefSchema.optional(),
  needsUserToExposePanel: z.boolean(),
});

export const CheckResponseSchema = z.object({
  passed: z.boolean(),
  reason: z.string().min(1),
  spokenText: z.string().min(1),
  nextAction: z.enum(['advance', 'retry', 'correct']),
  target: TargetSchema.optional(),
});

export const StartLessonInputSchema = z.object({
  lessonId: IdentifierSchema,
  sessionId: IdentifierSchema.optional(),
});

export const StartLessonOutputSchema = z.object({
  sessionId: IdentifierSchema,
  lesson: LessonSchema,
  currentStep: StepSchema,
});

export const GuideInputSchema = z.object({
  sessionId: IdentifierSchema,
  stepId: IdentifierSchema,
  snapshot: SnapshotSchema,
  controls: z.array(ControlInfoSchema).optional(),
});

export const GuideOutputSchema = z.object({
  response: GuideResponseSchema,
});

export const CheckInputSchema = z.object({
  sessionId: IdentifierSchema,
  stepId: IdentifierSchema,
  snapshot: SnapshotSchema,
  controls: z.array(ControlInfoSchema).optional(),
});

export const CheckOutputSchema = z.object({
  response: CheckResponseSchema,
});

export const ExposePanelInputSchema = z.object({
  sessionId: IdentifierSchema,
  exposed: z.boolean(),
});

export const ExposePanelOutputSchema = z.object({
  accepted: z.boolean(),
  needsUserToExposePanel: z.boolean(),
});

export const HealthInputSchema = z.object({});

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('breadboard-server'),
  version: z.string().min(1),
  mockMode: z.boolean(),
  timestamp: z.string().min(1),
});

export const HealthOutputSchema = HealthResponseSchema;

export const ControlInfoInputSchema = ControlInfoSchema;
export const LessonInputSchema = LessonSchema;
export const StepInputSchema = StepSchema;
export const GuideResponseOutputSchema = GuideResponseSchema;
export const CheckResponseOutputSchema = CheckResponseSchema;

export const CaptureTabRequestSchema = z.object({
  type: z.literal('CAPTURE_ACTIVE_TAB'),
});

export const CaptureTabResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    tabId: z.number().int().positive(),
    url: z.string().min(1),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string().min(1),
  }),
]);

export const VoiceCommandRouteSchema = z.enum(['guide', 'check']);

export const VoiceCommandInputSchema = z.object({
  text: z.string().min(1),
  route: VoiceCommandRouteSchema,
});

export type VoiceCommandRoute = z.infer<typeof VoiceCommandRouteSchema>;

/**
 * Later voice phases must route Help to guide and Check my step to check.
 * Unknown text is intentionally not treated as a separate ask flow.
 */
export function routeVoiceCommand(text: string): VoiceCommandRoute | undefined {
  const normalized = text.trim().replace(/\s+/g, ' ').toLowerCase();

  if (normalized === 'help') return 'guide';
  if (normalized === 'check my step') return 'check';
  return undefined;
}

export const SandboxPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const SandboxLayerSchema = z.discriminatedUnion('kind', [
  z.object({
    id: IdentifierSchema,
    name: z.string().min(1),
    kind: z.literal('text'),
    visible: z.boolean(),
    x: z.number(),
    y: z.number(),
    text: z.string(),
    color: z.string().min(1),
    fontSize: z.number().positive(),
  }),
  z.object({
    id: IdentifierSchema,
    name: z.string().min(1),
    kind: z.literal('paint'),
    visible: z.boolean(),
    x: z.number(),
    y: z.number(),
    color: z.string().min(1),
    brushSize: z.number().positive(),
    points: z.array(SandboxPointSchema).min(1),
  }),
]);

export const SandboxStateSchema = z.object({
  tool: z.enum(['move', 'type', 'brush']),
  layers: z.array(SandboxLayerSchema),
  selectedLayerId: IdentifierSchema.nullable(),
  canvas: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  draft: z.object({
    text: z.string(),
    color: z.string().min(1),
    brushSize: z.number().positive(),
  }),
});

export type Identifier = z.infer<typeof IdentifierSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type Rect = z.infer<typeof RectSchema>;
export type ControlInfo = z.infer<typeof ControlInfoSchema>;
export type Box2D = z.infer<typeof Box2DSchema>;
export type Target = z.infer<typeof TargetSchema>;
export type Step = z.infer<typeof StepSchema>;
export type LessonChapter = z.infer<typeof LessonChapterSchema>;
export type LessonSessionMetadata = z.infer<typeof LessonSessionMetadataSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type TimestampRef = z.infer<typeof TimestampRefSchema>;
export type GuideResponse = z.infer<typeof GuideResponseSchema>;
export type CheckResponse = z.infer<typeof CheckResponseSchema>;
export type StartLessonInput = z.infer<typeof StartLessonInputSchema>;
export type StartLessonOutput = z.infer<typeof StartLessonOutputSchema>;
export type GuideInput = z.infer<typeof GuideInputSchema>;
export type GuideOutput = z.infer<typeof GuideOutputSchema>;
export type CheckInput = z.infer<typeof CheckInputSchema>;
export type CheckOutput = z.infer<typeof CheckOutputSchema>;
export type ExposePanelInput = z.infer<typeof ExposePanelInputSchema>;
export type ExposePanelOutput = z.infer<typeof ExposePanelOutputSchema>;
export type HealthInput = z.infer<typeof HealthInputSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type CaptureTabRequest = z.infer<typeof CaptureTabRequestSchema>;
export type CaptureTabResponse = z.infer<typeof CaptureTabResponseSchema>;
export type VoiceCommandInput = z.infer<typeof VoiceCommandInputSchema>;
export type SandboxPoint = z.infer<typeof SandboxPointSchema>;
export type SandboxLayer = z.infer<typeof SandboxLayerSchema>;
export type ToolName = z.infer<typeof SandboxStateSchema>['tool'];
export type SandboxState = z.infer<typeof SandboxStateSchema>;
