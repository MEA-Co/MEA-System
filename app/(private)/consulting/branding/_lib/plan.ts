import { z } from 'zod';

import type { ConsultingMemory } from '@/features/consulting/core/agent';
import { defineConsultingPlan } from '@/features/consulting/core/plan';
import { createConsultingTools } from '@/features/consulting/core/tools';

export const brandingSteps = [
  {
    id: 'keywords',
    title: '전공 세부 키워드',
    description: '나의 관심과 탐구 방향을 나타내는 세부 키워드를 적어주세요.',
    placeholder: '관심 있는 주제나 문제를 구체적인 키워드로 작성해주세요.',
  },
  {
    id: 'values',
    title: '전공 가치관',
    description:
      '선택한 키워드를 바탕으로, 전공을 통해 추구하고 싶은 가치를 적어주세요.',
    placeholder:
      '이 분야에서 무엇을 중요하게 생각하고, 어떤 변화를 만들고 싶나요?',
  },
  {
    id: 'competencies',
    title: '계열 적합 역량',
    description: '관심 계열과 나의 가치관을 뒷받침할 역량을 적어주세요.',
    placeholder: '해당 계열에서 발휘하고 싶은 역량을 작성해주세요.',
  },
  {
    id: 'story',
    title: '한 줄 서사',
    description:
      '키워드, 가치관, 역량을 연결해 나를 설명하는 한 문장을 만들어주세요.',
    placeholder:
      '나는 어떤 관심과 역량으로 어떤 가치를 실현하고 싶은 사람인가요?',
  },
] as const;

const outputsSchema = z.object({
  keywords: z.string(),
  values: z.string(),
  competencies: z.string(),
  story: z.string(),
});
export type BrandingOutputs = z.infer<typeof outputsSchema>;
export type BrandingContext = { outputs: BrandingOutputs };
const submissionSchema = z.object({
  outputs: outputsSchema,
  direction: z.enum(['next', 'back']),
});

export function parseBrandingSubmission(value: string) {
  try {
    return submissionSchema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}

function readOutputs(
  memory: ConsultingMemory<BrandingContext>,
): BrandingOutputs {
  const action = memory.lastAction;
  return (
    (action?.type === 'user.submit'
      ? parseBrandingSubmission(action.value)?.outputs
      : null) ?? memory.context.outputs
  );
}

export const brandingTools = createConsultingTools({});

export const brandingPlan = defineConsultingPlan<
  BrandingContext,
  typeof brandingTools
>({
  id: 'branding-consulting',
  title: '생활기록부 브랜딩 컨설팅',
  entry: brandingSteps[0].id,
  createInitialContext: () => ({
    outputs: { keywords: '', values: '', competencies: '', story: '' },
  }),
  nodes: {
    ...Object.fromEntries(
      brandingSteps.map((step, index) => [
        step.id,
        {
          id: step.id,
          label: step.title,
          type: 'screen' as const,
          draftKey: step.id,
          progress: { current: index + 1, total: brandingSteps.length },
          screen: (memory: ConsultingMemory<BrandingContext>) => ({
            screenId: 'branding.input',
            mode: 'dynamic' as const,
            data: { index, outputs: readOutputs(memory) },
          }),
          on: {
            // Both directions submit the cumulative outputs so going back preserves edits.
            'user.submit': {
              guard: ({
                action,
              }: {
                action: import('@/features/consulting/core/user').ConsultingUserAction;
              }) => {
                const submission =
                  action.type === 'user.submit'
                    ? parseBrandingSubmission(action.value)
                    : null;
                return (
                  !!submission &&
                  (submission.direction === 'back'
                    ? index > 0
                    : brandingSteps
                        .slice(0, index + 1)
                        .every(
                          ({ id }) => submission.outputs[id].trim().length > 0,
                        ))
                );
              },
              target: ({
                action,
              }: {
                action: import('@/features/consulting/core/user').ConsultingUserAction;
              }) => {
                const submission =
                  action.type === 'user.submit'
                    ? parseBrandingSubmission(action.value)
                    : null;
                return submission?.direction === 'back'
                  ? brandingSteps[index - 1].id
                  : (brandingSteps[index + 1]?.id ?? 'complete');
              },
            },
          },
        },
      ]),
    ),
    complete: {
      id: 'complete',
      label: '산출물 모아보기',
      type: 'screen',
      terminal: true,
      screen: (memory) => ({
        screenId: 'branding.complete',
        mode: 'dynamic',
        data: { index: brandingSteps.length, outputs: readOutputs(memory) },
      }),
      on: {
        'user.submit': {
          guard: ({ action }) =>
            action.type === 'user.submit' &&
            parseBrandingSubmission(action.value)?.direction === 'back',
          target: 'story',
        },
      },
    },
  },
});

export const brandingScreenSchema = z.object({
  index: z.number().int().min(0).max(brandingSteps.length),
  outputs: outputsSchema,
});
