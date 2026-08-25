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

function getModuleEndpoint(moduleId: string) {
  return moduleId === 'screen.render' ? 'renderer' : 'tools';
}

export function createGuidedConsultingLogger(
  options: GuidedConsultingLoggerOptions = {},
): GuidedConsultingLogger {
  const maxEntries = options.maxEntries ?? 200;
  const entries: Array<GuidedConsultingLog> = [];
  let entryId = 0;

  const append = (entry: Omit<GuidedConsultingLog, 'id'>) => {
    entries.push({ id: ++entryId, ...entry });
    if (entries.length > maxEntries) {
      entries.splice(0, entries.length - maxEntries);
    }
  };

  return {
    record: (event) => {
      if (event.type === 'session.started') {
        append({
          kind: 'agent.input',
          text: 'system -> agent',
          nodeId: event.nodeId,
          data: {
            type: event.type,
            definitionId: event.definitionId,
          },
        });
        return;
      }

      if (event.type === 'user.action.received') {
        append({
          kind: 'agent.input',
          text: 'user -> agent',
          nodeId: event.nodeId,
          data: event.action,
        });
        return;
      }

      const endpoint = getModuleEndpoint(event.call.toolName);
      const common = {
        nodeId: event.call.nodeId,
        callId: event.call.id,
        moduleId: event.call.toolName,
      };

      if (event.type === 'module.request.sent') {
        append({
          ...common,
          kind: 'module.request',
          text: `agent -> ${endpoint}`,
          data: event.call.input,
        });
        return;
      }

      if (event.type === 'module.response.received') {
        append({
          ...common,
          kind: 'module.response',
          text: `${endpoint} -> agent`,
          data: event.output,
        });
        return;
      }

      append({
        ...common,
        kind: 'module.error',
        text: `${endpoint} -> agent`,
        data: { name: event.error.name, message: event.error.message },
      });
    },
    getSnapshot: () => [...entries],
    clear: () => {
      entries.splice(0, entries.length);
    },
  };
}
