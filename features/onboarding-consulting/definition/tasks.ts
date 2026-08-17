import { defineConsultingTasks } from '@/features/consulting/core/task';
import type {
  OnboardingMemory,
  OnboardingTaskOutputs,
  OnboardingView,
} from '@/features/onboarding-consulting/model/types';

export const onboardingTasks = defineConsultingTasks<
  OnboardingMemory,
  OnboardingView,
  OnboardingTaskOutputs
>({});
