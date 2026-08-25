import type { ConsultingToolError } from '@/features/consulting/core/tools/protocol';
import type { ConsultingUserAction } from '@/features/consulting/core/user/protocol';

export type ConsultingMemory<Context extends object> = {
  context: Readonly<Context>;
  actions: Readonly<Record<string, ConsultingUserAction>>;
  toolResults: Readonly<Record<string, unknown>>;
  toolErrors: Readonly<Record<string, ConsultingToolError>>;
  lastAction: ConsultingUserAction | null;
  lastToolResult: unknown;
  lastToolError: ConsultingToolError | null;
};

export type ConsultingMemoryStore<Context extends object> = {
  read: () => ConsultingMemory<Context>;
  recordUserAction: (nodeId: string, action: ConsultingUserAction) => void;
  recordToolResult: (nodeId: string, result: unknown) => void;
  recordToolError: (nodeId: string, error: ConsultingToolError) => void;
  setContext: (context: Context) => void;
};

export function createConsultingMemory<Context extends object>(
  initialContext: Context,
): ConsultingMemoryStore<Context> {
  let memory: ConsultingMemory<Context> = {
    context: initialContext,
    actions: {},
    toolResults: {},
    toolErrors: {},
    lastAction: null,
    lastToolResult: undefined,
    lastToolError: null,
  };

  return {
    read: () => memory,
    recordUserAction: (nodeId, action) => {
      memory = {
        ...memory,
        actions: { ...memory.actions, [nodeId]: action },
        lastAction: action,
      };
    },
    recordToolResult: (nodeId, result) => {
      memory = {
        ...memory,
        toolResults: { ...memory.toolResults, [nodeId]: result },
        lastToolResult: result,
        lastToolError: null,
      };
    },
    recordToolError: (nodeId, error) => {
      memory = {
        ...memory,
        toolErrors: { ...memory.toolErrors, [nodeId]: error },
        lastToolError: error,
      };
    },
    setContext: (context) => {
      memory = { ...memory, context };
    },
  };
}
