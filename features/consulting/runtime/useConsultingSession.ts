'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import type { ConsultingDefinition } from '@/features/consulting/core/consulting';
import { createConsultingEngine } from '@/features/consulting/core/engine';
import type {
  ConsultingEvent,
  ConsultingSession,
} from '@/features/consulting/core/process';

const pendingDisposals = new WeakMap<object, ReturnType<typeof setTimeout>>();

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
  const engine = useMemo(
    () => createConsultingEngine(consulting),
    [consulting],
  );

  useEffect(() => {
    const pendingDisposal = pendingDisposals.get(engine);
    if (pendingDisposal) {
      clearTimeout(pendingDisposal);
      pendingDisposals.delete(engine);
    }

    engine.start();

    return () => {
      const disposal = setTimeout(() => {
        engine.dispose();
        pendingDisposals.delete(engine);
      }, 0);
      pendingDisposals.set(engine, disposal);
    };
  }, [engine]);

  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  );
  const completePrompterPresentation = useCallback(
    () => engine.completePresentation('prompter'),
    [engine],
  );
  const completeLayoutPresentation = useCallback(
    () => engine.completePresentation('layout'),
    [engine],
  );
  const completeScreenPresentation = useCallback(
    () => engine.completePresentation('screen'),
    [engine],
  );

  return {
    ...snapshot,
    completePrompterPresentation,
    completeLayoutPresentation,
    completeScreenPresentation,
    send: engine.send,
    goBack: engine.goBack,
    retryCurrentNode: engine.retryCurrentNode,
  };
}
