import type { GuidedConsultingToolError } from '@/features/guided-consulting/core/tools/protocol';
import type { GuidedConsultingUserAction } from '@/features/guided-consulting/core/user/protocol';

export type GuidedConsultingMemory<Context extends object> = {
  context: Readonly<Context>;
  actions: Readonly<Record<string, GuidedConsultingUserAction>>;
  toolResults: Readonly<Record<string, unknown>>;
  toolErrors: Readonly<Record<string, GuidedConsultingToolError>>;
  lastAction: GuidedConsultingUserAction | null;
  lastToolResult: unknown;
  lastToolError: GuidedConsultingToolError | null;
};

export type GuidedConsultingMemoryStore<Context extends object> = {
  read: () => GuidedConsultingMemory<Context>;
  recordUserAction: (
    nodeId: string,
    action: GuidedConsultingUserAction,
  ) => void;
  recordToolResult: (nodeId: string, result: unknown) => void;
  recordToolError: (nodeId: string, error: GuidedConsultingToolError) => void;
  setContext: (context: Context) => void;
};

export function createGuidedConsultingMemory<Context extends object>(
  initialContext: Context,
): GuidedConsultingMemoryStore<Context> {
  let memory: GuidedConsultingMemory<Context> = {
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
