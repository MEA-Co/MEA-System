import type {
  GuidedConsultingRenderTarget,
  GuidedConsultingToolError,
  GuidedConsultingUserAction,
} from '@/features/guided-consulting/core/protocol';

export type GuidedConsultingPhase =
  'waiting-for-user' | 'running-tools' | 'complete' | 'error';

export type GuidedConsultingToolId<Tools extends object> = Tools extends {
  ids: ReadonlyArray<infer Id>;
}
  ? Extract<Id, string>
  : string;

export type GuidedConsultingMemory<Context extends object> = {
  context: Readonly<Context>;
  actions: Readonly<Record<string, GuidedConsultingUserAction>>;
  toolResults: Readonly<Record<string, unknown>>;
  toolErrors: Readonly<Record<string, GuidedConsultingToolError>>;
  lastAction: GuidedConsultingUserAction | null;
  lastToolResult: unknown;
  lastToolError: GuidedConsultingToolError | null;
};

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

export type GuidedConsultingDefinition<
  Context extends object,
  Tools extends object,
> = {
  id: string;
  title: string;
  entry: string;
  createInitialContext: () => Context;
  nodes: Readonly<Record<string, GuidedConsultingPlanNode<Context, Tools>>>;
};

export type GuidedConsultingScreen = {
  id: string;
  nodeId: string;
  title: string;
  renderTarget: GuidedConsultingRenderTarget;
  availableActions: ReadonlyArray<GuidedConsultingUserAction['type']>;
  progress?: GuidedConsultingScreenProgress;
  draftKey?: string;
  terminal: boolean;
};

export type GuidedConsultingModuleCallKind = 'screen' | 'tool';

export type GuidedConsultingModuleCall = {
  id: string;
  kind: GuidedConsultingModuleCallKind;
  toolName: string;
  nodeId: string;
  input: unknown;
};

export type GuidedConsultingAgentSnapshot<
  Context extends object,
  Tools extends object,
> = {
  definitionId: string;
  sessionId: number;
  title: string;
  phase: GuidedConsultingPhase;
  currentNodeId: string;
  node: GuidedConsultingPlanNode<Context, Tools>;
  context: Context;
  actions: Readonly<Record<string, GuidedConsultingUserAction>>;
  toolResults: Readonly<Record<string, unknown>>;
  toolErrors: Readonly<Record<string, GuidedConsultingToolError>>;
  error: Error | null;
  isComplete: boolean;
  screen: GuidedConsultingScreen | null;
  pendingModuleCalls: ReadonlyArray<GuidedConsultingModuleCall>;
};

export type GuidedConsultingAgent<
  Context extends object,
  Tools extends object,
> = {
  getSnapshot: () => GuidedConsultingAgentSnapshot<Context, Tools>;
  subscribe: (listener: () => void) => () => void;
  send: (input: GuidedConsultingUserAction) => void;
  executeToolCall: (callId: string, signal: AbortSignal) => Promise<unknown>;
  resolveModuleCall: (callId: string, output: unknown) => void;
  rejectModuleCall: (callId: string, error: unknown) => void;
  dispose: () => void;
};
