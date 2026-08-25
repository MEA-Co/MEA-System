import type {
  GuidedConsultingDefinition,
  GuidedConsultingStep,
} from '@/features/guided-consulting/core/types';

export function defineGuidedStep<Context extends object, Tools extends object>(
  step: GuidedConsultingStep<Context, Tools>,
): GuidedConsultingStep<Context, Tools> {
  return step;
}

export function defineGuidedConsulting<
  Context extends object,
  Tools extends object,
>(
  definition: GuidedConsultingDefinition<Context, Tools>,
): GuidedConsultingDefinition<Context, Tools> {
  if (definition.steps.length === 0) {
    throw new Error('컨설팅에는 한 개 이상의 Step이 필요합니다.');
  }

  const stepIds = new Set<string>();
  for (const step of definition.steps) {
    if (stepIds.has(step.id)) {
      throw new Error(`중복된 Step ID입니다: ${step.id}`);
    }
    stepIds.add(step.id);

    if (!step.tool.id.trim()) {
      throw new Error(`Step Tool 이름이 필요합니다: ${step.id}`);
    }
  }

  return definition;
}
