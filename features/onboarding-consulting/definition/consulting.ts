import { defineConsulting } from '@/features/consulting/core/consulting';
import { onboardingMemory } from '@/features/onboarding-consulting/definition/memory';
import { onboardingProcess } from '@/features/onboarding-consulting/definition/process';
import { onboardingTasks } from '@/features/onboarding-consulting/definition/tasks';
import type {
  OnboardingEvent,
  OnboardingInteraction,
  OnboardingMemory,
  OnboardingTaskOutputs,
  OnboardingView,
} from '@/features/onboarding-consulting/model/types';

export const onboardingConsulting = defineConsulting<
  OnboardingMemory,
  OnboardingView,
  OnboardingTaskOutputs,
  OnboardingEvent,
  OnboardingInteraction
>({
  memory: onboardingMemory,
  tasks: onboardingTasks,
  process: onboardingProcess,
});
