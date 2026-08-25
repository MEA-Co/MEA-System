import type { GuidedConsultingUserAction } from '@/features/guided-consulting/core/protocol';
import type { GuidedConsultingModuleCall } from '@/features/guided-consulting/core/types';

export type GuidedConsultingAgentEvent =
  | {
      type: 'session.started';
      definitionId: string;
      nodeId: string;
    }
  | {
      type: 'user.action.received';
      action: GuidedConsultingUserAction;
      nodeId: string;
    }
  | {
      type: 'module.request.sent';
      call: GuidedConsultingModuleCall;
    }
  | {
      type: 'module.response.received';
      call: GuidedConsultingModuleCall;
      output: unknown;
    }
  | {
      type: 'module.error.received';
      call: GuidedConsultingModuleCall;
      error: Error;
    };

export type GuidedConsultingAgentEventListener = (
  event: GuidedConsultingAgentEvent,
) => void;
