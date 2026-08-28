import type { ConsultingMemory } from '@/features/consulting/core/agent';
import type { ConsultingRenderTarget } from '@/features/consulting/core/renderer';
import type { ConsultingToolRunPolicy } from '@/features/consulting/core/tools';
import type { ConsultingUserAction } from '@/features/consulting/core/user';

export type ConsultingToolId<Tools extends object> = Tools extends {
  ids: ReadonlyArray<infer Id>;
}
  ? Extract<Id, string>
  : string;

export type ConsultingValueResolver<Context extends object, Value> =
  Value | ((memory: ConsultingMemory<Context>) => Value);

export type ConsultingPlanTransitionParams<Context extends object> = {
  action: ConsultingUserAction;
  memory: ConsultingMemory<Context>;
};

export type ConsultingPlanTransitionTarget<Context extends object> =
  string | ((params: ConsultingPlanTransitionParams<Context>) => string);

export type ConsultingPlanTransition<Context extends object> =
  | ConsultingPlanTransitionTarget<Context>
  | {
      target: ConsultingPlanTransitionTarget<Context>;
      guard: (params: ConsultingPlanTransitionParams<Context>) => boolean;
    };

export type ConsultingScreenProgress = {
  current: number;
  total: number;
};

export type ConsultingToolEffect<Tools extends object> = {
  toolId: ConsultingToolId<Tools>;
  input: unknown;
  key?: string;
  groupId?: string;
  policy?: ConsultingToolRunPolicy;
  label?: string;
  resultKey?: string;
};

export type ConsultingScreenEffectResolver<
  Context extends object,
  Tools extends object,
> = (params: {
  action: ConsultingUserAction;
  memory: ConsultingMemory<Context>;
}) => ReadonlyArray<ConsultingToolEffect<Tools>>;

export type ConsultingScreenNode<
  Context extends object,
  Tools extends object,
> = {
  id: string;
  label: string;
  type: 'screen';
  screen: ConsultingValueResolver<Context, ConsultingRenderTarget>;
  on?: Partial<
    Record<ConsultingUserAction['type'], ConsultingPlanTransition<Context>>
  >;
  effects?: Partial<
    Record<
      ConsultingUserAction['type'],
      ConsultingScreenEffectResolver<Context, Tools>
    >
  >;
  progress?: ConsultingScreenProgress;
  draftKey?: string;
  terminal?: boolean;
};

export type ConsultingPlanNode<
  Context extends object,
  Tools extends object,
> = ConsultingScreenNode<Context, Tools>;

export type ConsultingPlan<Context extends object, Tools extends object> = {
  id: string;
  title: string;
  entry: string;
  createInitialContext: () => Context;
  nodes: Readonly<Record<string, ConsultingPlanNode<Context, Tools>>>;
};
