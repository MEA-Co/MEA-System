import type { ConsultingRenderTarget } from '@/features/consulting/core/renderer';
import type { ConsultingUserAction } from '@/features/consulting/core/user';

export type ConsultingReviewScene = {
  id: string;
  nodeId: string;
  description?: string;
  section?: string;
  stateLabel?: string;
  renderTarget: ConsultingRenderTarget;
  previousSceneId?: string;
  nextSceneId?: string;
  on?: Partial<Record<ConsultingUserAction['type'], string>>;
};

export type ConsultingReviewScenario = {
  id: string;
  label: string;
  description: string;
  scenes: ReadonlyArray<ConsultingReviewScene>;
};

export type ConsultingReviewPlan = {
  id: string;
  scenarios: ReadonlyArray<ConsultingReviewScenario>;
};

export type ConsultingReviewSourcePlan = {
  title: string;
  nodes: Readonly<Record<string, { label: string }>>;
};
