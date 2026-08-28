import type { ConsultingRenderTarget } from '@/features/consulting/core/renderer';
import type { ConsultingUserAction } from '@/features/consulting/core/user';

export type ConsultingReviewTarget =
  string | { stepId: string; stateId?: string };

export type ConsultingReviewState = {
  id: string;
  label?: string;
  description?: string;
  renderTarget: ConsultingRenderTarget;
  on?: Partial<Record<ConsultingUserAction['type'], ConsultingReviewTarget>>;
};

export type ConsultingReviewStep = {
  id: string;
  nodeId: string;
  description?: string;
  section?: string;
  states: ReadonlyArray<ConsultingReviewState>;
};

export type ConsultingReviewScenario = {
  id: string;
  label: string;
  description: string;
  steps: ReadonlyArray<ConsultingReviewStep>;
};

export type ConsultingReviewPlan = {
  id: string;
  scenarios: ReadonlyArray<ConsultingReviewScenario>;
};

export type ConsultingReviewSourcePlan = {
  title: string;
  nodes: Readonly<Record<string, { label: string }>>;
};
