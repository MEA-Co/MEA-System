import type {
  GuidedConsultingRenderTarget,
  GuidedConsultingUserAction,
} from '@/features/guided-consulting/core/protocol';

export type GuidedConsultingPhase =
  'waiting-for-user' | 'running-tools' | 'complete' | 'error';

export type GuidedConsultingInput = {
  label: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
};

export type GuidedConsultingInputStatus =
  'ready' | 'validating' | 'running' | 'error';

export type GuidedConsultingStepResult<Context extends object> = {
  context?: Partial<Context>;
  next?: string | null;
};

export type GuidedConsultingStepToolInputParams<Context extends object> = {
  value: string;
  context: Readonly<Context>;
};

export type GuidedConsultingStepToolResultParams<Context extends object> = {
  value: string;
  context: Readonly<Context>;
  output: unknown;
};

export type GuidedConsultingToolId<Tools extends object> = Tools extends {
  ids: ReadonlyArray<infer Id>;
}
  ? Extract<Id, string>
  : string;

export type GuidedConsultingStepTool<
  Context extends object,
  Tools extends object,
> = {
  id: GuidedConsultingToolId<Tools>;
  createInput: (
    params: GuidedConsultingStepToolInputParams<Context>,
  ) => unknown;
  resolve: (
    params: GuidedConsultingStepToolResultParams<Context>,
  ) => GuidedConsultingStepResult<Context>;
};

export type GuidedConsultingStepValidation<
  Context extends object,
  Tools extends object,
> = {
  id: GuidedConsultingToolId<Tools>;
  createInput: (
    params: GuidedConsultingStepToolInputParams<Context>,
  ) => unknown;
  resolve: (params: GuidedConsultingStepToolResultParams<Context>) => string;
};

export type GuidedConsultingStep<
  Context extends object,
  Tools extends object,
> = {
  id: string;
  explain:
    | GuidedConsultingRenderTarget
    | ReadonlyArray<GuidedConsultingRenderTarget>
    | ((
        context: Readonly<Context>,
      ) =>
        | GuidedConsultingRenderTarget
        | ReadonlyArray<GuidedConsultingRenderTarget>);
  input: GuidedConsultingInput;
  inputScreen?:
    | GuidedConsultingRenderTarget
    | ((params: {
        value: string;
        status: GuidedConsultingInputStatus;
        error: string | null;
        context: Readonly<Context>;
      }) => GuidedConsultingRenderTarget);
  validation?: GuidedConsultingStepValidation<Context, Tools>;
  pending?:
    | GuidedConsultingRenderTarget
    | ((params: {
        value: string;
        context: Readonly<Context>;
      }) => GuidedConsultingRenderTarget);
  tool: GuidedConsultingStepTool<Context, Tools>;
};

export type GuidedConsultingDefinition<
  Context extends object,
  Tools extends object,
> = {
  id: string;
  title: string;
  createInitialContext: () => Context;
  steps: ReadonlyArray<GuidedConsultingStep<Context, Tools>>;
  complete?:
    | GuidedConsultingRenderTarget
    | ((context: Readonly<Context>) => GuidedConsultingRenderTarget);
};

export type GuidedConsultingHistoryFrame<Context extends object> = {
  stepIndex: number;
  context: Context;
  answers: Record<string, string>;
};

type GuidedConsultingScreenBase = {
  id: string;
  title: string;
  stepIndex: number;
  stepCount: number;
  canGoBack: boolean;
  renderTarget: GuidedConsultingRenderTarget;
};

export type GuidedConsultingExplanationScreen = GuidedConsultingScreenBase & {
  kind: 'explanation';
  stepId: string;
  explanationIndex: number;
  explanationCount: number;
};

export type GuidedConsultingInputScreen = GuidedConsultingScreenBase & {
  kind: 'input';
  stepId: string;
  input: GuidedConsultingInput;
  value: string;
  status: GuidedConsultingInputStatus;
  error: string | null;
};

export type GuidedConsultingCompleteScreen<Context extends object> =
  GuidedConsultingScreenBase & {
    kind: 'complete';
    context: Context;
  };

export type GuidedConsultingScreen<Context extends object> =
  | GuidedConsultingExplanationScreen
  | GuidedConsultingInputScreen
  | GuidedConsultingCompleteScreen<Context>;

export type GuidedConsultingToolCallKind = 'screen' | 'tool';

export type GuidedConsultingToolCall = {
  id: string;
  kind: GuidedConsultingToolCallKind;
  toolName: string;
  stepId: string | null;
  input: unknown;
  metadata?: unknown;
};

export type GuidedConsultingAgentSnapshot<
  Context extends object,
  Tools extends object,
> = {
  definitionId: string;
  title: string;
  phase: GuidedConsultingPhase;
  stepIndex: number;
  stepCount: number;
  step: GuidedConsultingStep<Context, Tools> | null;
  context: Context;
  answers: Readonly<Record<string, string>>;
  error: Error | null;
  canGoBack: boolean;
  isComplete: boolean;
  screen: GuidedConsultingScreen<Context> | null;
  pendingToolCalls: ReadonlyArray<GuidedConsultingToolCall>;
};

export type GuidedConsultingAgent<
  Context extends object,
  Tools extends object,
> = {
  getSnapshot: () => GuidedConsultingAgentSnapshot<Context, Tools>;
  subscribe: (listener: () => void) => () => void;
  send: (input: GuidedConsultingUserAction) => void;
  executeToolCall: (callId: string, signal: AbortSignal) => Promise<unknown>;
  resolveToolCall: (callId: string, output: unknown) => void;
  rejectToolCall: (callId: string, error: unknown) => void;
  dispose: () => void;
};
