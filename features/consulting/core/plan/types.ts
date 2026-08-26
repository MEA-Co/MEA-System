import type { ConsultingMemory } from '@/features/consulting/core/agent';
import type { ConsultingRenderTarget } from '@/features/consulting/core/renderer';
import type { ConsultingUserAction } from '@/features/consulting/core/user';

export type ConsultingToolId<Tools extends object> = Tools extends {
  ids: ReadonlyArray<infer Id>;
}
  ? Extract<Id, string>
  : string;

export type ConsultingValueResolver<Context extends object, Value> =
  Value | ((memory: ConsultingMemory<Context>) => Value);

export type ConsultingPlanTransition<Context extends object> =
  | string
  | ((params: {
      action: ConsultingUserAction;
      memory: ConsultingMemory<Context>;
    }) => string);

export type ConsultingScreenProgress = {
  current: number;
  total: number;
};

export type ConsultingScreenNode<Context extends object> = {
  id: string;
  type: 'screen';
  screen: ConsultingValueResolver<Context, ConsultingRenderTarget>;
  on?: Partial<
    Record<ConsultingUserAction['type'], ConsultingPlanTransition<Context>>
  >;
  progress?: ConsultingScreenProgress;
  draftKey?: string;
  terminal?: boolean;
};

export type ConsultingToolResultParams<Context extends object> = {
  context: Readonly<Context>;
  output: unknown;
  memory: ConsultingMemory<Context>;
};

export type ConsultingToolNode<Context extends object, Tools extends object> = {
  id: string;
  type: 'tool';
  toolId: ConsultingToolId<Tools>;
  input: (memory: ConsultingMemory<Context>) => unknown;
  pendingScreen?: ConsultingValueResolver<Context, ConsultingRenderTarget>;
  progress?: ConsultingScreenProgress;
  next: string | ((params: ConsultingToolResultParams<Context>) => string);
  onRejected: string;
  reduce?: (params: ConsultingToolResultParams<Context>) => Context;
};

export type ConsultingPlanNode<Context extends object, Tools extends object> =
  ConsultingScreenNode<Context> | ConsultingToolNode<Context, Tools>;

export type ConsultingPlan<Context extends object, Tools extends object> = {
  id: string;
  title: string;
  entry: string;
  createInitialContext: () => Context;
  nodes: Readonly<Record<string, ConsultingPlanNode<Context, Tools>>>;
};
