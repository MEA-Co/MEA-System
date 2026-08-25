import type { GuidedConsultingAgentEvent } from '@/features/guided-consulting/core/events';

export type GuidedConsultingLogKind =
  'agent.input' | 'module.request' | 'module.response' | 'module.error';

export type GuidedConsultingLog = {
  id: number;
  kind: GuidedConsultingLogKind;
  text: string;
  nodeId: string;
  callId?: string;
  moduleId?: string;
  data?: unknown;
};

export type GuidedConsultingLogger = {
  record: (event: GuidedConsultingAgentEvent) => void;
  getSnapshot: () => ReadonlyArray<GuidedConsultingLog>;
  clear: () => void;
};

export type GuidedConsultingLoggerOptions = {
  maxEntries?: number;
};
