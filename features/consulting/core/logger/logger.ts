import type {
  ConsultingLog,
  ConsultingLogger,
  ConsultingLoggerOptions,
} from '@/features/consulting/core/logger/types';

function getModuleEndpoint(moduleId: string) {
  return moduleId === 'screen.render' ? 'renderer' : 'tools';
}

export function createConsultingLogger(
  options: ConsultingLoggerOptions = {},
): ConsultingLogger {
  const maxEntries = options.maxEntries ?? 200;
  const entries: Array<ConsultingLog> = [];
  let entryId = 0;

  const append = (entry: Omit<ConsultingLog, 'id'>) => {
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
            planId: event.planId,
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
