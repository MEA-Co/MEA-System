import type {
  ConsultingPrompterPlacement,
  ConsultingPrompterSize,
} from '@/features/consulting/ui/ConsultingMain';
import type { ConsultingMessage } from '@/features/consulting/ui/message';

export type OnboardingAnswer = 'well-written' | 'poorly-written';
export type OnboardingScreen = 'writing-comparison';

export type OnboardingMemory = {
  answer: OnboardingAnswer | null;
};

export type OnboardingTaskOutputs = Record<never, never>;

export type OnboardingView = {
  message: ConsultingMessage | null;
  prompterPlacement: ConsultingPrompterPlacement;
  prompterSize: ConsultingPrompterSize;
  screen: OnboardingScreen | null;
};

export type OnboardingInteraction =
  { kind: 'continue' } | { kind: 'writing-choice' } | { kind: 'none' };

export type OnboardingEvent =
  { type: 'CONTINUE' } | { type: 'SELECT_WRITING'; answer: OnboardingAnswer };
