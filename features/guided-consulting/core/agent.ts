import type { GuidedConsultingAgentEventListener } from '@/features/guided-consulting/core/events';
import type {
  GuidedConsultingToolError,
  GuidedConsultingUserAction,
} from '@/features/guided-consulting/core/protocol';
import {
  createGuidedConsultingToolRequest,
  parseGuidedConsultingToolRequest,
  parseGuidedConsultingToolResponse,
} from '@/features/guided-consulting/core/protocol';
import {
  createGuidedConsultingRendererRequest,
  parseGuidedConsultingRendererResponse,
} from '@/features/guided-consulting/core/renderer/protocol';
import type { GuidedConsultingToolsRuntime } from '@/features/guided-consulting/core/tools';
import type {
  GuidedConsultingAgent,
  GuidedConsultingAgentSnapshot,
  GuidedConsultingDefinition,
  GuidedConsultingMemory,
  GuidedConsultingModuleCall,
  GuidedConsultingModuleCallKind,
  GuidedConsultingPhase,
  GuidedConsultingPlanNode,
  GuidedConsultingScreen,
  GuidedConsultingToolNode,
  GuidedConsultingValueResolver,
} from '@/features/guided-consulting/core/types';

export type GuidedConsultingAgentOptions = {
  onEvent?: GuidedConsultingAgentEventListener;
};

type AgentState<Context extends object> = {
  sessionId: number;
  phase: GuidedConsultingPhase;
  currentNodeId: string;
  context: Context;
  actions: Record<string, GuidedConsultingUserAction>;
  toolResults: Record<string, unknown>;
  toolErrors: Record<string, GuidedConsultingToolError>;
  lastAction: GuidedConsultingUserAction | null;
  lastToolResult: unknown;
  lastToolError: GuidedConsultingToolError | null;
  error: Error | null;
  screen: GuidedConsultingScreen | null;
  pendingModuleCalls: Array<GuidedConsultingModuleCall>;
};

function toError(error: unknown, fallback: string) {
  return error instanceof Error ? error : new Error(fallback);
}

function toToolError(
  error: unknown,
  fallback: string,
): GuidedConsultingToolError {
  return {
    code: 'EXECUTION_FAILED',
    message: toError(error, fallback).message,
  };
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
  let sessionId = 0;
  let disposed = false;
  let state: AgentState<Context> = createInitialState();

  function createInitialState(): AgentState<Context> {
    return {
      sessionId: ++sessionId,
      phase: 'waiting-for-user',
      currentNodeId: definition.entry,
      context: definition.createInitialContext(),
      actions: {},
      toolResults: {},
      toolErrors: {},
      lastAction: null,
      lastToolResult: undefined,
      lastToolError: null,
      error: null,
      screen: null,
      pendingModuleCalls: [],
    };
  }

  const createMemory = (): GuidedConsultingMemory<Context> => ({
    context: state.context,
    actions: state.actions,
    toolResults: state.toolResults,
    toolErrors: state.toolErrors,
    lastAction: state.lastAction,
    lastToolResult: state.lastToolResult,
    lastToolError: state.lastToolError,
  });

  const resolveValue = <Value>(
    resolver: GuidedConsultingValueResolver<Context, Value>,
  ): Value =>
    typeof resolver === 'function'
      ? (resolver as (memory: GuidedConsultingMemory<Context>) => Value)(
          createMemory(),
        )
      : resolver;

  const getNode = (nodeId: string) => {
    const node = definition.nodes[nodeId];
    if (!node) throw new Error(`Plan Node를 찾을 수 없습니다: ${nodeId}`);
    return node;
  };

  const issueModuleCall = (
    kind: GuidedConsultingModuleCallKind,
    toolName: string,
    nodeId: string,
    input: unknown,
  ) => {
    const call: GuidedConsultingModuleCall = {
      id: `call-${++callId}`,
      kind,
      toolName,
      nodeId,
      input,
    };
    state.pendingModuleCalls.push(call);
    emitEvent({ type: 'module.request.sent', call });
    return call;
  };

  const presentScreen = (
    nodeId: string,
    target: GuidedConsultingScreen['renderTarget'],
    options: {
      availableActions?: GuidedConsultingScreen['availableActions'];
      progress?: GuidedConsultingScreen['progress'];
      draftKey?: string;
      terminal?: boolean;
    } = {},
  ) => {
    state.screen = {
      id: `screen-${++screenId}`,
      nodeId,
      title: definition.title,
      renderTarget: target,
      availableActions: options.availableActions ?? [],
      progress: options.progress,
      draftKey: options.draftKey,
      terminal: options.terminal ?? false,
    };
    issueModuleCall(
      'screen',
      'screen.render',
      nodeId,
      createGuidedConsultingRendererRequest(target),
    );
  };

  const failPlan = (cause: unknown, fallback: string) => {
    state.error = toError(cause, fallback);
    state.phase = 'error';
    if (state.screen) {
      state.screen = { ...state.screen, availableActions: [] };
    }
  };

  const enterNode = (nodeId: string) => {
    let node: GuidedConsultingPlanNode<Context, Tools>;
    try {
      node = getNode(nodeId);
      state.currentNodeId = nodeId;

      if (node.type === 'screen') {
        state.phase = node.terminal ? 'complete' : 'waiting-for-user';
        presentScreen(node.id, resolveValue(node.screen), {
          availableActions: Object.keys(node.on ?? {}) as Array<
            GuidedConsultingUserAction['type']
          >,
          progress: node.progress,
          draftKey: node.draftKey,
          terminal: node.terminal,
        });
        return;
      }

      state.phase = 'running-tools';
      if (node.pendingScreen) {
        presentScreen(node.id, resolveValue(node.pendingScreen), {
          progress: node.progress,
        });
      } else if (state.screen) {
        state.screen = { ...state.screen, availableActions: [] };
      }

      const request = createGuidedConsultingToolRequest(
        node.toolId,
        node.input(createMemory()),
      );
      issueModuleCall('tool', node.toolId, node.id, request);
    } catch (cause) {
      failPlan(cause, `Plan Node 실행에 실패했습니다: ${nodeId}`);
    }
  };

  const createSnapshot = (): GuidedConsultingAgentSnapshot<Context, Tools> => ({
    definitionId: definition.id,
    sessionId: state.sessionId,
    title: definition.title,
    phase: state.phase,
    currentNodeId: state.currentNodeId,
    node: getNode(state.currentNodeId),
    context: state.context,
    actions: state.actions,
    toolResults: state.toolResults,
    toolErrors: state.toolErrors,
    error: state.error,
    isComplete: state.phase === 'complete',
    screen: state.screen,
    pendingModuleCalls: [...state.pendingModuleCalls],
  });

  emitEvent({
    type: 'session.started',
    definitionId: definition.id,
    nodeId: definition.entry,
  });
  enterNode(definition.entry);

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
      nodeId: state.currentNodeId,
    });

    if (input.type === 'user.reset') {
      state.pendingModuleCalls = [];
      state = createInitialState();
      enterNode(definition.entry);
      publish();
      return;
    }

    const node = getNode(state.currentNodeId);
    if (node.type !== 'screen') {
      publish();
      return;
    }

    const transition = node.on?.[input.type];
    if (!transition) {
      publish();
      return;
    }

    state.actions = { ...state.actions, [node.id]: input };
    state.lastAction = input;
    state.error = null;

    try {
      const nextNodeId =
        typeof transition === 'function'
          ? transition({ action: input, memory: createMemory() })
          : transition;
      enterNode(nextNodeId);
    } catch (cause) {
      failPlan(cause, `사용자 Action 처리에 실패했습니다: ${input.type}`);
    }
    publish();
  };

  const executeToolCall = async (
    callIdToExecute: string,
    signal: AbortSignal,
  ) => {
    const call = state.pendingModuleCalls.find(
      (candidate) => candidate.id === callIdToExecute,
    );
    if (!call) {
      throw new Error(`Tool Call을 찾을 수 없습니다: ${callIdToExecute}`);
    }
    if (call.kind === 'screen') {
      throw new Error('screen.render는 Renderer Runtime에서 실행해야 합니다.');
    }

    return tools.execute(parseGuidedConsultingToolRequest(call.input), {
      signal,
    });
  };

  const moveToRejectedNode = (
    node: GuidedConsultingToolNode<Context, Tools>,
    error: GuidedConsultingToolError,
  ) => {
    state.toolErrors = { ...state.toolErrors, [node.id]: error };
    state.lastToolError = error;
    state.error = new Error(error.message);
    enterNode(node.onRejected);
  };

  const resolveModuleCall = (resolvedCallId: string, output: unknown) => {
    if (disposed) return;
    const callIndex = state.pendingModuleCalls.findIndex(
      (candidate) => candidate.id === resolvedCallId,
    );
    if (callIndex < 0) return;
    const [call] = state.pendingModuleCalls.splice(callIndex, 1);
    emitEvent({ type: 'module.response.received', call, output });

    if (call.kind === 'screen') {
      try {
        const response = parseGuidedConsultingRendererResponse(output);
        if (
          response.status === 'rejected' &&
          state.screen?.nodeId === call.nodeId
        ) {
          state.error = new Error(response.error.message);
          state.phase = 'error';
        }
      } catch (cause) {
        failPlan(cause, '올바르지 않은 Renderer 응답입니다.');
      }
      publish();
      return;
    }

    const node = getNode(call.nodeId);
    if (node.type !== 'tool') {
      failPlan(
        null,
        `Tool Call의 Plan Node가 올바르지 않습니다: ${call.nodeId}`,
      );
      publish();
      return;
    }

    try {
      const response = parseGuidedConsultingToolResponse(output);
      if (response.status === 'rejected') {
        moveToRejectedNode(node, response.error);
        publish();
        return;
      }

      state.toolResults = {
        ...state.toolResults,
        [node.id]: response.output,
      };
      state.lastToolResult = response.output;
      state.lastToolError = null;
      state.error = null;

      const reduceParams = {
        context: state.context,
        output: response.output,
        memory: createMemory(),
      };
      if (node.reduce) {
        state.context = node.reduce(reduceParams);
      }

      const nextParams = {
        context: state.context,
        output: response.output,
        memory: createMemory(),
      };
      const nextNodeId =
        typeof node.next === 'function' ? node.next(nextParams) : node.next;
      enterNode(nextNodeId);
    } catch (cause) {
      moveToRejectedNode(
        node,
        toToolError(cause, `${node.toolId} 결과 처리에 실패했습니다.`),
      );
    }
    publish();
  };

  const rejectModuleCall = (rejectedCallId: string, cause: unknown) => {
    if (disposed) return;
    const callIndex = state.pendingModuleCalls.findIndex(
      (candidate) => candidate.id === rejectedCallId,
    );
    if (callIndex < 0) return;
    const [call] = state.pendingModuleCalls.splice(callIndex, 1);
    const error = toError(cause, `${call.toolName} 실행에 실패했습니다.`);
    emitEvent({ type: 'module.error.received', call, error });

    if (call.kind === 'screen') {
      if (state.screen?.nodeId === call.nodeId) {
        state.error = error;
        state.phase = 'error';
      }
      publish();
      return;
    }

    const node = getNode(call.nodeId);
    if (node.type === 'tool') {
      moveToRejectedNode(
        node,
        toToolError(error, `${call.toolName} 실행에 실패했습니다.`),
      );
    } else {
      failPlan(error, `${call.toolName} 실행에 실패했습니다.`);
    }
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
    resolveModuleCall,
    rejectModuleCall,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      state.pendingModuleCalls = [];
      listeners.clear();
    },
  };
}
