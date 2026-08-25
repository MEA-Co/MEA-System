import type { GuidedConsultingAgentEventListener } from '@/features/guided-consulting/core/events';
import type { GuidedConsultingUserAction } from '@/features/guided-consulting/core/protocol';
import {
  createGuidedConsultingRendererRequest,
  createGuidedConsultingToolRequest,
  parseGuidedConsultingRendererResponse,
  parseGuidedConsultingToolRequest,
  parseGuidedConsultingToolResponse,
} from '@/features/guided-consulting/core/protocol';
import type { GuidedConsultingToolsRuntime } from '@/features/guided-consulting/core/tools';
import type {
  GuidedConsultingAgent,
  GuidedConsultingAgentSnapshot,
  GuidedConsultingDefinition,
  GuidedConsultingHistoryFrame,
  GuidedConsultingInputStatus,
  GuidedConsultingPhase,
  GuidedConsultingScreen,
  GuidedConsultingStep,
  GuidedConsultingStepResult,
  GuidedConsultingToolCall,
  GuidedConsultingToolCallKind,
} from '@/features/guided-consulting/core/types';

export type GuidedConsultingAgentOptions = {
  onEvent?: GuidedConsultingAgentEventListener;
};

type AgentState<Context extends object> = {
  phase: GuidedConsultingPhase;
  stepIndex: number;
  explanationIndex: number;
  context: Context;
  answers: Record<string, string>;
  history: Array<GuidedConsultingHistoryFrame<Context>>;
  error: Error | null;
  screen: GuidedConsultingScreen<Context> | null;
  pendingToolCalls: Array<GuidedConsultingToolCall>;
};

type ToolCallMetadata<Context extends object> = {
  purpose: 'validation' | 'action';
  value: string;
  context: Context;
};

function toError(error: unknown, fallback: string) {
  return error instanceof Error ? error : new Error(fallback);
}

function resolveExplanations<Context extends object, Tools extends object>(
  definition: GuidedConsultingDefinition<Context, Tools>,
  stepIndex: number,
  context: Context,
): ReadonlyArray<GuidedConsultingScreen<Context>['renderTarget']> {
  const step = definition.steps[stepIndex];
  if (!step) return [];

  const explanation =
    typeof step.explain === 'function' ? step.explain(context) : step.explain;
  return Array.isArray(explanation)
    ? explanation
    : [explanation as GuidedConsultingScreen<Context>['renderTarget']];
}

export function createGuidedConsultingAgent<
  Context extends object,
  Tools extends GuidedConsultingToolsRuntime,
>(
  definition: GuidedConsultingDefinition<Context, Tools>,
  tools: Tools,
  options: GuidedConsultingAgentOptions = {},
): GuidedConsultingAgent<Context, Tools> {
  const listeners = new Set<() => void>();
  const emitEvent: GuidedConsultingAgentEventListener =
    options.onEvent ?? (() => undefined);
  let callId = 0;
  let screenId = 0;
  let disposed = false;
  let state: AgentState<Context> = {
    phase: 'waiting-for-user',
    stepIndex: 0,
    explanationIndex: 0,
    context: definition.createInitialContext(),
    answers: {},
    history: [],
    error: null,
    screen: null,
    pendingToolCalls: [],
  };

  const setPhase = (phase: GuidedConsultingPhase) => {
    state.phase = phase;
  };

  const issueToolCall = (
    kind: GuidedConsultingToolCallKind,
    toolName: string,
    stepId: string | null,
    input: unknown,
    metadata?: unknown,
  ) => {
    const call: GuidedConsultingToolCall = {
      id: `call-${++callId}`,
      kind,
      toolName,
      stepId,
      input,
      metadata,
    };
    state.pendingToolCalls.push(call);
    emitEvent({ type: 'module.request.sent', call });
    return call;
  };

  const createScreenBase = (
    renderTarget: GuidedConsultingScreen<Context>['renderTarget'],
  ) => ({
    id: `screen-${++screenId}`,
    title: definition.title,
    stepIndex: state.stepIndex,
    stepCount: definition.steps.length,
    canGoBack: state.history.length > 0 && state.phase !== 'running-tools',
    renderTarget,
  });

  const presentScreen = (screen: GuidedConsultingScreen<Context>) => {
    state.screen = screen;
    issueToolCall(
      'screen',
      'screen.render',
      definition.steps[state.stepIndex]?.id ?? null,
      createGuidedConsultingRendererRequest(screen.renderTarget),
    );
  };

  const presentExplanation = (index: number) => {
    const step = definition.steps[state.stepIndex];
    if (!step) return;
    const explanations = resolveExplanations(
      definition,
      state.stepIndex,
      state.context,
    );
    const explanation = explanations[index];

    if (!explanation) {
      presentInput('ready', null);
      return;
    }

    state.explanationIndex = index;
    state.error = null;
    setPhase('waiting-for-user');
    presentScreen({
      ...createScreenBase(explanation),
      kind: 'explanation',
      stepId: step.id,
      explanationIndex: index,
      explanationCount: explanations.length,
    });
  };

  const presentInput = (
    status: GuidedConsultingInputStatus,
    error: string | null,
    value?: string,
  ) => {
    const step = definition.steps[state.stepIndex];
    if (!step) return;
    const inputValue = value ?? state.answers[step.id] ?? '';
    const running = status === 'validating' || status === 'running';

    state.error = error ? new Error(error) : null;
    setPhase(running ? 'running-tools' : error ? 'error' : 'waiting-for-user');
    const pendingMain =
      status === 'running' && step.pending
        ? typeof step.pending === 'function'
          ? step.pending({ value: inputValue, context: state.context })
          : step.pending
        : null;
    const inputMain = step.inputScreen
      ? typeof step.inputScreen === 'function'
        ? step.inputScreen({
            value: inputValue,
            status,
            error,
            context: state.context,
          })
        : step.inputScreen
      : null;
    presentScreen({
      ...createScreenBase(
        pendingMain ??
          inputMain ?? {
            screenId: 'input.default',
            mode: 'dynamic',
            data: {
              stepId: step.id,
              stepIndex: state.stepIndex,
              input: step.input,
              value: inputValue,
              status,
              error,
            },
          },
      ),
      kind: 'input',
      stepId: step.id,
      input: step.input,
      value: inputValue,
      status,
      error,
    });
  };

  const presentComplete = () => {
    setPhase('complete');
    const completeTarget =
      typeof definition.complete === 'function'
        ? definition.complete(state.context)
        : definition.complete;
    presentScreen({
      ...createScreenBase(
        completeTarget ?? {
          screenId: 'result.default',
          mode: 'dynamic',
          data: { context: state.context },
        },
      ),
      kind: 'complete',
      context: state.context,
    });
  };

  const startActionTool = (
    step: GuidedConsultingStep<Context, Tools>,
    value: string,
  ) => {
    state.answers = { ...state.answers, [step.id]: value };

    let request;
    try {
      request = createGuidedConsultingToolRequest(
        step.tool.id,
        step.tool.createInput({ value, context: state.context }),
      );
    } catch (cause) {
      const error = toError(cause, `${step.tool.id} 입력 생성에 실패했습니다.`);
      presentInput('error', error.message, value);
      return;
    }

    presentInput('running', null, value);
    issueToolCall('tool', step.tool.id, step.id, request, {
      purpose: 'action',
      value,
      context: state.context,
    } satisfies ToolCallMetadata<Context>);
  };

  const createSnapshot = (): GuidedConsultingAgentSnapshot<Context, Tools> => ({
    definitionId: definition.id,
    title: definition.title,
    phase: state.phase,
    stepIndex: state.stepIndex,
    stepCount: definition.steps.length,
    step: definition.steps[state.stepIndex] ?? null,
    context: state.context,
    answers: state.answers,
    error: state.error,
    canGoBack: state.history.length > 0 && state.phase !== 'running-tools',
    isComplete: state.phase === 'complete',
    screen: state.screen,
    pendingToolCalls: [...state.pendingToolCalls],
  });

  emitEvent({
    type: 'session.started',
    definitionId: definition.id,
    stepId: definition.steps[0]?.id ?? null,
  });
  presentExplanation(0);

  let snapshot = createSnapshot();

  const publish = () => {
    snapshot = createSnapshot();
    for (const listener of listeners) listener();
  };

  const send = (input: GuidedConsultingUserAction) => {
    if (disposed) return;
    emitEvent({
      type: 'user.action.received',
      action: input,
      stepId: definition.steps[state.stepIndex]?.id ?? null,
    });

    if (input.type === 'user.reset') {
      state.pendingToolCalls = [];
      state = {
        phase: 'waiting-for-user',
        stepIndex: 0,
        explanationIndex: 0,
        context: definition.createInitialContext(),
        answers: {},
        history: [],
        error: null,
        screen: null,
        pendingToolCalls: [],
      };
      presentExplanation(0);
      publish();
      return;
    }

    if (input.type === 'user.back') {
      if (state.phase === 'running-tools') {
        publish();
        return;
      }
      const frame = state.history.at(-1);
      if (!frame) {
        publish();
        return;
      }

      state.stepIndex = frame.stepIndex;
      state.context = frame.context;
      state.answers = frame.answers;
      state.history = state.history.slice(0, -1);
      state.explanationIndex = 0;
      state.error = null;
      presentInput('ready', null);
      publish();
      return;
    }

    const step = definition.steps[state.stepIndex];
    const screen = state.screen;
    if (!step || !screen) {
      publish();
      return;
    }

    if (state.phase === 'running-tools') {
      publish();
      return;
    }

    if (input.type === 'user.next-explanation') {
      const explanations = resolveExplanations(
        definition,
        state.stepIndex,
        state.context,
      );
      const nextIndex = Math.min(
        state.explanationIndex + 1,
        explanations.length - 1,
      );
      presentExplanation(nextIndex);
      publish();
      return;
    }

    if (input.type === 'user.previous-explanation') {
      const previousIndex = Math.max(state.explanationIndex - 1, 0);
      presentExplanation(previousIndex);
      publish();
      return;
    }

    if (input.type === 'user.start-input') {
      presentInput('ready', null);
      publish();
      return;
    }

    if (input.type === 'user.review-explanation') {
      presentExplanation(0);
      publish();
      return;
    }

    if (input.type === 'user.submit') {
      if (!step.validation) {
        startActionTool(step, input.value.trim());
        publish();
        return;
      }

      try {
        const request = createGuidedConsultingToolRequest(
          step.validation.id,
          step.validation.createInput({
            value: input.value,
            context: state.context,
          }),
        );
        presentInput('validating', null, input.value);
        issueToolCall('tool', step.validation.id, step.id, request, {
          purpose: 'validation',
          value: input.value,
          context: state.context,
        } satisfies ToolCallMetadata<Context>);
      } catch (cause) {
        const error = toError(
          cause,
          `${step.validation.id} 입력 생성에 실패했습니다.`,
        );
        presentInput('error', error.message, input.value);
      }
      publish();
    }
  };

  const executeToolCall = async (
    callIdToExecute: string,
    signal: AbortSignal,
  ) => {
    const call = state.pendingToolCalls.find(
      (candidate) => candidate.id === callIdToExecute,
    );
    if (!call)
      throw new Error(`Tool Call을 찾을 수 없습니다: ${callIdToExecute}`);

    if (call.kind === 'screen') {
      throw new Error('screen.render는 Renderer Runtime에서 실행해야 합니다.');
    }

    const request = parseGuidedConsultingToolRequest(call.input);
    return tools.execute(request, { signal });
  };

  const resolveToolCall = (resolvedCallId: string, output: unknown) => {
    if (disposed) return;
    const callIndex = state.pendingToolCalls.findIndex(
      (candidate) => candidate.id === resolvedCallId,
    );
    if (callIndex < 0) return;
    const [call] = state.pendingToolCalls.splice(callIndex, 1);
    emitEvent({ type: 'module.response.received', call, output });

    let toolResponse = null;
    if (call.kind === 'tool') {
      try {
        toolResponse = parseGuidedConsultingToolResponse(output);
      } catch (cause) {
        const metadata = call.metadata as ToolCallMetadata<Context> | undefined;
        const error = toError(cause, '올바르지 않은 Tool 응답입니다.');
        presentInput('error', error.message, metadata?.value);
        publish();
        return;
      }
    }

    if (toolResponse?.status === 'rejected') {
      const metadata = call.metadata as ToolCallMetadata<Context> | undefined;
      const error = new Error(toolResponse.error.message);
      state.error = error;
      presentInput('error', error.message, metadata?.value);
      publish();
      return;
    }

    if (call.kind === 'screen') {
      const response = parseGuidedConsultingRendererResponse(output);
      if (response.status === 'rejected') {
        state.error = new Error(response.error.message);
        setPhase('error');
      }
      publish();
      return;
    }

    const step = definition.steps.find(
      (candidate) => candidate.id === call.stepId,
    );
    if (!step) return;
    const metadata = call.metadata as ToolCallMetadata<Context> | undefined;
    if (!metadata || !toolResponse || toolResponse.status !== 'completed') {
      const error = new Error('Tool Result를 Step에 반영할 정보가 없습니다.');
      presentInput('error', error.message, metadata?.value);
      publish();
      return;
    }

    if (metadata.purpose === 'validation') {
      if (!step.validation) {
        const error = new Error('Step에 Validation Tool 설정이 없습니다.');
        presentInput('error', error.message, metadata.value);
        publish();
        return;
      }

      try {
        const value = step.validation.resolve({
          value: metadata.value,
          context: metadata.context,
          output: toolResponse.output,
        });
        startActionTool(step, value);
      } catch (cause) {
        const error = toError(cause, 'Validation Result 처리에 실패했습니다.');
        presentInput('error', error.message, metadata.value);
      }
      publish();
      return;
    }

    let result: GuidedConsultingStepResult<Context>;
    try {
      result = step.tool.resolve({
        value: metadata.value,
        context: metadata.context,
        output: toolResponse.output,
      });
    } catch (cause) {
      const error = toError(cause, 'Tool Result 처리에 실패했습니다.');
      presentInput('error', error.message, metadata.value);
      publish();
      return;
    }

    const contextBeforeAction = metadata.context;
    const nextContext = result.context
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
      const error = new Error(`다음 Step을 찾을 수 없습니다: ${result.next}`);
      state.error = error;
      presentInput('error', error.message, metadata.value);
      publish();
      return;
    }

    state.history = [
      ...state.history,
      {
        stepIndex: state.stepIndex,
        context: contextBeforeAction,
        answers: state.answers,
      },
    ];
    state.context = nextContext;
    state.stepIndex = nextStepIndex;
    state.explanationIndex = 0;
    state.error = null;

    if (nextStepIndex >= definition.steps.length) {
      presentComplete();
    } else {
      presentExplanation(0);
    }
    publish();
  };

  const rejectToolCall = (rejectedCallId: string, cause: unknown) => {
    if (disposed) return;
    const callIndex = state.pendingToolCalls.findIndex(
      (candidate) => candidate.id === rejectedCallId,
    );
    if (callIndex < 0) return;
    const [call] = state.pendingToolCalls.splice(callIndex, 1);
    const error = toError(cause, `${call.toolName} 실행에 실패했습니다.`);
    emitEvent({ type: 'module.error.received', call, error });

    if (call.kind === 'screen') {
      state.error = error;
      setPhase('error');
      publish();
      return;
    }

    const value = (call.metadata as ToolCallMetadata<Context> | undefined)
      ?.value;
    presentInput('error', error.message, value);
    publish();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send,
    executeToolCall,
    resolveToolCall,
    rejectToolCall,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      state.pendingToolCalls = [];
      listeners.clear();
    },
  };
}
