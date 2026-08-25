import type { GuidedConsultingUserAction } from '@/features/guided-consulting/core/protocol';
import type { GuidedConsultingToolCall } from '@/features/guided-consulting/core/types';

export type GuidedConsultingAgentEvent =
  | {
      type: 'session.started';
      definitionId: string;
      stepId: string | null;
    }
  | {
      type: 'user.action.received';
      action: GuidedConsultingUserAction;
      stepId: string | null;
    }
  | {
      type: 'module.request.sent';
      call: GuidedConsultingToolCall;
    }
  | {
      type: 'module.response.received';
      call: GuidedConsultingToolCall;
      output: unknown;
    }
  | {
      type: 'module.error.received';
      call: GuidedConsultingToolCall;
      error: Error;
    };

export type GuidedConsultingAgentEventListener = (
  event: GuidedConsultingAgentEvent,
) => void;
