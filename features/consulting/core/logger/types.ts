import type { ConsultingAgentEvent } from '@/features/consulting/core/agent/events';

export type ConsultingLogKind =
  'agent.input' | 'module.request' | 'module.response' | 'module.error';

export type ConsultingLog = {
  id: number;
  kind: ConsultingLogKind;
  text: string;
  nodeId: string;
  callId?: string;
  moduleId?: string;
  data?: unknown;
};

export type ConsultingLogger = {
  record: (event: ConsultingAgentEvent) => void;
  getSnapshot: () => ReadonlyArray<ConsultingLog>;
  clear: () => void;
};

export type ConsultingLoggerOptions = {
  maxEntries?: number;
};
