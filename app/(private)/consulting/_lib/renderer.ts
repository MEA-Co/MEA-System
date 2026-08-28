import type { ConsultingUserAction } from '@/features/consulting/core/user';
import type { MemberRole } from '@/lib/profile';

export type ConsultingScreenRenderEnvironment = {
  draftValue: string;
  onDraftChange: (value: string) => void;
  send: (input: ConsultingUserAction) => void;
  viewerRole: MemberRole;
};
