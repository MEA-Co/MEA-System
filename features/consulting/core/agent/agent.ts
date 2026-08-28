import type { ConsultingAgentEventListener } from '@/features/consulting/core/agent/events';
import {
  type ConsultingMemory,
  type ConsultingMemoryStore,
  createConsultingMemory,
} from '@/features/consulting/core/agent/memory';
import type {
  ConsultingAgent,
  ConsultingAgentSnapshot,
  ConsultingModuleCall,
  ConsultingModuleCallKind,
  ConsultingPhase,
  ConsultingScreen,
} from '@/features/consulting/core/agent/types';
import type {
  ConsultingPlan,
  ConsultingPlanNode,
  ConsultingPlanTransitionTarget,
  ConsultingValueResolver,
} from '@/features/consulting/core/plan';
import {
  createConsultingRendererRequest,
  parseConsultingRendererResponse,
} from '@/features/consulting/core/renderer';
import type {
  ConsultingToolError,
  ConsultingToolRuntime,
} from '@/features/consulting/core/tools';
import {
  createConsultingToolRequest,
  parseConsultingToolRequest,
  parseConsultingToolResponse,
} from '@/features/consulting/core/tools';
import type { ConsultingUserAction } from '@/features/consulting/core/user';

export type ConsultingAgentOptions = {
  onEvent?: ConsultingAgentEventListener;
};

type AgentState<Context extends object> = {
  sessionId: number;
  phase: ConsultingPhase;
  currentNodeId: string;
  memory: ConsultingMemoryStore<Context>;
  error: Error | null;
  screen: ConsultingScreen | null;
  pendingModuleCalls: Array<ConsultingModuleCall>;
};

function toError(error: unknown, fallback: string) {
  return error instanceof Error ? error : new Error(fallback);
}

function toToolError(error: unknown, fallback: string): ConsultingToolError {
  return {
    code: 'EXECUTION_FAILED',
    message: toError(error, fallback).message,
  };
}

export function createConsultingAgent<
  Context extends object,
  Tools extends object,
>(
  plan: ConsultingPlan<Context, Tools>,
  toolRuntime: ConsultingToolRuntime,
  options: ConsultingAgentOptions = {},
): ConsultingAgent<Context, Tools> {
  const listeners = new Set<() => void>();
  const latestResultCallIds = new Map<string, string>();
  const emitEvent: ConsultingAgentEventListener =
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
      currentNodeId: plan.entry,
      memory: createConsultingMemory(plan.createInitialContext()),
      error: null,
      screen: null,
      pendingModuleCalls: [],
    };
  }

  const readMemory = () => state.memory.read();

  const resolveValue = <Value>(
    resolver: ConsultingValueResolver<Context, Value>,
  ): Value =>
    typeof resolver === 'function'
      ? (resolver as (memory: ConsultingMemory<Context>) => Value)(readMemory())
      : resolver;

  const getNode = (nodeId: string) => {
    const node = plan.nodes[nodeId];
    if (!node) throw new Error(`Plan Node를 찾을 수 없습니다: ${nodeId}`);
    return node;
  };

  const resolveTransitionTarget = (
    target: ConsultingPlanTransitionTarget<Context>,
    action: ConsultingUserAction,
  ) =>
    typeof target === 'function'
      ? target({ action, memory: readMemory() })
      : target;

  const issueModuleCall = (
    kind: ConsultingModuleCallKind,
    toolName: string,
    nodeId: string,
    input: unknown,
    options: Pick<ConsultingModuleCall, 'runOptions' | 'resultKey'> = {},
  ) => {
    const call: ConsultingModuleCall = {
      id: `call-${++callId}`,
      kind,
      toolName,
      nodeId,
      input,
      ...options,
    };
    state.pendingModuleCalls.push(call);
    if (call.resultKey) {
      latestResultCallIds.set(call.resultKey, call.id);
    }
    emitEvent({ type: 'module.request.sent', call });
    return call;
  };

  const presentScreen = (
    nodeId: string,
    target: ConsultingScreen['renderTarget'],
    options: {
      availableActions?: ConsultingScreen['availableActions'];
      progress?: ConsultingScreen['progress'];
      draftKey?: string;
      terminal?: boolean;
    } = {},
  ) => {
    state.screen = {
      id: `screen-${++screenId}`,
      nodeId,
      title: plan.title,
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
      createConsultingRendererRequest(target),
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
    let node: ConsultingPlanNode<Context, Tools>;
    try {
      node = getNode(nodeId);
      state.currentNodeId = nodeId;

      state.phase = node.terminal ? 'complete' : 'waiting-for-user';
      presentScreen(node.id, resolveValue(node.screen), {
        availableActions: [
          ...new Set([
            ...Object.keys(node.on ?? {}),
            ...Object.keys(node.effects ?? {}),
          ]),
        ] as Array<ConsultingUserAction['type']>,
        progress: node.progress,
        draftKey: node.draftKey,
        terminal: node.terminal,
      });
    } catch (cause) {
      failPlan(cause, `Plan Node 실행에 실패했습니다: ${nodeId}`);
    }
  };

  const createSnapshot = (): ConsultingAgentSnapshot<Context, Tools> => {
    return {
      planId: plan.id,
      sessionId: state.sessionId,
      title: plan.title,
      phase: state.phase,
      currentNodeId: state.currentNodeId,
      node: getNode(state.currentNodeId),
      error: state.error,
      isComplete: state.phase === 'complete',
      screen: state.screen,
      pendingModuleCalls: [...state.pendingModuleCalls],
    };
  };

  emitEvent({
    type: 'session.started',
    planId: plan.id,
    nodeId: plan.entry,
  });
  enterNode(plan.entry);

  let snapshot = createSnapshot();

  const publish = () => {
    snapshot = createSnapshot();
    for (const listener of listeners) listener();
  };

  const send = (input: ConsultingUserAction) => {
    if (disposed) return;
    emitEvent({
      type: 'user.action.received',
      action: input,
      nodeId: state.currentNodeId,
    });

    if (input.type === 'user.reset') {
      toolRuntime.reset();
      latestResultCallIds.clear();
      state.pendingModuleCalls = [];
      state = createInitialState();
      enterNode(plan.entry);
      publish();
      return;
    }

    const node = getNode(state.currentNodeId);
    const transition = node.on?.[input.type];
    const effectResolver = node.effects?.[input.type];
    if (!transition && !effectResolver) {
      publish();
      return;
    }

    try {
      const memoryBeforeAction = readMemory();
      if (
        transition &&
        typeof transition === 'object' &&
        !transition.guard({ action: input, memory: memoryBeforeAction })
      ) {
        publish();
        return;
      }

      if (transition) {
        state.memory.recordUserAction(node.id, input);
        state.error = null;
      }

      const effects = effectResolver?.({
        action: input,
        memory: readMemory(),
      });
      for (const effect of effects ?? []) {
        if (effect.resultKey) {
          state.memory.clearToolOutcome(effect.resultKey);
        }
        issueModuleCall(
          'tool',
          effect.toolId,
          node.id,
          createConsultingToolRequest(effect.toolId, effect.input),
          {
            runOptions: {
              key: effect.key,
              groupId: effect.groupId,
              policy: effect.policy,
              label: effect.label,
            },
            resultKey: effect.resultKey,
          },
        );
      }

      if (transition) {
        const target =
          typeof transition === 'object' ? transition.target : transition;
        const nextNodeId = resolveTransitionTarget(target, input);
        enterNode(nextNodeId);
      }
    } catch (cause) {
      failPlan(cause, `사용자 Action 처리에 실패했습니다: ${input.type}`);
    }
    publish();
  };

  const executeToolCall = async (callIdToExecute: string) => {
    const call = state.pendingModuleCalls.find(
      (candidate) => candidate.id === callIdToExecute,
    );
    if (!call) {
      throw new Error(`Tool Call을 찾을 수 없습니다: ${callIdToExecute}`);
    }
    if (call.kind === 'screen') {
      throw new Error('screen.render는 Renderer Runtime에서 실행해야 합니다.');
    }

    return toolRuntime.run(parseConsultingToolRequest(call.input), {
      key: call.runOptions?.key ?? `agent:${state.sessionId}:${call.id}`,
      groupId: call.runOptions?.groupId,
      policy: call.runOptions?.policy ?? 'reuse',
      label: call.runOptions?.label,
    }).result;
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
        const response = parseConsultingRendererResponse(output);
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

    try {
      const response = parseConsultingToolResponse(output);
      if (
        call.resultKey &&
        latestResultCallIds.get(call.resultKey) === call.id
      ) {
        if (response.status === 'completed') {
          state.memory.recordToolResult(call.resultKey, response.output);
        } else {
          state.memory.recordToolError(call.resultKey, response.error);
        }
      }
    } catch (cause) {
      if (
        call.resultKey &&
        latestResultCallIds.get(call.resultKey) === call.id
      ) {
        state.memory.recordToolError(
          call.resultKey,
          toToolError(cause, `${call.toolName} 결과 처리에 실패했습니다.`),
        );
      }
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

    if (call.resultKey && latestResultCallIds.get(call.resultKey) === call.id) {
      state.memory.recordToolError(
        call.resultKey,
        toToolError(error, `${call.toolName} 실행에 실패했습니다.`),
      );
    }
    publish();
  };

  return {
    getSnapshot: () => snapshot,
    getMemory: readMemory,
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
      toolRuntime.dispose();
      latestResultCallIds.clear();
      state.pendingModuleCalls = [];
      listeners.clear();
    },
  };
}
