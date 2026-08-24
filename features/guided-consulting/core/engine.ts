import type {
  GuidedConsultingDefinition,
  GuidedConsultingEngine,
  GuidedConsultingHistoryFrame,
  GuidedConsultingPhase,
  GuidedConsultingSnapshot,
} from '@/features/guided-consulting/core/types';

type EngineState<Context extends object> = {
  phase: GuidedConsultingPhase;
  stepIndex: number;
  context: Context;
  answers: Record<string, string>;
  history: Array<GuidedConsultingHistoryFrame<Context>>;
  error: Error | null;
};

function toError(error: unknown, fallback: string) {
  return error instanceof Error ? error : new Error(fallback);
}

export function createGuidedConsultingEngine<
  Context extends object,
  Tools extends object,
>(
  definition: GuidedConsultingDefinition<Context, Tools>,
  tools: Tools,
): GuidedConsultingEngine<Context, Tools> {
  let state: EngineState<Context> = {
    phase: 'waiting-for-input',
    stepIndex: 0,
    context: definition.createInitialContext(),
    answers: {},
    history: [],
    error: null,
  };
  const listeners = new Set<() => void>();
  let activeController: AbortController | null = null;
  let actionRequestId = 0;
  let disposed = false;

  const createSnapshot = (): GuidedConsultingSnapshot<Context, Tools> => {
    const step = definition.steps[state.stepIndex] ?? null;
    const guide = step
      ? typeof step.guide === 'function'
        ? step.guide(state.context)
        : step.guide
      : null;

    return {
      definitionId: definition.id,
      title: definition.title,
      phase: state.phase,
      stepIndex: state.stepIndex,
      stepCount: definition.steps.length,
      step,
      guide,
      context: state.context,
      answers: state.answers,
      error: state.error,
      canGoBack: state.history.length > 0 && state.phase !== 'running-action',
      isComplete: state.phase === 'complete',
    };
  };

  let snapshot = createSnapshot();

  const notify = () => {
    snapshot = createSnapshot();
    for (const listener of listeners) listener();
  };

  const update = (nextState: EngineState<Context>) => {
    state = nextState;
    notify();
  };

  const submit = (rawValue: string) => {
    if (
      disposed ||
      state.phase === 'running-action' ||
      state.phase === 'complete'
    ) {
      return;
    }

    const step = definition.steps[state.stepIndex];
    if (!step) return;

    let value: string;
    try {
      value = step.validate ? step.validate(rawValue) : rawValue.trim();
    } catch (error) {
      update({
        ...state,
        phase: 'waiting-for-input',
        error: toError(error, '입력값을 확인해 주세요.'),
      });
      return;
    }

    const requestId = ++actionRequestId;
    const contextBeforeAction = state.context;
    const answers = { ...state.answers, [step.id]: value };
    const historyFrame: GuidedConsultingHistoryFrame<Context> = {
      stepIndex: state.stepIndex,
      context: contextBeforeAction,
      answers,
    };
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;

    update({
      ...state,
      phase: 'running-action',
      answers,
      error: null,
    });

    void Promise.resolve()
      .then(() =>
        step.action({
          value,
          context: contextBeforeAction,
          tools,
          signal: controller.signal,
        }),
      )
      .then((result) => {
        if (
          disposed ||
          controller.signal.aborted ||
          requestId !== actionRequestId
        ) {
          return;
        }

        const context = result.context
          ? { ...contextBeforeAction, ...result.context }
          : contextBeforeAction;
        const nextStepIndex =
          result.next === null
            ? definition.steps.length
            : typeof result.next === 'string'
              ? definition.steps.findIndex(
                  (candidate) => candidate.id === result.next,
                )
              : state.stepIndex + 1;

        if (nextStepIndex < 0) {
          update({
            ...state,
            phase: 'error',
            context,
            error: new Error(`다음 Step을 찾을 수 없습니다: ${result.next}`),
          });
          return;
        }

        const complete = nextStepIndex >= definition.steps.length;
        update({
          phase: complete ? 'complete' : 'waiting-for-input',
          stepIndex: nextStepIndex,
          context,
          answers,
          history: [...state.history, historyFrame],
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (
          disposed ||
          controller.signal.aborted ||
          requestId !== actionRequestId
        ) {
          return;
        }

        update({
          ...state,
          phase: 'error',
          error: toError(error, 'Step 처리에 실패했습니다.'),
        });
      });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    submit,
    back: () => {
      if (disposed || state.phase === 'running-action') return;
      const frame = state.history.at(-1);
      if (!frame) return;

      actionRequestId += 1;
      activeController?.abort();
      activeController = null;
      update({
        phase: 'waiting-for-input',
        stepIndex: frame.stepIndex,
        context: frame.context,
        answers: frame.answers,
        history: state.history.slice(0, -1),
        error: null,
      });
    },
    retry: () => {
      if (state.phase !== 'error') return;
      const step = definition.steps[state.stepIndex];
      if (!step) return;
      submit(state.answers[step.id] ?? '');
    },
    reset: () => {
      actionRequestId += 1;
      activeController?.abort();
      activeController = null;
      update({
        phase: 'waiting-for-input',
        stepIndex: 0,
        context: definition.createInitialContext(),
        answers: {},
        history: [],
        error: null,
      });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      actionRequestId += 1;
      activeController?.abort();
      activeController = null;
      listeners.clear();
    },
  };
}
