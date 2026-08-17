'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import type {
  ConsultingDefinition,
  ConsultingNext,
  ConsultingPresentation,
  ConsultingResources,
  ConsultingResourceState,
  ConsultingSystemAction,
  ConsultingTurn,
  ConsultingTurnPhase,
  ConsultingUpdate,
  ConsultingView,
} from '@/features/consulting/runner/types';

type InternalResourceState<Data> = ConsultingResourceState<Data> & {
  requestId: number;
};

type InternalResources<Resources extends object> = {
  [Key in keyof Resources]: InternalResourceState<Resources[Key]>;
};

type HistoryEntry<Context extends object, Memory extends object> = {
  systemTurnId: string;
  context: Context;
  memory: Memory;
};

type RunnerState<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
> = {
  turnId: string;
  precedingSystemTurnId: string;
  context: Context;
  memory: Memory;
  view: ConsultingView<Screen>;
  resources: InternalResources<Resources>;
  history: Array<HistoryEntry<Context, Memory>>;
  visitId: number;
  systemActionIndex: number;
  pendingPresentation: ConsultingPresentation | null;
  systemActionRunning: boolean;
  userSubmissionRunning: boolean;
  error: Error | null;
  isComplete: boolean;
};

type RunnerAction<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
> =
  | {
      type: 'presentation-started';
      visitId: number;
      actionIndex: number;
      view: ConsultingView<Screen>;
      waitFor: ConsultingPresentation;
    }
  | {
      type: 'presentation-completed';
      visitId: number;
      actionIndex: number;
      presentation: ConsultingPresentation;
    }
  | { type: 'system-action-started'; visitId: number; actionIndex: number }
  | {
      type: 'system-action-succeeded';
      visitId: number;
      actionIndex: number;
      update?: ConsultingUpdate<Context, Memory>;
    }
  | {
      type: 'resource-started';
      visitId: number;
      actionIndex: number;
      resource: keyof Resources;
      requestId: number;
    }
  | {
      type: 'resource-succeeded';
      resource: keyof Resources;
      requestId: number;
      data: Resources[keyof Resources];
    }
  | {
      type: 'resource-failed';
      resource: keyof Resources;
      requestId: number;
      error: Error;
    }
  | {
      type: 'resource-cancelled';
      visitId: number;
      actionIndex: number;
      resource: keyof Resources;
    }
  | { type: 'user-submit-started'; visitId: number }
  | {
      type: 'transition';
      visitId: number;
      target: string;
      targetActor: 'system' | 'user';
      context: Context;
      memory: Memory;
      checkpoint: boolean;
    }
  | {
      type: 'complete';
      visitId: number;
      context: Context;
      memory: Memory;
    }
  | { type: 'failed'; visitId: number; error: Error }
  | { type: 'back' }
  | { type: 'retry-system' };

function applyUpdate<Context extends object, Memory extends object>(
  context: Context,
  memory: Memory,
  update?: ConsultingUpdate<Context, Memory> | void,
) {
  return {
    context: update?.context ? { ...context, ...update.context } : context,
    memory: update?.memory ? { ...memory, ...update.memory } : memory,
  };
}

function runnerReducer<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
>(
  state: RunnerState<Context, Memory, Screen, Resources>,
  action: RunnerAction<Context, Memory, Screen, Resources>,
): RunnerState<Context, Memory, Screen, Resources> {
  if ('visitId' in action && action.visitId !== state.visitId) return state;

  switch (action.type) {
    case 'presentation-started':
      return {
        ...state,
        view: action.view,
        pendingPresentation:
          action.waitFor === 'immediate' ? null : action.waitFor,
        systemActionIndex:
          action.waitFor === 'immediate'
            ? state.systemActionIndex + 1
            : state.systemActionIndex,
      };
    case 'presentation-completed':
      if (
        state.systemActionIndex !== action.actionIndex ||
        state.pendingPresentation !== action.presentation
      ) {
        return state;
      }

      return {
        ...state,
        pendingPresentation: null,
        systemActionIndex: state.systemActionIndex + 1,
      };
    case 'system-action-started':
      if (state.systemActionIndex !== action.actionIndex) return state;
      return { ...state, systemActionRunning: true, error: null };
    case 'system-action-succeeded': {
      if (state.systemActionIndex !== action.actionIndex) return state;
      const updated = applyUpdate(state.context, state.memory, action.update);
      return {
        ...state,
        ...updated,
        systemActionIndex: state.systemActionIndex + 1,
        systemActionRunning: false,
        error: null,
      };
    }
    case 'resource-started': {
      if (state.systemActionIndex !== action.actionIndex) return state;
      const previous = state.resources[action.resource];
      return {
        ...state,
        resources: {
          ...state.resources,
          [action.resource]: {
            status: 'loading',
            data: previous?.data ?? null,
            error: null,
            requestId: action.requestId,
          },
        },
        systemActionIndex: state.systemActionIndex + 1,
      };
    }
    case 'resource-succeeded': {
      const previous = state.resources[action.resource];
      if (!previous || previous.requestId !== action.requestId) return state;

      return {
        ...state,
        resources: {
          ...state.resources,
          [action.resource]: {
            status: 'success',
            data: action.data,
            error: null,
            requestId: action.requestId,
          },
        },
      };
    }
    case 'resource-failed': {
      const previous = state.resources[action.resource];
      if (!previous || previous.requestId !== action.requestId) return state;

      return {
        ...state,
        resources: {
          ...state.resources,
          [action.resource]: {
            ...previous,
            status: 'error',
            error: action.error,
          },
        },
      };
    }
    case 'resource-cancelled': {
      if (state.systemActionIndex !== action.actionIndex) return state;
      const previous = state.resources[action.resource];
      return {
        ...state,
        resources: {
          ...state.resources,
          [action.resource]: {
            status: 'idle',
            data: previous?.data ?? null,
            error: null,
            requestId: (previous?.requestId ?? 0) + 1,
          },
        },
        systemActionIndex: state.systemActionIndex + 1,
      };
    }
    case 'user-submit-started':
      return { ...state, userSubmissionRunning: true, error: null };
    case 'transition':
      return {
        ...state,
        turnId: action.target,
        precedingSystemTurnId:
          action.targetActor === 'user'
            ? state.turnId
            : state.precedingSystemTurnId,
        context: action.context,
        memory: action.memory,
        history: action.checkpoint
          ? [
              ...state.history,
              {
                systemTurnId: state.precedingSystemTurnId,
                context: state.context,
                memory: state.memory,
              },
            ]
          : state.history,
        visitId: state.visitId + 1,
        systemActionIndex: 0,
        pendingPresentation: null,
        systemActionRunning: false,
        userSubmissionRunning: false,
        error: null,
        isComplete: false,
      };
    case 'complete':
      return {
        ...state,
        context: action.context,
        memory: action.memory,
        systemActionRunning: false,
        userSubmissionRunning: false,
        error: null,
        isComplete: true,
      };
    case 'failed':
      return {
        ...state,
        systemActionRunning: false,
        userSubmissionRunning: false,
        error: action.error,
      };
    case 'back': {
      const previous = state.history.at(-1);
      if (!previous) return state;

      return {
        ...state,
        turnId: previous.systemTurnId,
        precedingSystemTurnId: previous.systemTurnId,
        context: previous.context,
        memory: previous.memory,
        history: state.history.slice(0, -1),
        visitId: state.visitId + 1,
        systemActionIndex: 0,
        pendingPresentation: null,
        systemActionRunning: false,
        userSubmissionRunning: false,
        error: null,
        isComplete: false,
      };
    }
    case 'retry-system':
      return {
        ...state,
        visitId: state.visitId + 1,
        systemActionIndex: 0,
        pendingPresentation: null,
        systemActionRunning: false,
        error: null,
      };
  }
}

function createInitialResources<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
  UserInput,
>(
  definition: ConsultingDefinition<
    Context,
    Memory,
    Screen,
    Resources,
    UserInput
  >,
) {
  const resources: Record<string, InternalResourceState<unknown>> = {};

  for (const turn of definition.turns) {
    if (turn.actor !== 'system') continue;

    for (const action of turn.sequence) {
      if (
        action.type !== 'resource.start' &&
        action.type !== 'resource.await' &&
        action.type !== 'resource.cancel'
      ) {
        continue;
      }
      resources[action.resource] ??= {
        status: 'idle',
        data: null,
        error: null,
        requestId: 0,
      };
    }
  }

  return resources as InternalResources<Resources>;
}

function resolveNext<
  Context extends object,
  Memory extends object,
  Resources extends object,
  UserInput,
>(
  next: ConsultingNext<Context, Memory, Resources, UserInput> | undefined,
  context: Context,
  memory: Memory,
  resources: ConsultingResources<Resources>,
  input: UserInput,
) {
  return typeof next === 'function'
    ? next({ context, memory, resources, input })
    : (next ?? null);
}

function toError(error: unknown, fallback: string) {
  return error instanceof Error ? error : new Error(fallback);
}

export function useConsultingRunner<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
  UserInput,
>(
  definition: ConsultingDefinition<
    Context,
    Memory,
    Screen,
    Resources,
    UserInput
  >,
) {
  type Turn = ConsultingTurn<Context, Memory, Screen, Resources, UserInput>;
  type SystemAction = ConsultingSystemAction<
    Context,
    Memory,
    Screen,
    Resources
  >;

  const turnsById = useMemo(
    () => new Map(definition.turns.map((turn) => [turn.id, turn])),
    [definition.turns],
  );
  const [state, dispatch] = useReducer(
    runnerReducer<Context, Memory, Screen, Resources>,
    {
      turnId: definition.initialSystemTurnId,
      precedingSystemTurnId: definition.initialSystemTurnId,
      context: definition.initialContext,
      memory: definition.initialMemory,
      view: definition.initialView,
      resources: createInitialResources(definition),
      history: [],
      visitId: 0,
      systemActionIndex: 0,
      pendingPresentation: null,
      systemActionRunning: false,
      userSubmissionRunning: false,
      error: null,
      isComplete: false,
    },
  );
  const executedActionRef = useRef<string | null>(null);
  const transitionedSystemRef = useRef<number | null>(null);
  const userSubmissionRef = useRef<number | null>(null);
  const resourceRequestIdRef = useRef(0);
  const resourceControllersRef = useRef(
    new Map<keyof Resources, AbortController>(),
  );

  const currentTurn = turnsById.get(state.turnId) as Turn | undefined;
  if (!currentTurn) {
    throw new Error(`정의되지 않은 컨설팅 턴입니다: ${state.turnId}`);
  }

  const resources = state.resources as ConsultingResources<Resources>;
  const phase: ConsultingTurnPhase = state.error
    ? 'error'
    : currentTurn.actor === 'user'
      ? state.userSubmissionRunning
        ? 'submitting'
        : 'waiting-for-user'
      : state.pendingPresentation
        ? 'presenting'
        : 'running';

  const failForInvalidTransition = useCallback(
    (source: Turn, targetId: string, expectedActor: Turn['actor']) => {
      const target = turnsById.get(targetId) as Turn | undefined;
      if (!target) {
        dispatch({
          type: 'failed',
          visitId: state.visitId,
          error: new Error(`${targetId} 턴이 정의되지 않았습니다.`),
        });
        return null;
      }

      if (target.actor !== expectedActor) {
        dispatch({
          type: 'failed',
          visitId: state.visitId,
          error: new Error(
            `${source.id} 다음에는 ${expectedActor} 턴이 와야 합니다.`,
          ),
        });
        return null;
      }

      return target;
    },
    [state.visitId, turnsById],
  );

  const resolveView = useCallback(
    (
      action: Extract<SystemAction, { type: 'present' }>,
    ): ConsultingView<Screen> => {
      const update =
        typeof action.view === 'function'
          ? action.view({
              context: state.context,
              memory: state.memory,
              resources,
              phase,
              view: state.view,
            })
          : action.view;

      return { ...state.view, ...update };
    },
    [phase, resources, state.context, state.memory, state.view],
  );

  useEffect(() => {
    const controllers = resourceControllersRef.current;

    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (
      currentTurn.actor !== 'system' ||
      state.isComplete ||
      state.error ||
      state.pendingPresentation ||
      state.systemActionRunning
    ) {
      return;
    }

    const action = currentTurn.sequence[state.systemActionIndex] as
      SystemAction | undefined;
    if (!action) return;

    const executionKey = `${state.visitId}:${state.systemActionIndex}`;

    if (action.type === 'resource.await') {
      const resource = resources[action.resource];
      if (
        !resource ||
        resource.status === 'idle' ||
        resource.status === 'loading'
      ) {
        return;
      }
      if (resource.status === 'error') {
        dispatch({
          type: 'failed',
          visitId: state.visitId,
          error: resource.error ?? new Error('리소스 작업에 실패했습니다.'),
        });
        return;
      }
    }

    if (executedActionRef.current === executionKey) return;
    executedActionRef.current = executionKey;

    if (action.type === 'present') {
      dispatch({
        type: 'presentation-started',
        visitId: state.visitId,
        actionIndex: state.systemActionIndex,
        view: resolveView(action),
        waitFor: action.waitFor,
      });
      return;
    }

    if (action.type === 'resource.start') {
      const resource = action.resource;
      resourceControllersRef.current.get(resource)?.abort();

      const controller = new AbortController();
      const requestId = ++resourceRequestIdRef.current;
      resourceControllersRef.current.set(resource, controller);
      dispatch({
        type: 'resource-started',
        visitId: state.visitId,
        actionIndex: state.systemActionIndex,
        resource,
        requestId,
      });

      void Promise.resolve(
        action.run({
          context: state.context,
          memory: state.memory,
          resources,
          signal: controller.signal,
        }),
      )
        .then((data) => {
          if (controller.signal.aborted) return;
          dispatch({
            type: 'resource-succeeded',
            resource,
            requestId,
            data,
          });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          dispatch({
            type: 'resource-failed',
            resource,
            requestId,
            error: toError(error, '리소스 작업에 실패했습니다.'),
          });
        });
      return;
    }

    if (action.type === 'resource.cancel') {
      resourceControllersRef.current.get(action.resource)?.abort();
      resourceControllersRef.current.delete(action.resource);
      dispatch({
        type: 'resource-cancelled',
        visitId: state.visitId,
        actionIndex: state.systemActionIndex,
        resource: action.resource,
      });
      return;
    }

    const visitId = state.visitId;
    const actionIndex = state.systemActionIndex;
    const controller = new AbortController();
    dispatch({ type: 'system-action-started', visitId, actionIndex });

    const operation =
      action.type === 'run'
        ? action.run({
            context: state.context,
            memory: state.memory,
            resources,
            signal: controller.signal,
          })
        : action.apply?.(resources[action.resource].data!, {
            context: state.context,
            memory: state.memory,
            resources,
          });

    void Promise.resolve(operation)
      .then((update) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: 'system-action-succeeded',
          visitId,
          actionIndex,
          update: update || undefined,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: 'failed',
          visitId,
          error: toError(error, '시스템 작업에 실패했습니다.'),
        });
      });
  }, [
    currentTurn,
    resolveView,
    resources,
    state.context,
    state.error,
    state.isComplete,
    state.memory,
    state.pendingPresentation,
    state.systemActionIndex,
    state.systemActionRunning,
    state.visitId,
  ]);

  useEffect(() => {
    if (
      currentTurn.actor !== 'system' ||
      state.isComplete ||
      state.error ||
      state.systemActionIndex < currentTurn.sequence.length ||
      transitionedSystemRef.current === state.visitId
    ) {
      return;
    }

    transitionedSystemRef.current = state.visitId;
    if (!currentTurn.next) {
      dispatch({
        type: 'complete',
        visitId: state.visitId,
        context: state.context,
        memory: state.memory,
      });
      return;
    }

    const target = failForInvalidTransition(
      currentTurn,
      currentTurn.next,
      'user',
    );
    if (!target) return;

    dispatch({
      type: 'transition',
      visitId: state.visitId,
      target: target.id,
      targetActor: target.actor,
      context: state.context,
      memory: state.memory,
      checkpoint: false,
    });
  }, [
    currentTurn,
    failForInvalidTransition,
    state.context,
    state.error,
    state.isComplete,
    state.memory,
    state.systemActionIndex,
    state.visitId,
  ]);

  const completePresentation = useCallback(
    (presentation: Exclude<ConsultingPresentation, 'immediate'>) => {
      dispatch({
        type: 'presentation-completed',
        visitId: state.visitId,
        actionIndex: state.systemActionIndex,
        presentation,
      });
    },
    [state.systemActionIndex, state.visitId],
  );

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

  const canSubmitUser =
    currentTurn.actor === 'user' &&
    !state.userSubmissionRunning &&
    !state.error &&
    !state.isComplete;

  const submitUserTurn = useCallback(
    (input: UserInput) => {
      if (currentTurn.actor !== 'user' || !canSubmitUser) return;
      if (userSubmissionRef.current === state.visitId) return;

      const visitId = state.visitId;
      userSubmissionRef.current = visitId;
      dispatch({ type: 'user-submit-started', visitId });

      void Promise.resolve(
        currentTurn.submit(input, {
          context: state.context,
          memory: state.memory,
          resources,
        }),
      )
        .then((update) => {
          const updated = applyUpdate(state.context, state.memory, update);
          const targetId = resolveNext(
            currentTurn.next,
            updated.context,
            updated.memory,
            resources,
            input,
          );

          userSubmissionRef.current = null;
          if (!targetId) {
            dispatch({
              type: 'complete',
              visitId,
              context: updated.context,
              memory: updated.memory,
            });
            return;
          }

          const target = failForInvalidTransition(
            currentTurn,
            targetId,
            'system',
          );
          if (!target) return;

          dispatch({
            type: 'transition',
            visitId,
            target: target.id,
            targetActor: target.actor,
            context: updated.context,
            memory: updated.memory,
            checkpoint: currentTurn.checkpoint ?? true,
          });
        })
        .catch((error: unknown) => {
          userSubmissionRef.current = null;
          dispatch({
            type: 'failed',
            visitId,
            error: toError(error, '사용자 입력 처리에 실패했습니다.'),
          });
        });
    },
    [
      canSubmitUser,
      currentTurn,
      failForInvalidTransition,
      resources,
      state.context,
      state.memory,
      state.visitId,
    ],
  );

  const goBack = useCallback(() => dispatch({ type: 'back' }), []);
  const retryCurrentTurn = useCallback(
    () => dispatch({ type: 'retry-system' }),
    [],
  );

  return {
    currentTurn,
    currentTurnId: state.turnId,
    phase,
    view: state.view,
    context: state.context,
    memory: state.memory,
    resources,
    error: state.error,
    isComplete: state.isComplete,
    canSubmitUser,
    canGoBack: state.history.length > 0,
    completePrompterPresentation,
    completeLayoutPresentation,
    completeScreenPresentation,
    submitUserTurn,
    goBack,
    retryCurrentTurn,
  };
}
