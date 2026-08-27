'use client';

import {
  createContext,
  type ReactNode,
  useContext,
  useSyncExternalStore,
} from 'react';

import type { ConsultingToolRuntime } from '@/features/consulting/core/tools';

const ConsultingToolRuntimeContext =
  createContext<ConsultingToolRuntime | null>(null);

export function ConsultingToolRuntimeProvider({
  runtime,
  children,
}: {
  runtime: ConsultingToolRuntime;
  children: ReactNode;
}) {
  return (
    <ConsultingToolRuntimeContext.Provider value={runtime}>
      {children}
    </ConsultingToolRuntimeContext.Provider>
  );
}

export function useConsultingToolRuntime() {
  const runtime = useContext(ConsultingToolRuntimeContext);
  if (!runtime) {
    throw new Error(
      'useConsultingToolRuntime은 ConsultingToolRuntimeProvider 안에서 사용해야 합니다.',
    );
  }
  return runtime;
}

export function useConsultingToolRuntimeSnapshot() {
  const runtime = useConsultingToolRuntime();
  return useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
}
