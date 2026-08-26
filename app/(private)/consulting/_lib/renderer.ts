import type { ConsultingUserAction } from '@/features/consulting/core/user';

export type ConsultingScreenRenderEnvironment = {
  draftValue: string;
  onDraftChange: (value: string) => void;
  send: (input: ConsultingUserAction) => void;
};
