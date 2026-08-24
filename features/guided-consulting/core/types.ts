export type GuidedConsultingPhase =
  'waiting-for-input' | 'running-action' | 'complete' | 'error';

export type GuidedConsultingGuide = {
  eyebrow?: string;
  title: string;
  description: string;
  tips?: ReadonlyArray<string>;
};

export type GuidedConsultingInput = {
  label: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
};

export type GuidedConsultingStepResult<Context extends object> = {
  context?: Partial<Context>;
  next?: string | null;
};

export type GuidedConsultingActionParams<
  Context extends object,
  Tools extends object,
> = {
  value: string;
  context: Readonly<Context>;
  tools: Tools;
  signal: AbortSignal;
};

export type GuidedConsultingStep<
  Context extends object,
  Tools extends object,
> = {
  id: string;
  guide:
    | GuidedConsultingGuide
    | ((context: Readonly<Context>) => GuidedConsultingGuide);
  input: GuidedConsultingInput;
  validate?: (value: string) => string;
  action: (
    params: GuidedConsultingActionParams<Context, Tools>,
  ) =>
    | GuidedConsultingStepResult<Context>
    | Promise<GuidedConsultingStepResult<Context>>;
};

export type GuidedConsultingDefinition<
  Context extends object,
  Tools extends object,
> = {
  id: string;
  title: string;
  createInitialContext: () => Context;
  steps: ReadonlyArray<GuidedConsultingStep<Context, Tools>>;
};

export type GuidedConsultingHistoryFrame<Context extends object> = {
  stepIndex: number;
  context: Context;
  answers: Record<string, string>;
};

export type GuidedConsultingSnapshot<
  Context extends object,
  Tools extends object,
> = {
  definitionId: string;
  title: string;
  phase: GuidedConsultingPhase;
  stepIndex: number;
  stepCount: number;
  step: GuidedConsultingStep<Context, Tools> | null;
  guide: GuidedConsultingGuide | null;
  context: Context;
  answers: Readonly<Record<string, string>>;
  error: Error | null;
  canGoBack: boolean;
  isComplete: boolean;
};

export type GuidedConsultingEngine<
  Context extends object,
  Tools extends object,
> = {
  getSnapshot: () => GuidedConsultingSnapshot<Context, Tools>;
  subscribe: (listener: () => void) => () => void;
  submit: (value: string) => void;
  back: () => void;
  retry: () => void;
  reset: () => void;
  dispose: () => void;
};
