import type { TutorStartResponseSchema, TutorStep } from '@breadboard/shared';
type Session = ReturnType<typeof TutorStartResponseSchema.parse>;
export interface Workspace {
  tasks: string[];
  session: Session;
  step: TutorStep | null;
}
