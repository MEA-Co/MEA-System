import type { GuidedConsultingUserAction } from '@/features/guided-consulting/core/protocol';

export type GuidedConsultingMainRenderEnvironment = {
  draftValue: string;
  onDraftChange: (value: string) => void;
  send: (input: GuidedConsultingUserAction) => void;
};
