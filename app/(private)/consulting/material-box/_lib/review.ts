import type { MaterialBoxProgressScreenData } from '@/app/(private)/consulting/material-box/_lib/types';
import type { GenerateKeywordSuggestionsToolOutput } from '@/app/(private)/consulting/material-box/_tools/GenerateKeywordSuggestionsTool';
import type { ConsultingReviewPlan } from '@/features/consulting/core/review';

const studentStory =
  '데이터와 기술로 효율적인 답을 찾는 데서 멈추지 않고, 사람이 그 답을 이해하고 주체적으로 선택할 수 있는 시스템을 설계하려는 학생';
const coreValue =
  '기술의 효율성과 정확성이 사용자의 이해와 선택권을 희생해서는 안 된다.';

const keywordSuggestionResults = [
  {
    major: '산업공학',
    suggestions: [
      {
        keyword: '인간 중심 시스템 설계',
        description:
          '사람이 복잡한 시스템을 더 쉽게 이해하고 안전하게 사용할 수 있도록 사용자와 기술의 상호작용을 설계하는 분야입니다.',
        links: [
          {
            title: '서울대학교 산업공학과',
            type: 'department',
            url: 'https://ie.snu.ac.kr/',
            sourceKeyword: 'Human Factors Engineering',
          },
          {
            title: '서울대학교 인간공학 연구실',
            type: 'laboratory',
            url: 'https://hcil.snu.ac.kr/',
            sourceKeyword: 'Human-Computer Interaction',
          },
        ],
      },
    ],
  },
  {
    major: '컴퓨터공학',
    suggestions: [
      {
        keyword: '설명가능한 인공지능',
        description:
          '인공지능이 내린 판단의 근거를 사람이 이해하고 검토할 수 있도록 만드는 방법을 탐구하는 분야입니다.',
        links: [
          {
            title: '서울대학교 컴퓨터공학부',
            type: 'department',
            url: 'https://cse.snu.ac.kr/',
            sourceKeyword: 'Artificial Intelligence',
          },
          {
            title: 'KAIST Explainable AI 연구실',
            type: 'laboratory',
            url: 'https://xai.kaist.ac.kr/',
            sourceKeyword: 'Explainable Artificial Intelligence',
          },
        ],
      },
    ],
  },
  {
    major: '심리학',
    suggestions: [
      {
        keyword: '인지와 의사결정',
        description:
          '사람이 정보를 받아들이고 판단을 내리는 과정과 그 과정에 영향을 주는 요인을 살펴보는 분야입니다.',
        links: [
          {
            title: '서울대학교 심리학과',
            type: 'department',
            url: 'https://psych.snu.ac.kr/',
            sourceKeyword: '인지심리학',
          },
          {
            title: '서울대학교 인지신경과학 연구실',
            type: 'laboratory',
            url: 'https://cogneuro.snu.ac.kr/',
            sourceKeyword: 'Decision Making',
          },
        ],
      },
    ],
  },
] satisfies ReadonlyArray<GenerateKeywordSuggestionsToolOutput>;

const majorKeywords = keywordSuggestionResults.map((result) => ({
  major: result.major,
  keyword: result.suggestions
    .map((suggestion) => suggestion.keyword)
    .join(', '),
  selectedSuggestions: result.suggestions,
}));

const keywordScreenData = {
  majors: majorKeywords.map((entry) => entry.major),
  keywords: majorKeywords.map((entry) => entry.keyword),
  selectedSuggestions: majorKeywords.map((entry) => entry.selectedSuggestions),
  startAtInput: true,
};

const keywordScreenTransitions = {
  'user.previous-explanation': 'major',
  'user.submit': {
    stepId: 'student-story',
    stateId: 'pending',
  },
} as const;

const completedProgressData = {
  majorKeywords,
  studentStory,
  coreValue,
  fieldStrength:
    '복잡한 자료를 기준에 따라 구조화하고 여러 대안을 같은 조건에서 비교하는 힘',
  majorFieldStrength:
    '데이터 분석 결과를 실제 사용자의 경험과 연결해 개선점을 설계하는 힘',
  personalStrength:
    '팀원의 다른 관점을 끝까지 듣고 모두가 이해할 수 있는 언어로 정리하는 힘',
} satisfies MaterialBoxProgressScreenData;

export const materialBoxReviewPlan = {
  id: 'material-box-review',
  scenarios: [
    {
      id: 'engineering-student',
      label: '공학계열 샘플 학생',
      description:
        '완성된 샘플 학생 정보를 사용합니다. 입력이나 생성 작업 없이 모든 단계와 화면 상태를 자유롭게 확인할 수 있습니다.',
      steps: [
        {
          id: 'intro',
          nodeId: 'intro',
          section: '진행 단계',
          description: '컨설팅의 목적과 성장 서사를 안내하는 시작 단계',
          states: [
            {
              id: 'default',
              renderTarget: {
                screenId: 'material-box.intro',
                mode: 'static',
              },
              on: { 'user.next-explanation': 'overview' },
            },
          ],
        },
        {
          id: 'overview',
          nodeId: 'material-box-overview',
          section: '진행 단계',
          description: '재료함의 구성과 작성 방법을 설명하는 단계',
          states: [
            {
              id: 'default',
              renderTarget: {
                screenId: 'material-box.overview',
                mode: 'static',
              },
              on: { 'user.next-explanation': 'major' },
            },
          ],
        },
        {
          id: 'major',
          nodeId: 'major',
          section: '진행 단계',
          description: '샘플 학생의 희망 전공을 확인하는 단계',
          states: [
            {
              id: 'default',
              renderTarget: {
                screenId: 'material-box.major',
                mode: 'dynamic',
                data: {
                  majors: majorKeywords.map((entry) => entry.major),
                  startAtInput: false,
                },
              },
              on: {
                'user.previous-explanation': 'overview',
                'user.submit': { stepId: 'keyword', stateId: 'pending' },
              },
            },
          ],
        },
        {
          id: 'keyword',
          nodeId: 'keyword',
          section: '진행 단계',
          description: '전공별 관심 키워드를 구체화하는 단계',
          states: [
            {
              id: 'pending',
              label: '추천 준비 중',
              description: '세부 키워드 추천을 준비하는 동안의 상태',
              renderTarget: {
                screenId: 'material-box.keyword',
                mode: 'dynamic',
                data: {
                  ...keywordScreenData,
                  suggestionTaskState: { status: 'pending' },
                },
              },
              on: keywordScreenTransitions,
            },
            {
              id: 'completed',
              label: '추천 완료',
              description: '추천 결과를 열고 선택할 수 있는 상태',
              renderTarget: {
                screenId: 'material-box.keyword',
                mode: 'dynamic',
                data: {
                  ...keywordScreenData,
                  suggestionTaskState: {
                    status: 'completed',
                    results: keywordSuggestionResults,
                  },
                },
              },
              on: keywordScreenTransitions,
            },
            {
              id: 'rejected',
              label: '추천 실패',
              description: '세부 키워드 추천에 실패했을 때의 상태',
              renderTarget: {
                screenId: 'material-box.keyword',
                mode: 'dynamic',
                data: {
                  ...keywordScreenData,
                  suggestionTaskState: {
                    status: 'rejected',
                    error:
                      '세부 키워드 제안을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
                  },
                },
              },
              on: {
                ...keywordScreenTransitions,
                'user.retry': { stepId: 'keyword', stateId: 'pending' },
              },
            },
          ],
        },
        {
          id: 'student-story',
          nodeId: 'student-story',
          section: '진행 단계',
          description: '입력 내용을 연결해 학생의 탐구 정체성을 보여주는 단계',
          states: [
            {
              id: 'pending',
              label: '생성 중',
              description: '학생 스토리를 생성하는 동안 표시되는 상태',
              renderTarget: {
                screenId: 'material-box.student-story',
                mode: 'dynamic',
                data: { majorKeywords, taskState: { status: 'pending' } },
              },
            },
            {
              id: 'completed',
              label: '생성 완료',
              description: '생성된 학생 스토리를 확인하는 상태',
              renderTarget: {
                screenId: 'material-box.student-story',
                mode: 'dynamic',
                data: {
                  majorKeywords,
                  studentStory,
                  taskState: { status: 'completed' },
                },
              },
              on: {
                'user.previous-explanation': {
                  stepId: 'keyword',
                  stateId: 'completed',
                },
                'user.next-explanation': 'core-value',
              },
            },
            {
              id: 'rejected',
              label: '생성 실패',
              description: '스토리 생성에 실패했을 때 표시되는 상태',
              renderTarget: {
                screenId: 'material-box.student-story',
                mode: 'dynamic',
                data: {
                  majorKeywords,
                  taskState: {
                    status: 'rejected',
                    error:
                      '학생 스토리를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.',
                  },
                },
              },
              on: {
                'user.retry': {
                  stepId: 'student-story',
                  stateId: 'pending',
                },
              },
            },
          ],
        },
        {
          id: 'core-value',
          nodeId: 'core-value',
          section: '진행 단계',
          description: '학생의 핵심 가치관을 정의하는 단계',
          states: [
            {
              id: 'default',
              renderTarget: {
                screenId: 'material-box.core-value',
                mode: 'dynamic',
                data: {
                  majorKeywords,
                  studentStory,
                  coreValue,
                  startAtInput: false,
                },
              },
              on: {
                'user.previous-explanation': {
                  stepId: 'student-story',
                  stateId: 'completed',
                },
                'user.submit': 'field-strength',
              },
            },
          ],
        },
        {
          id: 'field-strength',
          nodeId: 'field-strength',
          section: '진행 단계',
          description: '학생의 세 가지 강점을 구체화하는 단계',
          states: [
            {
              id: 'default',
              renderTarget: {
                screenId: 'material-box.field-strength',
                mode: 'dynamic',
                data: { ...completedProgressData, startAtInput: false },
              },
              on: {
                'user.previous-explanation': 'core-value',
                'user.submit': 'complete',
              },
            },
          ],
        },
        {
          id: 'complete',
          nodeId: 'complete',
          section: '진행 단계',
          description: '컨설팅 결과와 예시 리포트를 확인하는 최종 단계',
          states: [
            {
              id: 'default',
              renderTarget: {
                screenId: 'material-box.complete',
                mode: 'dynamic',
                data: completedProgressData,
              },
            },
          ],
        },
      ],
    },
  ],
} satisfies ConsultingReviewPlan;
