export {
  defineGuidedConsulting,
  defineGuidedStep,
} from '@/features/guided-consulting/core/definition';
export { createGuidedConsultingEngine } from '@/features/guided-consulting/core/engine';
export type {
  GuidedConsultingDefinition,
  GuidedConsultingEngine,
  GuidedConsultingGuide,
  GuidedConsultingInput,
  GuidedConsultingPhase,
  GuidedConsultingSnapshot,
  GuidedConsultingStep,
  GuidedConsultingStepResult,
} from '@/features/guided-consulting/core/types';
export { useGuidedConsultingSession } from '@/app/(private)/consulting/_hooks/useGuidedConsultingSession';
