import type { MaterialBoxProgressScreenData } from '@/app/(private)/consulting/material-box/_lib/types';
import type { ConsultingReviewPlan } from '@/features/consulting/core/review';

const majorKeywords = [
  {
    major: '산업공학',
    keyword: '사람 중심 시스템 설계',
    selectedSuggestions: [],
  },
  {
    major: '컴퓨터공학',
    keyword: '설명가능한 인공지능',
    selectedSuggestions: [],
  },
  {
    major: '심리학',
    keyword: '인지와 의사결정',
    selectedSuggestions: [],
  },
] as const;

const studentStory =
  '데이터와 기술로 효율적인 답을 찾는 데서 멈추지 않고, 사람이 그 답을 이해하고 주체적으로 선택할 수 있는 시스템을 설계하려는 학생';
const coreValue =
  '기술의 효율성과 정확성이 사용자의 이해와 선택권을 희생해서는 안 된다.';

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
        '완성된 샘플 학생 정보를 사용합니다. 입력이나 생성 작업 없이 모든 화면과 예외 상태를 자유롭게 확인할 수 있습니다.',
      scenes: [
        {
          id: 'intro',
          nodeId: 'intro',
          section: '진행 단계',
          description: '컨설팅의 목적과 성장 서사를 안내하는 시작 화면',
          renderTarget: { screenId: 'material-box.intro', mode: 'static' },
          nextSceneId: 'overview',
          on: { 'user.next-explanation': 'overview' },
        },
        {
          id: 'overview',
          nodeId: 'material-box-overview',
          section: '진행 단계',
          description: '재료함의 구성과 작성 방법을 설명하는 화면',
          renderTarget: { screenId: 'material-box.overview', mode: 'static' },
          previousSceneId: 'intro',
          nextSceneId: 'major',
          on: { 'user.next-explanation': 'major' },
        },
        {
          id: 'major',
          nodeId: 'major',
          section: '진행 단계',
          description: '샘플 학생의 희망 전공이 입력된 화면',
          renderTarget: {
            screenId: 'material-box.major',
            mode: 'dynamic',
            data: {
              majors: majorKeywords.map((entry) => entry.major),
              startAtInput: false,
            },
          },
          previousSceneId: 'overview',
          nextSceneId: 'keyword',
          on: {
            'user.previous-explanation': 'overview',
            'user.submit': 'keyword',
          },
        },
        {
          id: 'keyword',
          nodeId: 'keyword',
          section: '진행 단계',
          description: '전공별 관심 키워드를 구체화하는 화면',
          renderTarget: {
            screenId: 'material-box.keyword',
            mode: 'dynamic',
            data: {
              majors: majorKeywords.map((entry) => entry.major),
              keywords: majorKeywords.map((entry) => entry.keyword),
              selectedSuggestions: majorKeywords.map(
                (entry) => entry.selectedSuggestions,
              ),
              startAtInput: false,
            },
          },
          previousSceneId: 'major',
          nextSceneId: 'story-pending',
          on: {
            'user.previous-explanation': 'major',
            'user.submit': 'story-pending',
          },
        },
        {
          id: 'story-pending',
          nodeId: 'generate-student-story',
          stateLabel: '생성 중',
          section: '진행 단계',
          description: '학생 스토리를 생성하는 동안 표시되는 화면',
          renderTarget: {
            screenId: 'material-box.student-story-pending',
            mode: 'dynamic',
            data: { majorKeywords },
          },
          previousSceneId: 'keyword',
          nextSceneId: 'story-result',
        },
        {
          id: 'story-result',
          nodeId: 'student-story',
          stateLabel: '생성 완료',
          section: '진행 단계',
          description: '생성된 학생 스토리를 확인하는 화면',
          renderTarget: {
            screenId: 'material-box.student-story',
            mode: 'dynamic',
            data: { majorKeywords, studentStory },
          },
          previousSceneId: 'keyword',
          nextSceneId: 'core-value',
          on: {
            'user.previous-explanation': 'keyword',
            'user.next-explanation': 'core-value',
          },
        },
        {
          id: 'core-value',
          nodeId: 'core-value',
          section: '진행 단계',
          description: '학생의 핵심 가치관을 정의하는 화면',
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
          previousSceneId: 'story-result',
          nextSceneId: 'field-strength',
          on: {
            'user.previous-explanation': 'story-result',
            'user.submit': 'field-strength',
          },
        },
        {
          id: 'field-strength',
          nodeId: 'field-strength',
          section: '진행 단계',
          description: '학생의 세 가지 강점을 구체화하는 화면',
          renderTarget: {
            screenId: 'material-box.field-strength',
            mode: 'dynamic',
            data: { ...completedProgressData, startAtInput: false },
          },
          previousSceneId: 'core-value',
          nextSceneId: 'complete',
          on: {
            'user.previous-explanation': 'core-value',
            'user.submit': 'complete',
          },
        },
        {
          id: 'complete',
          nodeId: 'complete',
          section: '진행 단계',
          description: '컨설팅 결과와 예시 리포트를 확인하는 최종 화면',
          renderTarget: {
            screenId: 'material-box.complete',
            mode: 'dynamic',
            data: completedProgressData,
          },
          previousSceneId: 'field-strength',
        },
        {
          id: 'story-error',
          nodeId: 'student-story-error',
          stateLabel: '생성 실패',
          section: '예외 상태',
          description: '스토리 생성에 실패했을 때 표시되는 재시도 화면',
          renderTarget: {
            screenId: 'material-box.student-story-error',
            mode: 'dynamic',
            data: {
              majorKeywords,
              error:
                '학생 스토리를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.',
            },
          },
          previousSceneId: 'keyword',
          nextSceneId: 'story-pending',
          on: { 'user.next-explanation': 'story-pending' },
        },
      ],
    },
  ],
} satisfies ConsultingReviewPlan;
