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
export { useGuidedConsultingSession } from '@/features/guided-consulting/runtime/useGuidedConsultingSession';
export { GuidedConsultingFlow } from '@/features/guided-consulting/ui/GuidedConsultingFlow';
