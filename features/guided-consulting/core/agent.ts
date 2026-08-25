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
  GuidedConsultingAgentLog,
  GuidedConsultingAgentLogKind,
  GuidedConsultingAgentOptions,
  GuidedConsultingAgentSnapshot,
  GuidedConsultingDefinition,
  GuidedConsultingExplanation,
  GuidedConsultingHistoryFrame,
  GuidedConsultingPhase,
  GuidedConsultingScreen,
  GuidedConsultingStepResult,
  GuidedConsultingToolCall,
  GuidedConsultingToolCallKind,
} from '@/features/guided-consulting/core/types';

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

type ValidationCallInput = {
  stepId: string;
  rawValue: string;
};

type StepCallMetadata<Context extends object> = {
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
): ReadonlyArray<GuidedConsultingExplanation> {
  const step = definition.steps[stepIndex];
  if (!step) return [];

  const explanation =
    typeof step.explain === 'function' ? step.explain(context) : step.explain;
  return Array.isArray(explanation)
    ? explanation
    : [explanation as GuidedConsultingExplanation];
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
  const logs: Array<GuidedConsultingAgentLog> = [];
  const maxLogs = options.maxLogs ?? 200;
  let logId = 0;
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

  const appendLog = (
    kind: GuidedConsultingAgentLogKind,
    _text: string,
    details: {
      stepId?: string | null;
      callId?: string;
      toolName?: string;
      data?: unknown;
    } = {},
  ) => {
    if (kind === 'agent.message' || kind === 'state.changed') return;

    const endpoint =
      details.toolName === 'screen.render'
        ? 'renderer'
        : details.toolName === 'input.validate'
          ? 'validator'
          : details.toolName;
    const inputType = (details.data as { type?: string } | undefined)?.type;
    const direction =
      kind === 'agent.input'
        ? inputType === 'consulting.started'
          ? 'system -> agent'
          : 'user -> agent'
        : kind === 'tool.call'
          ? `agent -> ${endpoint ?? 'tool'}`
          : `${endpoint ?? 'tool'} -> agent`;

    logs.push({
      id: ++logId,
      kind,
      text: direction,
      stepId: details.stepId ?? definition.steps[state.stepIndex]?.id ?? null,
      callId: details.callId,
      toolName: details.toolName,
      data: details.data,
    });

    if (logs.length > maxLogs) {
      logs.splice(0, logs.length - maxLogs);
    }
  };

  const setPhase = (phase: GuidedConsultingPhase, data?: unknown) => {
    const previousPhase = state.phase;
    state.phase = phase;
    if (previousPhase !== phase) {
      appendLog('state.changed', `${previousPhase} → ${phase}`, { data });
    }
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
    appendLog('tool.call', `${toolName} 호출`, {
      stepId,
      callId: call.id,
      toolName,
      data: input,
    });
    return call;
  };

  const createScreenBase = (
    main: GuidedConsultingScreen<Context>['main'],
    prompter: GuidedConsultingExplanation,
  ) => ({
    id: `screen-${++screenId}`,
    title: definition.title,
    stepIndex: state.stepIndex,
    stepCount: definition.steps.length,
    canGoBack: state.history.length > 0 && state.phase !== 'running-tools',
    main,
    prompter,
  });

  const presentScreen = (screen: GuidedConsultingScreen<Context>) => {
    state.screen = screen;
    issueToolCall(
      'screen',
      'screen.render',
      definition.steps[state.stepIndex]?.id ?? null,
      createGuidedConsultingRendererRequest(screen.main),
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
      ...createScreenBase(
        explanation.main ?? {
          screenId: 'tutorial.default',
          mode: 'static',
        },
        explanation,
      ),
      kind: 'explanation',
      stepId: step.id,
      explanation,
      explanationIndex: index,
      explanationCount: explanations.length,
    });
  };

  const presentInput = (
    status: 'ready' | 'validating' | 'running' | 'error',
    error: string | null,
    value?: string,
  ) => {
    const step = definition.steps[state.stepIndex];
    if (!step) return;
    const inputValue = value ?? state.answers[step.id] ?? '';
    const running = status === 'validating' || status === 'running';

    state.error = error ? new Error(error) : null;
    setPhase(running ? 'running-tools' : error ? 'error' : 'waiting-for-user');
    const prompter: GuidedConsultingExplanation = {
      eyebrow: 'INPUT',
      title: running
        ? status === 'validating'
          ? '입력 내용을 확인하고 있어요'
          : '입력을 바탕으로 작업하고 있어요'
        : error
          ? '입력 내용을 다시 확인해 주세요'
          : '이제 직접 입력해보세요',
      description: running
        ? '작업이 끝나면 중심 에이전트가 다음 화면을 요청합니다.'
        : (error ??
          `‘${step.input.label}’을 작성한 뒤 입력 완료를 눌러주세요.`),
    };
    const pendingMain =
      status === 'running' && step.pending
        ? typeof step.pending === 'function'
          ? step.pending({ value: inputValue, context: state.context })
          : step.pending
        : null;
    presentScreen({
      ...createScreenBase(
        pendingMain ?? {
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
        prompter,
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
    presentScreen({
      ...createScreenBase(
        {
          screenId: 'result.default',
          mode: 'dynamic',
          data: { context: state.context },
        },
        {
          eyebrow: 'COMPLETE',
          title: '나만의 결과가 완성됐어요',
          description:
            '화면에 정리된 결과를 확인해보세요. 수정하려면 이전 단계로 돌아갈 수 있어요.',
        },
      ),
      kind: 'complete',
      context: state.context,
    });
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
    logs: [...logs],
  });

  appendLog('agent.input', '컨설팅 시작 이벤트를 받았습니다.', {
    stepId: definition.steps[0]?.id ?? null,
    data: { type: 'consulting.started', definitionId: definition.id },
  });
  appendLog('agent.message', '첫 번째 설명 화면을 표시합니다.');
  presentExplanation(0);

  let snapshot = createSnapshot();

  const publish = () => {
    snapshot = createSnapshot();
    for (const listener of listeners) listener();
  };

  const logAgentInput = (input: GuidedConsultingUserAction) => {
    const labels: Record<GuidedConsultingUserAction['type'], string> = {
      'user.next-explanation': '사용자가 다음 설명을 요청했습니다.',
      'user.previous-explanation': '사용자가 이전 설명을 요청했습니다.',
      'user.start-input': '사용자가 입력 화면을 요청했습니다.',
      'user.review-explanation': '사용자가 설명 다시 보기를 요청했습니다.',
      'user.submit': '사용자가 입력을 제출했습니다.',
      'user.back': '사용자가 이전 단계로 이동했습니다.',
      'user.reset': '사용자가 컨설팅을 다시 시작했습니다.',
    };
    appendLog('agent.input', labels[input.type], { data: input });
  };

  const send = (input: GuidedConsultingUserAction) => {
    if (disposed) return;
    logAgentInput(input);

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
      appendLog('agent.message', '컨설팅을 초기화하고 처음부터 시작합니다.');
      presentExplanation(0);
      publish();
      return;
    }

    if (input.type === 'user.back') {
      if (state.phase === 'running-tools') {
        appendLog('agent.message', '도구 실행 중에는 뒤로갈 수 없습니다.');
        publish();
        return;
      }
      const frame = state.history.at(-1);
      if (!frame) {
        appendLog('agent.message', '이전 단계가 없습니다.');
        publish();
        return;
      }

      state.stepIndex = frame.stepIndex;
      state.context = frame.context;
      state.answers = frame.answers;
      state.history = state.history.slice(0, -1);
      state.explanationIndex = 0;
      state.error = null;
      appendLog(
        'agent.message',
        '이전 단계의 설명은 건너뛰고 입력 화면을 표시합니다.',
      );
      presentInput('ready', null);
      publish();
      return;
    }

    const step = definition.steps[state.stepIndex];
    const screen = state.screen;
    if (!step || !screen) {
      appendLog('agent.message', '현재 처리할 수 있는 단계가 없습니다.');
      publish();
      return;
    }

    if (state.phase === 'running-tools') {
      appendLog('agent.message', '현재 Tool Result를 기다리고 있습니다.');
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
      appendLog('agent.message', '다음 설명 화면을 표시합니다.');
      presentExplanation(nextIndex);
      publish();
      return;
    }

    if (input.type === 'user.previous-explanation') {
      const previousIndex = Math.max(state.explanationIndex - 1, 0);
      appendLog('agent.message', '이전 설명 화면을 표시합니다.');
      presentExplanation(previousIndex);
      publish();
      return;
    }

    if (input.type === 'user.start-input') {
      appendLog('agent.message', '사용자 입력 화면을 표시합니다.');
      presentInput('ready', null);
      publish();
      return;
    }

    if (input.type === 'user.review-explanation') {
      appendLog('agent.message', '설명을 첫 페이지부터 다시 표시합니다.');
      presentExplanation(0);
      publish();
      return;
    }

    if (input.type === 'user.submit') {
      appendLog('agent.message', '제출된 입력을 검증 도구에 전달합니다.');
      presentInput('validating', null, input.value);
      issueToolCall('validation', 'input.validate', step.id, {
        stepId: step.id,
        rawValue: input.value,
      } satisfies ValidationCallInput);
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

    if (call.kind === 'validation') {
      const input = call.input as ValidationCallInput;
      const step = definition.steps.find(
        (candidate) => candidate.id === input.stepId,
      );
      if (!step) throw new Error(`Step을 찾을 수 없습니다: ${input.stepId}`);
      const value = step.validate
        ? step.validate(input.rawValue)
        : input.rawValue.trim();
      return { value };
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

    let toolResponse = null;
    if (call.kind === 'step') {
      try {
        toolResponse = parseGuidedConsultingToolResponse(output);
      } catch (cause) {
        const metadata = call.metadata as StepCallMetadata<Context> | undefined;
        const error = toError(cause, '올바르지 않은 Tool 응답입니다.');
        appendLog('tool.error', error.message, {
          stepId: call.stepId,
          callId: call.id,
          toolName: call.toolName,
          data: output,
        });
        presentInput('error', error.message, metadata?.value);
        publish();
        return;
      }
    }

    if (toolResponse?.status === 'rejected') {
      const metadata = call.metadata as StepCallMetadata<Context> | undefined;
      const error = new Error(toolResponse.error.message);
      state.error = error;
      appendLog('tool.error', `${call.toolName} 실행에 실패했습니다.`, {
        stepId: call.stepId,
        callId: call.id,
        toolName: call.toolName,
        data: toolResponse,
      });
      appendLog(
        'agent.message',
        '도구 실행 오류를 표시하고 다시 입력받습니다.',
      );
      presentInput('error', error.message, metadata?.value);
      publish();
      return;
    }

    appendLog('tool.result', `${call.toolName} 결과를 받았습니다.`, {
      stepId: call.stepId,
      callId: call.id,
      toolName: call.toolName,
      data: output,
    });

    if (call.kind === 'screen') {
      const response = parseGuidedConsultingRendererResponse(output);
      if (response.status === 'rejected') {
        state.error = new Error(response.error.message);
        setPhase('error');
      }
      publish();
      return;
    }

    if (call.kind === 'validation') {
      const value = (output as { value: string }).value;
      const step = definition.steps.find(
        (candidate) => candidate.id === call.stepId,
      );
      if (!step) return;

      state.answers = { ...state.answers, [step.id]: value };
      appendLog(
        'agent.message',
        `검증된 입력을 ${step.tool.id} 도구에 전달합니다.`,
        { data: { value, context: state.context } },
      );

      let request;
      try {
        request = createGuidedConsultingToolRequest(
          step.tool.id,
          step.tool.createInput({ value, context: state.context }),
        );
      } catch (cause) {
        const error = toError(
          cause,
          `${step.tool.id} 입력 생성에 실패했습니다.`,
        );
        appendLog('tool.error', `${step.tool.id} 요청 생성에 실패했습니다.`, {
          stepId: step.id,
          toolName: step.tool.id,
          data: { message: error.message },
        });
        presentInput('error', error.message, value);
        publish();
        return;
      }

      presentInput('running', null, value);
      issueToolCall('step', step.tool.id, step.id, request, {
        value,
        context: state.context,
      } satisfies StepCallMetadata<Context>);
      publish();
      return;
    }

    const step = definition.steps.find(
      (candidate) => candidate.id === call.stepId,
    );
    if (!step) return;
    const metadata = call.metadata as StepCallMetadata<Context> | undefined;
    if (!metadata || !toolResponse || toolResponse.status !== 'completed') {
      const error = new Error('Tool Result를 Step에 반영할 정보가 없습니다.');
      appendLog('tool.error', error.message, {
        stepId: call.stepId,
        callId: call.id,
        toolName: call.toolName,
        data: output,
      });
      presentInput('error', error.message, metadata?.value);
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
      appendLog('tool.error', error.message, {
        stepId: call.stepId,
        callId: call.id,
        toolName: call.toolName,
        data: output,
      });
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
      appendLog('tool.error', 'Tool Result의 다음 Step이 올바르지 않습니다.', {
        stepId: call.stepId,
        callId: call.id,
        toolName: call.toolName,
        data: { message: error.message, result },
      });
      appendLog(
        'agent.message',
        '다음 단계로 이동하지 못해 현재 입력 화면을 다시 표시합니다.',
      );
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
      appendLog(
        'agent.message',
        '모든 단계가 끝났습니다. 완료 화면을 표시합니다.',
      );
      presentComplete();
    } else {
      appendLog(
        'agent.message',
        '도구 결과를 context에 반영하고 다음 설명 화면을 표시합니다.',
        { data: { context: nextContext } },
      );
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

    appendLog('tool.error', `${call.toolName} 실행에 실패했습니다.`, {
      stepId: call.stepId,
      callId: call.id,
      toolName: call.toolName,
      data: { message: error.message },
    });

    if (call.kind === 'screen') {
      state.error = error;
      setPhase('error');
      appendLog('agent.message', '화면 렌더러가 요청을 처리하지 못했습니다.');
      publish();
      return;
    }

    const value =
      call.kind === 'validation'
        ? (call.input as ValidationCallInput).rawValue
        : (call.metadata as StepCallMetadata<Context> | undefined)?.value;
    appendLog(
      'agent.message',
      call.kind === 'validation'
        ? '입력 수정을 요청하는 화면을 표시합니다.'
        : '도구 실행 오류를 표시하고 다시 입력받습니다.',
    );
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
