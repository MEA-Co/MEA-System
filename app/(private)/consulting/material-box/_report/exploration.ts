import type { MaterialBoxProgressScreenData } from '@/app/(private)/consulting/material-box/_lib/types';
import type {
  ExplorationState,
  ProfileTrait,
} from '@/features/exploration/schemas/exploration';

export type ExplorationProfileItem = {
  title: string;
  trait: ProfileTrait;
};

export type MaterialBoxExplorationReportSection = {
  state: ExplorationState;
  goalStatement: string;
  profileItems: ReadonlyArray<ExplorationProfileItem>;
};

function createGoalStatement(state: ExplorationState) {
  const { keyword, problem, aspect, method } = state.goal;
  if (!keyword.value || !problem.value || !aspect.value || !method.value) {
    return '탐구 목표가 아직 완성되지 않았습니다.';
  }

  return `탐구 영역: ${keyword.value}. 탐구 문제: ${problem.value}. 핵심 관점: ${aspect.value}. 탐구 방법: ${method.value}.`;
}

export function createExplorationReportSections(
  data: Pick<MaterialBoxProgressScreenData, 'majorKeywords'>,
): ReadonlyArray<MaterialBoxExplorationReportSection> {
  return data.majorKeywords.flatMap((entry) => {
    const state = entry.explorationState;
    if (!state?.profile) return [];

    return [
      {
        state,
        goalStatement: createGoalStatement(state),
        profileItems: [
          { title: '관심 키워드', trait: state.profile.interestKeyword },
          { title: '중요하게 본 관점', trait: state.profile.valueOrientation },
          { title: '선택한 탐구 접근', trait: state.profile.capability },
        ],
      },
    ];
  });
}
