import type {
  ExplorationGoal,
  ExplorationState,
  GoalSlot,
} from '@/features/exploration/schemas/exploration';

const missingSlot = (reason: string): GoalSlot => ({
  value: null,
  status: 'missing',
  ownership: 'none',
  reason,
});

export function createEmptyGoal(): ExplorationGoal {
  return {
    keyword: missingSlot('학생이 관심 키워드를 아직 선택하지 않았습니다.'),
    problem: missingSlot('학생이 탐구할 문제나 의문을 아직 선택하지 않았습니다.'),
    aspect: missingSlot('학생이 중요하게 볼 측면을 아직 선택하지 않았습니다.'),
    method: missingSlot('학생이 사용할 탐구 방법을 아직 선택하지 않았습니다.'),
    ready: false,
    nextTarget: 'keyword',
    coherenceIssue: null,
    feasibilityIssue: null,
  };
}

const CURRENT_ISSUE_PATTERNS = [
  /AI|인공지능|생성형|알고리즘/i,
  /기후|환경|탄소|에너지|배터리|수소|태양광|풍력/i,
  /의료|바이오|유전자|감염|보건/i,
  /도시|교통|주거|인구|지역/i,
  /정책|경제|금융|노동|복지|교육/i,
  /로봇|반도체|양자|우주|자율주행|신기술/i,
] as const;

export function isCurrentIssueResearchHelpful(keyword: string) {
  return CURRENT_ISSUE_PATTERNS.some((pattern) => pattern.test(keyword));
}

export function shouldResearchIssues(
  previousGoal: ExplorationGoal,
  nextGoal: ExplorationGoal,
) {
  const keyword = nextGoal.keyword.value?.trim();
  const keywordNewlyClear =
    previousGoal.keyword.status !== 'clear' &&
    nextGoal.keyword.status === 'clear';

  return Boolean(
    keyword &&
      keywordNewlyClear &&
      nextGoal.problem.status !== 'clear' &&
      isCurrentIssueResearchHelpful(keyword),
  );
}

const studentOwned = new Set(['student_explicit', 'student_confirmed']);

export function enforceGoalReadiness(goal: ExplorationGoal): ExplorationGoal {
  const slotEntries = [
    ['keyword', goal.keyword],
    ['problem', goal.problem],
    ['aspect', goal.aspect],
    ['method', goal.method],
  ] as const;
  const firstInvalidSlot = slotEntries.find(
    ([, slot]) =>
      slot.status !== 'clear' ||
      !slot.value?.trim() ||
      !studentOwned.has(slot.ownership),
  );
  const hasQualityIssue =
    goal.coherenceIssue !== null || goal.feasibilityIssue !== null;

  if (!goal.ready) {
    return goal.nextTarget === 'done'
      ? {
          ...goal,
          nextTarget: firstInvalidSlot?.[0] ?? 'problem',
        }
      : goal;
  }

  if (!firstInvalidSlot && !hasQualityIssue && goal.nextTarget === 'done') {
    return goal;
  }

  return {
    ...goal,
    ready: false,
    nextTarget:
      firstInvalidSlot?.[0] ??
      (goal.nextTarget === 'done' ? 'problem' : goal.nextTarget),
  };
}

export function hasCompletedProfile(
  state: ExplorationState,
): state is ExplorationState & {
  profile: NonNullable<ExplorationState['profile']>;
} {
  return state.goal.ready && state.profile !== null;
}

export function createCoreValueDraft(states: ReadonlyArray<ExplorationState>) {
  const labels = Array.from(
    new Set(
      states
        .map((state) => state.profile?.valueOrientation.label.trim())
        .filter((label): label is string => Boolean(label)),
    ),
  );
  const descriptions = Array.from(
    new Set(
      states
        .map((state) => state.profile?.valueOrientation.description.trim())
        .filter((description): description is string => Boolean(description)),
    ),
  );

  if (labels.length === 0) return undefined;

  const perspective = labels.join('·');
  const detail = descriptions.join(' ');
  const summary = `${perspective}의 관점을 중요하게 생각한다.`;
  const draft = `${summary} ${detail}`.trim();
  return draft.length <= 180 ? draft : summary.slice(0, 180);
}

function joinDraftsWithinLimit(drafts: ReadonlyArray<string>, limit: number) {
  return drafts.reduce((result, draft) => {
    const candidate = result ? `${result} ${draft}` : draft;
    return candidate.length <= limit ? candidate : result;
  }, '');
}

export function createPureFieldStrengthDraft(
  states: ReadonlyArray<ExplorationState>,
) {
  const drafts = Array.from(
    new Set(
      states
        .map(
          (state) =>
            state.profile?.capabilityApplication.pureFieldFitDraft.trim(),
        )
        .filter((draft): draft is string => Boolean(draft)),
    ),
  );

  const draft = joinDraftsWithinLimit(drafts, 180);
  return draft || undefined;
}

export function createMajorFieldStrengthDraft(
  states: ReadonlyArray<ExplorationState>,
) {
  const drafts = Array.from(
    new Set(
      states
        .map(
          (state) =>
            state.profile?.capabilityApplication.majorFieldFitDraft.trim(),
        )
        .filter((draft): draft is string => Boolean(draft)),
    ),
  );

  const draft = joinDraftsWithinLimit(drafts, 180);
  return draft || undefined;
}
