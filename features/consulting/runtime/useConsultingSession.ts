'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import type { ConsultingDefinition } from '@/features/consulting/core/consulting';
import type {
  ConsultingEdge,
  ConsultingEvent,
  ConsultingProcessPhase,
  ConsultingSequenceAction,
  ConsultingSession,
  ConsultingUpdate,
  PresentationWaitFor,
} from '@/features/consulting/core/process';
import type {
  ConsultingTaskState,
  ConsultingTaskStates,
} from '@/features/consulting/core/task';

type InternalTaskState<Output> = ConsultingTaskState<Output> & {
  requestId: number;
};

type InternalTaskStates<TaskOutputs extends object> = {
  [Key in keyof TaskOutputs]: InternalTaskState<TaskOutputs[Key]>;
};

type ProcessState<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
> = {
  nodeId: string;
  memory: Memory;
  view: View;
  tasks: InternalTaskStates<TaskOutputs>;
  history: Array<string>;
  visitId: number;
  sequenceIndex: number;
  pendingPresentation: PresentationWaitFor | null;
  presentationKeys: {
    prompter: number;
    layout: number;
    screen: number;
  };
  actionRunning: boolean;
  transitionRunning: boolean;
  error: Error | null;
  complete: boolean;
};

type ProcessAction<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
> =
  | {
      type: 'presentation-started';
      visitId: number;
      actionIndex: number;
      view: View;
      waitFor: PresentationWaitFor;
    }
  | {
      type: 'presentation-completed';
      visitId: number;
      actionIndex: number;
      presentation: PresentationWaitFor;
    }
  | { type: 'event-received'; visitId: number; actionIndex: number }
  | { type: 'action-started'; visitId: number; actionIndex: number }
  | {
      type: 'action-completed';
      visitId: number;
      actionIndex: number;
      update?: ConsultingUpdate<Memory, View>;
    }
  | {
      type: 'task-started';
      visitId: number;
      actionIndex: number;
      task: keyof TaskOutputs;
      requestId: number;
    }
  | {
      type: 'task-reused';
      visitId: number;
      actionIndex: number;
    }
  | {
      type: 'task-succeeded';
      task: keyof TaskOutputs;
      requestId: number;
      data: TaskOutputs[keyof TaskOutputs];
    }
  | {
      type: 'task-failed';
      task: keyof TaskOutputs;
      requestId: number;
      error: Error;
    }
  | { type: 'transition-started'; visitId: number }
  | {
      type: 'node-entered';
      visitId: number;
      nodeId: string;
      memory: Memory;
      history: Array<string>;
    }
  | { type: 'completed'; visitId: number; memory: Memory }
  | { type: 'failed'; visitId: number; error: Error }
  | { type: 'back' }
  | { type: 'retry' };

function applyUpdate<Memory extends object, View extends object>(
  memory: Memory,
  view: View,
  update?: ConsultingUpdate<Memory, View> | void,
) {
  return {
    memory: update?.memory ? { ...memory, ...update.memory } : memory,
    view: update?.view ? { ...view, ...update.view } : view,
  };
}

function processReducer<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
>(
  state: ProcessState<Memory, View, TaskOutputs>,
  action: ProcessAction<Memory, View, TaskOutputs>,
): ProcessState<Memory, View, TaskOutputs> {
  if ('visitId' in action && action.visitId !== state.visitId) return state;

  switch (action.type) {
    case 'presentation-started':
      return {
        ...state,
        view: action.view,
        presentationKeys:
          action.waitFor === 'immediate'
            ? state.presentationKeys
            : {
                ...state.presentationKeys,
                [action.waitFor]: state.presentationKeys[action.waitFor] + 1,
              },
        pendingPresentation:
          action.waitFor === 'immediate' ? null : action.waitFor,
        sequenceIndex:
          action.waitFor === 'immediate'
            ? state.sequenceIndex + 1
            : state.sequenceIndex,
      };
    case 'presentation-completed':
      if (
        state.sequenceIndex !== action.actionIndex ||
        state.pendingPresentation !== action.presentation
      ) {
        return state;
      }
      return {
        ...state,
        sequenceIndex: state.sequenceIndex + 1,
        pendingPresentation: null,
      };
    case 'event-received':
      if (state.sequenceIndex !== action.actionIndex) return state;
      return { ...state, sequenceIndex: state.sequenceIndex + 1 };
    case 'action-started':
      if (state.sequenceIndex !== action.actionIndex) return state;
      return { ...state, actionRunning: true, error: null };
    case 'action-completed': {
      if (state.sequenceIndex !== action.actionIndex) return state;
      const updated = applyUpdate(state.memory, state.view, action.update);
      return {
        ...state,
        ...updated,
        sequenceIndex: state.sequenceIndex + 1,
        actionRunning: false,
        error: null,
      };
    }
    case 'task-started': {
      if (state.sequenceIndex !== action.actionIndex) return state;
      const previous = state.tasks[action.task];
      return {
        ...state,
        tasks: {
          ...state.tasks,
          [action.task]: {
            status: 'running',
            data: previous?.data ?? null,
            error: null,
            requestId: action.requestId,
          },
        },
        sequenceIndex: state.sequenceIndex + 1,
      };
    }
    case 'task-reused':
      if (state.sequenceIndex !== action.actionIndex) return state;
      return { ...state, sequenceIndex: state.sequenceIndex + 1 };
    case 'task-succeeded': {
      const previous = state.tasks[action.task];
      if (!previous || previous.requestId !== action.requestId) return state;
      return {
        ...state,
        tasks: {
          ...state.tasks,
          [action.task]: {
            status: 'success',
            data: action.data,
            error: null,
            requestId: action.requestId,
          },
        },
      };
    }
    case 'task-failed': {
      const previous = state.tasks[action.task];
      if (!previous || previous.requestId !== action.requestId) return state;
      return {
        ...state,
        tasks: {
          ...state.tasks,
          [action.task]: {
            ...previous,
            status: 'error',
            error: action.error,
          },
        },
      };
    }
    case 'transition-started':
      return { ...state, transitionRunning: true, error: null };
    case 'node-entered':
      return {
        ...state,
        nodeId: action.nodeId,
        memory: action.memory,
        history: action.history,
        visitId: state.visitId + 1,
        sequenceIndex: 0,
        pendingPresentation: null,
        actionRunning: false,
        transitionRunning: false,
        error: null,
        complete: false,
      };
    case 'completed':
      return {
        ...state,
        memory: action.memory,
        transitionRunning: false,
        error: null,
        complete: true,
      };
    case 'failed':
      return {
        ...state,
        actionRunning: false,
        transitionRunning: false,
        error: action.error,
      };
    case 'back': {
      const previousNodeId = state.history.at(-1);
      if (!previousNodeId) return state;
      return {
        ...state,
        nodeId: previousNodeId,
        history: state.history.slice(0, -1),
        visitId: state.visitId + 1,
        sequenceIndex: 0,
        pendingPresentation: null,
        actionRunning: false,
        transitionRunning: false,
        error: null,
        complete: false,
      };
    }
    case 'retry':
      return {
        ...state,
        visitId: state.visitId + 1,
        sequenceIndex: 0,
        pendingPresentation: null,
        actionRunning: false,
        transitionRunning: false,
        error: null,
        complete: false,
      };
  }
}

function createInitialTaskStates<TaskOutputs extends object>(
  taskKeys: Array<keyof TaskOutputs>,
) {
  return Object.fromEntries(
    taskKeys.map((task) => [
      task,
      {
        status: 'idle',
        data: null,
        error: null,
        requestId: 0,
      },
    ]),
  ) as InternalTaskStates<TaskOutputs>;
}

function toError(error: unknown, fallback: string) {
  return error instanceof Error ? error : new Error(fallback);
}

export function useConsultingSession<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
  Interaction,
>(
  consulting: ConsultingDefinition<
    Memory,
    View,
    TaskOutputs,
    Event,
    Interaction
  >,
): ConsultingSession<Memory, View, TaskOutputs, Event, Interaction> {
  type SequenceAction = ConsultingSequenceAction<
    Memory,
    View,
    TaskOutputs,
    Event
  >;
  type Edge = ConsultingEdge<Memory, View, TaskOutputs, Event>;
  const {
    memory: memoryDefinition,
    process,
    tasks: taskDefinitions,
  } = consulting;

  const [state, dispatch] = useReducer(
    processReducer<Memory, View, TaskOutputs>,
    consulting,
    () => ({
      nodeId: process.initialNodeId,
      memory: memoryDefinition.createInitial(),
      view: process.initialView,
      tasks: createInitialTaskStates(
        Object.keys(taskDefinitions) as Array<keyof TaskOutputs>,
      ),
      history: [],
      visitId: 0,
      sequenceIndex: 0,
      pendingPresentation: null,
      presentationKeys: {
        prompter: 0,
        layout: 0,
        screen: 0,
      },
      actionRunning: false,
      transitionRunning: false,
      error: null,
      complete: false,
    }),
  );
  const executedActionRef = useRef<string | null>(null);
  const submittedEdgeRef = useRef<number | null>(null);
  const taskRequestIdRef = useRef(0);
  const taskControllersRef = useRef(
    new Map<keyof TaskOutputs, AbortController>(),
  );

  const currentNode = process.nodes[state.nodeId];
  if (!currentNode) {
    throw new Error(`정의되지 않은 컨설팅 노드입니다: ${state.nodeId}`);
  }

  const sequence = useMemo(
    () => currentNode.sequence ?? [],
    [currentNode.sequence],
  );
  const tasks = state.tasks as ConsultingTaskStates<TaskOutputs>;
  const activeSequenceAction = sequence[state.sequenceIndex] as
    SequenceAction | undefined;
  const isWaitingForEvent = activeSequenceAction?.type === 'event.await';
  const sequenceComplete =
    state.sequenceIndex >= sequence.length &&
    !state.pendingPresentation &&
    !state.actionRunning;
  const phase: ConsultingProcessPhase = state.error
    ? 'error'
    : state.complete || (currentNode.terminal && sequenceComplete)
      ? 'complete'
      : state.transitionRunning
        ? 'transitioning'
        : isWaitingForEvent || sequenceComplete
          ? 'waiting-for-user'
          : 'presenting';

  useEffect(() => {
    const controllers = taskControllersRef.current;
    return () => {
      for (const controller of controllers.values()) controller.abort();
    };
  }, []);

  useEffect(() => {
    if (
      phase === 'complete' ||
      phase === 'error' ||
      phase === 'transitioning' ||
      state.pendingPresentation ||
      state.actionRunning
    ) {
      return;
    }

    const action = activeSequenceAction;
    if (!action) return;
    if (action.type === 'event.await') return;

    const executionKey = `${state.visitId}:${state.sequenceIndex}`;

    if (action.type === 'task.await') {
      const task = tasks[action.task];
      if (!task || task.status === 'idle' || task.status === 'running') return;
      if (task.status === 'error') {
        dispatch({
          type: 'failed',
          visitId: state.visitId,
          error:
            task.error ?? new Error(`${action.task} 태스크에 실패했습니다.`),
        });
        return;
      }
    }

    if (executedActionRef.current === executionKey) return;
    executedActionRef.current = executionKey;

    if (action.type === 'present') {
      const viewUpdate =
        typeof action.view === 'function'
          ? action.view({
              memory: state.memory,
              view: state.view,
              tasks,
              phase,
            })
          : action.view;
      const view = { ...state.view, ...viewUpdate };
      const layoutUnchanged =
        action.waitFor === 'layout' &&
        Object.entries(viewUpdate).every(([key, value]) =>
          Object.is(state.view[key as keyof View], value),
        );
      dispatch({
        type: 'presentation-started',
        visitId: state.visitId,
        actionIndex: state.sequenceIndex,
        view,
        waitFor: layoutUnchanged ? 'immediate' : action.waitFor,
      });
      return;
    }

    if (action.type === 'task.start') {
      const previous = tasks[action.task];
      if (
        action.policy === 'reuse' &&
        (previous.status === 'running' || previous.status === 'success')
      ) {
        dispatch({
          type: 'task-reused',
          visitId: state.visitId,
          actionIndex: state.sequenceIndex,
        });
        return;
      }

      const task = action.task;
      taskControllersRef.current.get(task)?.abort();
      const controller = new AbortController();
      const requestId = ++taskRequestIdRef.current;
      taskControllersRef.current.set(task, controller);
      dispatch({
        type: 'task-started',
        visitId: state.visitId,
        actionIndex: state.sequenceIndex,
        task,
        requestId,
      });

      void Promise.resolve(
        taskDefinitions[task]({
          memory: state.memory,
          view: state.view,
          tasks,
          signal: controller.signal,
        }),
      )
        .then((data) => {
          if (controller.signal.aborted) return;
          dispatch({ type: 'task-succeeded', task, requestId, data });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          dispatch({
            type: 'task-failed',
            task,
            requestId,
            error: toError(error, `${task} 태스크에 실패했습니다.`),
          });
        });
      return;
    }

    const task = tasks[action.task];
    const visitId = state.visitId;
    const actionIndex = state.sequenceIndex;
    dispatch({ type: 'action-started', visitId, actionIndex });

    void Promise.resolve(
      action.apply?.(task.data!, {
        memory: state.memory,
        view: state.view,
        tasks,
      }),
    )
      .then((update) => {
        dispatch({
          type: 'action-completed',
          visitId,
          actionIndex,
          update: update || undefined,
        });
      })
      .catch((error: unknown) => {
        dispatch({
          type: 'failed',
          visitId,
          error: toError(error, `${action.task} 응답 반영에 실패했습니다.`),
        });
      });
  }, [
    activeSequenceAction,
    taskDefinitions,
    phase,
    sequence,
    state.actionRunning,
    state.memory,
    state.pendingPresentation,
    state.sequenceIndex,
    state.view,
    state.visitId,
    tasks,
  ]);

  const completePresentation = useCallback(
    (presentation: Exclude<PresentationWaitFor, 'immediate'>) => {
      dispatch({
        type: 'presentation-completed',
        visitId: state.visitId,
        actionIndex: state.sequenceIndex,
        presentation,
      });
    },
    [state.sequenceIndex, state.visitId],
  );

  const send = useCallback(
    (event: Event) => {
      if (phase !== 'waiting-for-user') return;

      if (activeSequenceAction?.type === 'event.await') {
        if (activeSequenceAction.event !== event.type) return;

        dispatch({
          type: 'event-received',
          visitId: state.visitId,
          actionIndex: state.sequenceIndex,
        });
        return;
      }

      if (submittedEdgeRef.current === state.visitId) return;

      const edge = currentNode.edges[event.type as Event['type']] as
        Edge | undefined;
      if (!edge) return;

      const visitId = state.visitId;
      submittedEdgeRef.current = visitId;
      dispatch({ type: 'transition-started', visitId });

      const edgeDefinition =
        typeof edge === 'string'
          ? { target: edge, history: 'push' as const }
          : edge;
      const runtime = {
        memory: state.memory,
        view: state.view,
        tasks,
        event,
      };

      void Promise.resolve(edgeDefinition.updateMemory?.(runtime))
        .then((memoryUpdate) => {
          const memory = memoryUpdate
            ? { ...state.memory, ...memoryUpdate }
            : state.memory;
          const target =
            typeof edgeDefinition.target === 'function'
              ? edgeDefinition.target({ ...runtime, memory })
              : edgeDefinition.target;

          submittedEdgeRef.current = null;
          if (target === null) {
            dispatch({ type: 'completed', visitId, memory });
            return;
          }
          if (!target || !process.nodes[target]) {
            dispatch({
              type: 'failed',
              visitId,
              error: new Error(`${String(target)} 노드가 정의되지 않았습니다.`),
            });
            return;
          }

          const historyMode = edgeDefinition.history ?? 'push';
          const history =
            historyMode === 'none'
              ? state.history
              : historyMode === 'replace'
                ? [...state.history.slice(0, -1), state.nodeId]
                : [...state.history, state.nodeId];
          dispatch({
            type: 'node-entered',
            visitId,
            nodeId: target,
            memory,
            history,
          });
        })
        .catch((error: unknown) => {
          submittedEdgeRef.current = null;
          dispatch({
            type: 'failed',
            visitId,
            error: toError(error, '사용자 입력 처리에 실패했습니다.'),
          });
        });
    },
    [
      activeSequenceAction,
      currentNode.edges,
      process.nodes,
      phase,
      state.history,
      state.memory,
      state.nodeId,
      state.sequenceIndex,
      state.view,
      state.visitId,
      tasks,
    ],
  );

  const goBack = useCallback(() => dispatch({ type: 'back' }), []);
  const retryCurrentNode = useCallback(() => dispatch({ type: 'retry' }), []);
  const completePrompterPresentation = useCallback(
    () => completePresentation('prompter'),
    [completePresentation],
  );
  const completeLayoutPresentation = useCallback(
    () => completePresentation('layout'),
    [completePresentation],
  );
  const completeScreenPresentation = useCallback(
    () => completePresentation('screen'),
    [completePresentation],
  );

  return {
    nodeId: state.nodeId,
    interaction: currentNode.interaction,
    phase,
    isWaitingForUser: phase === 'waiting-for-user',
    view: state.view,
    memory: state.memory,
    tasks,
    presentationKeys: state.presentationKeys,
    error: state.error,
    isComplete: phase === 'complete',
    canGoBack:
      state.history.length > 0 &&
      (phase === 'waiting-for-user' || phase === 'complete'),
    completePrompterPresentation,
    completeLayoutPresentation,
    completeScreenPresentation,
    send,
    goBack,
    retryCurrentNode,
  };
}
