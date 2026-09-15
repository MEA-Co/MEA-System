import {
  type BrandingOutputs,
  brandingSteps,
} from '@/app/(private)/consulting/branding/_lib/plan';
import type { ConsultingReviewPlan } from '@/features/consulting/core/review';

const majors = {
  first: '산업공학',
  second: '컴퓨터·소프트웨어공학',
  third: '심리학',
};

const outputs = {
  keywords: '인간 중심 시스템 설계와 설명 가능한 인공지능',
  values:
    '기술이 효율을 높이는 데서 멈추지 않고, 누구나 이해하고 주체적으로 선택할 수 있게 만드는 가치를 추구하고 싶다.',
  competencies:
    '복잡한 정보를 구조화하고 여러 관점의 의견을 연결해, 사용자의 경험을 개선하는 해결책을 설계하는 역량',
  story:
    '나는 사람이 이해하고 선택할 수 있는 기술을 설계하기 위해, 데이터를 분석하고 다양한 관점을 연결하는 사람이다.',
} satisfies BrandingOutputs;

export const brandingReviewPlan = {
  id: 'branding-consulting-review',
  scenarios: [
    {
      id: 'human-centered-engineer',
      label: '인간 중심 기술 탐구 학생',
      description:
        '완성된 샘플 학생 정보를 사용합니다. 입력 작업 없이 각 단계와 모아보기 화면을 자유롭게 확인할 수 있습니다.',
      steps: [
        {
          id: 'intro',
          nodeId: 'intro',
          section: '도입',
          description: '생활기록부 브랜딩의 목적을 안내하는 도입 단계',
          states: [
            {
              id: 'default',
              renderTarget: { screenId: 'branding.intro', mode: 'static' },
              on: {
                'user.start-input': {
                  stepId: 'keywords',
                  stateId: 'primary-major',
                },
              },
            },
          ],
        },
        ...brandingSteps.map((step, index) => ({
          id: step.id,
          nodeId: step.id,
          section: '브랜딩 산출물',
          statePresentation: 'substeps' as const,
          description: `샘플 학생의 ${step.title}을 작성하는 단계`,
          states: [
            ...(index === 0
              ? [
                  {
                    id: 'primary-major',
                    label: '1순위 전공 선택',
                    description: '가장 가고 싶은 전공을 입력하는 화면',
                    renderTarget: {
                      screenId: 'branding.primary-major',
                      mode: 'static' as const,
                    },
                    on: {
                      'user.previous-explanation': 'intro',
                      'user.submit': {
                        stepId: 'keywords',
                        stateId: 'additional-majors',
                      },
                    },
                  },
                  {
                    id: 'additional-majors',
                    label: '추가 전공 선택',
                    description: '2·3순위 전공을 선택적으로 입력하는 화면',
                    renderTarget: {
                      screenId: 'branding.additional-majors',
                      mode: 'static' as const,
                    },
                    on: {
                      'user.previous-explanation': {
                        stepId: 'keywords',
                        stateId: 'primary-major',
                      },
                      'user.submit': {
                        stepId: 'keywords',
                        stateId: 'default',
                      },
                    },
                  },
                ]
              : []),
            {
              id: 'default',
              ...(index === 0
                ? {
                    label: '키워드 작성',
                    on: {
                      'user.previous-explanation': {
                        stepId: 'keywords',
                        stateId: 'primary-major',
                      },
                    },
                  }
                : {}),
              renderTarget: {
                screenId: 'branding.input',
                mode: 'dynamic' as const,
                data: {
                  index,
                  isReview: true,
                  outputs,
                  majors,
                },
              },
            },
          ],
        })),
        {
          id: 'complete',
          nodeId: 'complete',
          section: '마무리',
          description: '모든 산출물을 연결해 확인하는 최종 단계',
          states: [
            {
              id: 'default',
              renderTarget: {
                screenId: 'branding.complete',
                mode: 'dynamic',
                data: {
                  index: brandingSteps.length,
                  outputs,
                  majors,
                },
              },
              on: { 'user.submit': 'story' },
            },
          ],
        },
      ],
    },
  ],
} satisfies ConsultingReviewPlan;
