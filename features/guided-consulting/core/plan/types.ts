import type { GuidedConsultingMemory } from '@/features/guided-consulting/core/agent/memory';
import type { GuidedConsultingUserAction } from '@/features/guided-consulting/core/protocol';
import type { GuidedConsultingRenderTarget } from '@/features/guided-consulting/core/renderer/protocol';

export type GuidedConsultingToolId<Tools extends object> = Tools extends {
  ids: ReadonlyArray<infer Id>;
}
  ? Extract<Id, string>
  : string;

export type GuidedConsultingValueResolver<Context extends object, Value> =
  Value | ((memory: GuidedConsultingMemory<Context>) => Value);

export type GuidedConsultingPlanTransition<Context extends object> =
  | string
  | ((params: {
      action: GuidedConsultingUserAction;
      memory: GuidedConsultingMemory<Context>;
    }) => string);

export type GuidedConsultingScreenProgress = {
  current: number;
  total: number;
};

export type GuidedConsultingScreenNode<Context extends object> = {
  id: string;
  type: 'screen';
  screen: GuidedConsultingValueResolver<Context, GuidedConsultingRenderTarget>;
  on?: Partial<
    Record<
      GuidedConsultingUserAction['type'],
      GuidedConsultingPlanTransition<Context>
    >
  >;
  progress?: GuidedConsultingScreenProgress;
  draftKey?: string;
  terminal?: boolean;
};

export type GuidedConsultingToolResultParams<Context extends object> = {
  context: Readonly<Context>;
  output: unknown;
  memory: GuidedConsultingMemory<Context>;
};

export type GuidedConsultingToolNode<
  Context extends object,
  Tools extends object,
> = {
  id: string;
  type: 'tool';
  toolId: GuidedConsultingToolId<Tools>;
  input: (memory: GuidedConsultingMemory<Context>) => unknown;
  pendingScreen?: GuidedConsultingValueResolver<
    Context,
    GuidedConsultingRenderTarget
  >;
  progress?: GuidedConsultingScreenProgress;
  next:
    string | ((params: GuidedConsultingToolResultParams<Context>) => string);
  onRejected: string;
  reduce?: (params: GuidedConsultingToolResultParams<Context>) => Context;
};

export type GuidedConsultingPlanNode<
  Context extends object,
  Tools extends object,
> =
  | GuidedConsultingScreenNode<Context>
  | GuidedConsultingToolNode<Context, Tools>;

export type GuidedConsultingPlan<
  Context extends object,
  Tools extends object,
> = {
  id: string;
  title: string;
  entry: string;
  createInitialContext: () => Context;
  nodes: Readonly<Record<string, GuidedConsultingPlanNode<Context, Tools>>>;
};
