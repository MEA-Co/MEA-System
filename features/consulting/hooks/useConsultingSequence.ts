'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ConsultingAction,
  ConsultingContextUpdate,
  ConsultingDefinition,
  ConsultingMemoryUpdate,
  ConsultingView,
  ExternalActionExecutor,
  PrompterWait,
} from '@/features/consulting/sequence/types';
import type { ConsultingTurn } from '@/features/consulting/types';

type UseConsultingSequenceOptions<
  Context extends object,
  Operation extends string,
  Memory extends object,
> = {
  executeExternalAction?: ExternalActionExecutor<Context, Operation, Memory>;
};

function resolveValue<Value, Context, Memory extends object>(
  value:
    Value | ((context: Readonly<Context>, memory: Readonly<Memory>) => Value),
  context: Context,
  memory: Memory,
) {
  return typeof value === 'function'
    ? (
        value as (context: Readonly<Context>, memory: Readonly<Memory>) => Value
      )(context, memory)
    : value;
}

function applyContextUpdate<Context extends object>(
  context: Context,
  update: ConsultingContextUpdate<Context>,
) {
  return typeof update === 'function'
    ? update(context)
    : { ...context, ...update };
}

function applyMemoryUpdate<Context extends object, Memory extends object>(
  memory: Memory,
  context: Context,
  update: ConsultingMemoryUpdate<Context, Memory>,
) {
  const resolvedUpdate =
    typeof update === 'function' ? update(context, memory) : update;

  return { ...memory, ...resolvedUpdate };
}

function getActionWait<
  Context extends object,
  Screen extends string,
  Memory extends object,
>(action: ConsultingAction<Context, Screen, string, Memory>) {
  if (action.type === 'prompter') return action.waitFor ?? 'none';
  if (action.type === 'screen') return action.waitFor ?? 'none';
  if (action.type === 'memory') return 'memory';
  return 'external';
}

export function useConsultingSequence<
  Context extends object,
  Screen extends string,
  Operation extends string,
  Memory extends object,
>(
  definition: ConsultingDefinition<Context, Screen, Operation, Memory>,
  options: UseConsultingSequenceOptions<Context, Operation, Memory> = {},
) {
  const [actionIndex, setActionIndex] = useState(0);
  const [context, setContext] = useState<Context>(definition.initialContext);
  const [memory, setMemory] = useState<Memory>(definition.initialMemory);
  const [externalError, setExternalError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const actionIndexRef = useRef(actionIndex);
  const sequenceRef = useRef(definition.sequence);
  const externalExecutionRef = useRef<number | null>(null);
  const memoryExecutionRef = useRef<number | null>(null);

  const currentAction = definition.sequence[actionIndex] ?? null;
  const isComplete = actionIndex >= definition.sequence.length;

  const view = useMemo(() => {
    const nextView: ConsultingView<Screen> = {
      message: '',
      prompterPlacement: 'bottom',
      prompterSize: 'wide',
      screen: null,
    };
    const visibleActionCount = Math.min(
      actionIndex + 1,
      definition.sequence.length,
    );

    for (let index = 0; index < visibleActionCount; index += 1) {
      const action = definition.sequence[index];

      if (action.type === 'prompter') {
        if (action.message !== undefined) {
          nextView.message = resolveValue(action.message, context, memory);
        }
        if (action.placement !== undefined) {
          nextView.prompterPlacement = action.placement;
        }
        if (action.size !== undefined) {
          nextView.prompterSize = action.size;
        }
      }

      if (action.type === 'screen') {
        nextView.screen = resolveValue(action.screen, context, memory);
      }
    }

    return nextView;
  }, [actionIndex, context, definition.sequence, memory]);

  const advanceAtIndex = useCallback(
    (expectedIndex: number, update?: ConsultingContextUpdate<Context>) => {
      if (actionIndexRef.current !== expectedIndex) return;

      actionIndexRef.current = expectedIndex + 1;
      if (update) {
        setContext((current) => applyContextUpdate(current, update));
      }
      setActionIndex(expectedIndex + 1);
    },
    [],
  );

  const completeWaitingAction = useCallback(
    (
      expectedWait: PrompterWait | 'user' | 'animation',
      update?: ConsultingContextUpdate<Context>,
    ) => {
      const index = actionIndexRef.current;
      const action = sequenceRef.current[index];
      if (!action || getActionWait(action) !== expectedWait) return;

      advanceAtIndex(index, update);
    },
    [advanceAtIndex],
  );

  const continueSequence = useCallback(
    () => completeWaitingAction('continue'),
    [completeWaitingAction],
  );
  const completePrompterTyping = useCallback(
    () => completeWaitingAction('typing'),
    [completeWaitingAction],
  );
  const completePrompterLayout = useCallback(
    () => completeWaitingAction('layout'),
    [completeWaitingAction],
  );
  const completeScreen = useCallback(
    (update?: ConsultingContextUpdate<Context>) =>
      completeWaitingAction('user', update),
    [completeWaitingAction],
  );
  const completeScreenAnimation = useCallback(
    () => completeWaitingAction('animation'),
    [completeWaitingAction],
  );

  useEffect(() => {
    if (!currentAction || getActionWait(currentAction) !== 'none') return;

    const automaticAdvance = window.setTimeout(
      () => advanceAtIndex(actionIndex),
      0,
    );
    return () => window.clearTimeout(automaticAdvance);
  }, [actionIndex, advanceAtIndex, currentAction]);

  useEffect(() => {
    if (currentAction?.type !== 'memory') return;
    if (memoryExecutionRef.current === actionIndex) return;

    memoryExecutionRef.current = actionIndex;

    setMemory((current) =>
      applyMemoryUpdate(current, context, currentAction.update),
    );
    advanceAtIndex(actionIndex);
  }, [actionIndex, advanceAtIndex, context, currentAction]);

  useEffect(() => {
    if (currentAction?.type !== 'external' || externalError) return;
    if (externalExecutionRef.current === actionIndex) return;

    externalExecutionRef.current = actionIndex;
    const executor = options.executeExternalAction;

    if (!executor) {
      const missingExecutorTimer = window.setTimeout(
        () =>
          setExternalError(
            new Error(
              `외부 작업 실행기가 없습니다: ${currentAction.operation}`,
            ),
          ),
        0,
      );
      return () => window.clearTimeout(missingExecutorTimer);
    }

    void executor(currentAction.operation, context, memory)
      .then((update) => {
        if (update) {
          advanceAtIndex(actionIndex, update);
          return;
        }
        advanceAtIndex(actionIndex);
      })
      .catch((error: unknown) => {
        externalExecutionRef.current = null;
        setExternalError(
          error instanceof Error
            ? error
            : new Error('외부 작업에 실패했습니다.'),
        );
      });
  }, [
    actionIndex,
    advanceAtIndex,
    context,
    currentAction,
    externalError,
    memory,
    options.executeExternalAction,
    retryCount,
  ]);

  const retryExternalAction = useCallback(() => {
    externalExecutionRef.current = null;
    setExternalError(null);
    setRetryCount((count) => count + 1);
  }, []);

  const turn: ConsultingTurn =
    currentAction?.type === 'screen' &&
    (currentAction.waitFor ?? 'none') === 'user'
      ? 'user'
      : 'service';

  return {
    context,
    memory,
    currentAction,
    currentActionIndex: actionIndex,
    externalError,
    isComplete,
    isExecutingExternalAction: currentAction?.type === 'external',
    isWritingMemory: currentAction?.type === 'memory',
    turn,
    view,
    completePrompterLayout,
    completePrompterTyping,
    completeScreen,
    completeScreenAnimation,
    continueSequence,
    retryExternalAction,
  };
}
