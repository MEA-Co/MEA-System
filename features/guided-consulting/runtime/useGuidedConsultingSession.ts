'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { createGuidedConsultingEngine } from '@/features/guided-consulting/core/engine';
import type { GuidedConsultingDefinition } from '@/features/guided-consulting/core/types';

const pendingDisposals = new WeakMap<object, ReturnType<typeof setTimeout>>();

export function useGuidedConsultingSession<
  Context extends object,
  Tools extends object,
>(definition: GuidedConsultingDefinition<Context, Tools>, tools: Tools) {
  const engine = useMemo(
    () => createGuidedConsultingEngine(definition, tools),
    [definition, tools],
  );

  useEffect(() => {
    const pendingDisposal = pendingDisposals.get(engine);
    if (pendingDisposal) {
      clearTimeout(pendingDisposal);
      pendingDisposals.delete(engine);
    }

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

  return {
    ...snapshot,
    submit: engine.submit,
    back: engine.back,
    retry: engine.retry,
    reset: engine.reset,
  };
}
