import { defineConsultingMemory } from '@/features/consulting/core/memory';
import type { OnboardingMemory } from '@/features/onboarding-consulting/model/types';

export const onboardingMemory = defineConsultingMemory<OnboardingMemory>(
  () => ({
    answer: null,
  }),
);
