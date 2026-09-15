import { z } from 'zod';

import type { ConsultingMemory } from '@/features/consulting/core/agent';
import { defineConsultingPlan } from '@/features/consulting/core/plan';
import { createConsultingTools } from '@/features/consulting/core/tools';
import { parseMajorDraft } from '@/features/keywords/major-search/domain';

import {
  generateMajorOverviewTool,
  majorOverviewKey,
} from '../_tools/GenerateMajorOverviewTool';

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

export const brandingTools = createConsultingTools<{
  'major-overview.generate': {
    input: { major: string };
    output: Awaited<ReturnType<typeof generateMajorOverviewTool.execute>>;
  };
}>({ 'major-overview.generate': generateMajorOverviewTool });

export const majorListSchema = z.object({
  first: z.string(),
  second: z.string().optional(),
  third: z.string().optional(),
});
export type MajorList = z.infer<typeof majorListSchema>;
export function majorNames(majors: MajorList) {
  return [
    ...new Set(
      [majors.first, majors.second, majors.third].filter(
        (major): major is string => !!major?.trim(),
      ),
    ),
  ];
}

export const additionalMajorsSchema = z.object({
  second: z.string().trim(),
  third: z.string().trim(),
});
export function parseAdditionalMajors(value: string) {
  try {
    return additionalMajorsSchema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}
function readMajors(memory: ConsultingMemory<BrandingContext>) {
  const primary = memory.actions['primary-major'];
  const additional = memory.actions['additional-majors'];
  return {
    first:
      primary?.type === 'user.submit'
        ? (parseMajorDraft(primary.value)?.confirmed?.name ??
          primary.value.trim())
        : '',
    ...Object.fromEntries(
      Object.entries(
        additional?.type === 'user.submit'
          ? (parseAdditionalMajors(additional.value) ?? {})
          : {},
      ).map(([key, value]) => [
        key,
        parseMajorDraft(value)?.confirmed?.name ??
          (parseMajorDraft(value) ? '' : value),
      ]),
    ),
  };
}

export const brandingPlan = defineConsultingPlan<
  BrandingContext,
  typeof brandingTools
>({
  id: 'branding-consulting',
  title: '생활기록부 브랜딩 컨설팅',
  entry: 'intro',
  createInitialContext: () => ({
    outputs: { keywords: '', values: '', competencies: '', story: '' },
  }),
  nodes: {
    intro: {
      id: 'intro',
      label: '생활기록부 브랜딩 소개',
      type: 'screen',
      progress: { current: 0, total: brandingSteps.length },
      screen: { screenId: 'branding.intro', mode: 'static' },
      on: { 'user.start-input': 'primary-major' },
    },
    'primary-major': {
      id: 'primary-major',
      label: '전공 세부 키워드',
      type: 'screen',
      draftKey: 'primary-major',
      progress: { current: 1, total: brandingSteps.length },
      screen: { screenId: 'branding.primary-major', mode: 'static' },
      on: {
        'user.submit': {
          target: 'additional-majors',
          guard: ({ action }) =>
            action.type === 'user.submit' &&
            !!parseMajorDraft(action.value)?.confirmed,
        },
      },
    },
    'additional-majors': {
      id: 'additional-majors',
      label: '전공 세부 키워드',
      type: 'screen',
      draftKey: 'additional-majors',
      progress: { current: 1, total: brandingSteps.length },
      screen: { screenId: 'branding.additional-majors', mode: 'static' },
      on: {
        'user.submit': {
          target: 'major-confirmation',
          guard: ({ action }) =>
            action.type === 'user.submit' &&
            parseAdditionalMajors(action.value) !== null &&
            Object.values(parseAdditionalMajors(action.value)!).every(
              (value) =>
                !value ||
                (!!parseMajorDraft(value) &&
                  (!parseMajorDraft(value)!.input.trim() ||
                    !!parseMajorDraft(value)!.confirmed)),
            ),
        },
      },
    },
    'major-confirmation': {
      id: 'major-confirmation',
      label: '희망 전공 확인',
      type: 'screen',
      progress: { current: 1, total: 4 },
      screen: (memory) => ({
        screenId: 'branding.major-confirmation',
        mode: 'dynamic',
        data: readMajors(memory),
      }),
      on: {
        'user.start-input': 'keyword-guide',
        'user.previous-explanation': 'primary-major',
      },
      effects: {
        'user.start-input': ({ memory }) =>
          majorNames(readMajors(memory)).map((major) => ({
            toolId: 'major-overview.generate' as const,
            input: { major },
            key: majorOverviewKey(major),
            groupId: `branding-overviews:${JSON.stringify(majorNames(readMajors(memory)))}`,
            label: `${major} · 학과 안내 준비`,
            resultKey: majorOverviewKey(major),
            policy: 'reuse' as const,
          })),
      },
    },
    'keyword-guide': {
      id: 'keyword-guide',
      label: '전공 세부 키워드 안내',
      type: 'screen',
      progress: { current: 1, total: 4 },
      screen: (memory) => ({
        screenId: 'branding.keyword-guide',
        mode: 'dynamic',
        data: readMajors(memory),
      }),
      on: { 'user.start-input': 'keywords' },
    },
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
            data: {
              index,
              outputs: readOutputs(memory),
              majors: readMajors(memory),
            },
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
        data: {
          index: brandingSteps.length,
          outputs: readOutputs(memory),
          majors: readMajors(memory),
        },
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
  isReview: z.boolean().optional(),
  outputs: outputsSchema,
  majors: z.object({
    first: z.string(),
    second: z.string().optional(),
    third: z.string().optional(),
  }),
});
