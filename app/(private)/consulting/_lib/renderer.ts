import type { GuidedConsultingUserAction } from '@/features/guided-consulting/core/protocol';

export type GuidedConsultingScreenRenderEnvironment = {
  draftValue: string;
  onDraftChange: (value: string) => void;
  send: (input: GuidedConsultingUserAction) => void;
};
