import type { ConsultingModuleCall } from '@/features/consulting/core/agent/types';
import type { ConsultingUserAction } from '@/features/consulting/core/user/protocol';

export type ConsultingAgentEvent =
  | {
      type: 'session.started';
      planId: string;
      nodeId: string;
    }
  | {
      type: 'user.action.received';
      action: ConsultingUserAction;
      nodeId: string;
    }
  | {
      type: 'module.request.sent';
      call: ConsultingModuleCall;
    }
  | {
      type: 'module.response.received';
      call: ConsultingModuleCall;
      output: unknown;
    }
  | {
      type: 'module.error.received';
      call: ConsultingModuleCall;
      error: Error;
    };

export type ConsultingAgentEventListener = (
  event: ConsultingAgentEvent,
) => void;
