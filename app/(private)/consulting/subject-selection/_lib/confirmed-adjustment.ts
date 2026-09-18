import {
  coreChoiceStatuses,
  type PriorityProfile,
} from '@/features/subject-selection/recommendations';
import { scienceSequenceGaps } from '@/features/subject-selection/science-sequence';

import { buildCombinedMajorDraft } from './combined-major';
import { buildStandardDraft } from './course-selection-draft';
import { sameCourse } from './course-selection-utils';
import { allocatedCourses, swapProblem } from './course-swap';
import type { ConfirmedCurriculum, CurriculumCourse } from './curriculum';
import {
  compensationProblem,
  findGraduationCompensation,
  type GraduationCompensation,
} from './graduation-compensation';
import { evaluateMajorDepth, majorDepthEvidence } from './major-depth';

export type ConfirmedSwap = {
  from: CurriculumCourse;
  to: CurriculumCourse;
  term: string;
  group: string;
  compensations?: GraduationCompensation[];
};
export type ConfirmedAdjustment = {
  originalIds: string[];
  nextIds: string[];
  swaps: ConfirmedSwap[];
  result: ReturnType<typeof buildCombinedMajorDraft>;
};

export function confirmedSwapProblem(
  curriculum: ConfirmedCurriculum,
  ids: string[],
  primary: PriorityProfile,
  fromId: string,
  toId: string,
  compensations: GraduationCompensation[] = [],
) {
  if (!ids.includes(fromId)) return '현재 1단계 확정 과목이 아니에요.';
  const swappedIds = ids.map((id) => (id === fromId ? toId : id));
  const additionProblem = compensationProblem(
    curriculum,
    swappedIds,
    compensations,
  );
  if (additionProblem) return additionProblem;
  const nextIds = [
    ...swappedIds,
    ...compensations.map((item) => item.course.id),
  ];
  const problem = swapProblem(
    curriculum,
    ids.filter((id) => id !== fromId),
    [fromId],
    fromId,
    toId,
    true,
    compensations.map((item) => item.course.id),
  );
  if (problem) return problem;
  const after = allocatedCourses(curriculum, nextIds);
  if (
    primary.core.some(
      (name) => !after.some((course) => sameCourse(name, course.name)),
    ) ||
    coreChoiceStatuses(primary, after).some((rule) => !rule.satisfied)
  )
    return '기존 희망 학과의 코어 조건을 유지해야 해요.';
  const withRecommendations = (fixedIds: string[]) =>
    allocatedCourses(curriculum, [
      ...fixedIds,
      ...buildStandardDraft(curriculum, fixedIds, primary).flatMap((term) =>
        term.recommendedCourses.map(({ course }) => course.id),
      ),
    ]);
  const beforeGaps = scienceSequenceGaps(withRecommendations(ids));
  const nextGaps = scienceSequenceGaps(withRecommendations(nextIds));
  if (
    nextGaps.some(
      (gap) =>
        !beforeGaps.some((previous) => previous.advanced === gap.advanced),
    )
  )
    return '선행 과목을 2단계 빈자리에도 배치할 수 없는 교체예요.';
  return null;
}

export function validateConfirmedAdjustment(
  curriculum: ConfirmedCurriculum,
  ids: string[],
  primary: PriorityProfile,
  proposal: ConfirmedAdjustment,
) {
  if (
    ids.length !== proposal.originalIds.length ||
    ids.some((id) => !proposal.originalIds.includes(id))
  )
    return '선택 내역이 달라졌어요. 다시 검토해 주세요.';
  let next = [...ids];
  for (const swap of proposal.swaps) {
    const problem = confirmedSwapProblem(
      curriculum,
      next,
      primary,
      swap.from.id,
      swap.to.id,
      swap.compensations,
    );
    if (problem) return problem;
    next = [
      ...next.map((id) => (id === swap.from.id ? swap.to.id : id)),
      ...(swap.compensations ?? []).map((item) => item.course.id),
    ];
  }
  if (
    next.length !== proposal.nextIds.length ||
    next.some((id) => !proposal.nextIds.includes(id))
  )
    return '변경안이 일치하지 않아요. 다시 검토해 주세요.';
  return null;
}

export function findConfirmedAdjustment(
  curriculum: ConfirmedCurriculum,
  ids: string[],
  primary: PriorityProfile,
  secondary: PriorityProfile,
  recommendedIds: string[],
) {
  const baseline = buildStandardDraft(curriculum, ids, primary);
  const originalCourses = allocatedCourses(curriculum, [
    ...ids,
    ...baseline.flatMap((term) =>
      term.recommendedCourses.map((item) => item.course.id),
    ),
  ]);
  const initial = buildCombinedMajorDraft(
    curriculum,
    ids,
    primary,
    secondary,
    recommendedIds,
  );
  const queue = [{ ids, swaps: [] as ConfirmedSwap[], result: initial }];
  const visited = new Set([ids.slice().sort().join('|')]);
  let attempts = 0;
  // Bound synchronous prototype search; exhausted search is not proof of impossibility.
  const maxAttempts = 200;
  const maxChanges = 3;
  for (
    let index = 0;
    index < queue.length && attempts < maxAttempts;
    index += 1
  ) {
    const state = queue[index];
    if (state.swaps.length >= maxChanges) continue;
    const missing = state.result.assessments.flatMap((assessment) => [
      ...assessment.missing,
      ...assessment.choices.flatMap((rule) => rule.courses),
    ]);
    missing.push(
      ...state.result.depth.method.groups
        .filter((group) => group.count < group.choose)
        .flatMap((group) => [...group.courses]),
    );
    const targets = [
      ...missing,
      ...scienceSequenceGaps(missing.map((name) => ({ name }))).map(
        (gap) => gap.basic,
      ),
    ];
    for (const term of curriculum.terms)
      for (const group of term.selectionGroups) {
        const candidates = group.courses.filter(
          (course) =>
            !state.ids.includes(course.id) &&
            (targets.some((name) => sameCourse(name, course.name)) ||
              (!missing.length &&
                (majorDepthEvidence(primary, course) ||
                  majorDepthEvidence(secondary, course)))),
        );
        for (const to of candidates)
          for (const from of group.courses.filter(
            (course) =>
              state.ids.includes(course.id) &&
              !state.swaps.some((swap) => swap.to.id === course.id),
          )) {
            if (attempts >= maxAttempts) break;
            const swappedIds = state.ids.map((id) =>
              id === from.id ? to.id : id,
            );
            const compensations = findGraduationCompensation(
              curriculum,
              state.ids,
              swappedIds,
              (additions) =>
                !confirmedSwapProblem(
                  curriculum,
                  state.ids,
                  primary,
                  from.id,
                  to.id,
                  additions,
                ),
            );
            if (!compensations) continue;
            const nextIds = [
              ...swappedIds,
              ...compensations.map((item) => item.course.id),
            ];
            const key = nextIds.slice().sort().join('|');
            if (visited.has(key)) continue;
            visited.add(key);
            attempts += 1;
            const result = buildCombinedMajorDraft(
              curriculum,
              nextIds,
              primary,
              secondary,
              recommendedIds,
            );
            const completed = allocatedCourses(curriculum, [
              ...nextIds,
              ...result.terms.flatMap((item) =>
                item.recommendedCourses.map(({ course }) => course.id),
              ),
            ]);
            result.depth = evaluateMajorDepth(
              primary,
              secondary,
              originalCourses,
              completed,
            );
            if (result.status !== 'review')
              result.status = result.depth.supported
                ? 'both'
                : result.depth.humanities
                  ? 'review'
                  : 'focused';
            const swaps = [
              ...state.swaps,
              { from, to, term: term.label, group: group.name, compensations },
            ];
            if (result.status === 'both')
              return {
                proposal: {
                  originalIds: [...ids],
                  nextIds,
                  swaps,
                  result,
                } satisfies ConfirmedAdjustment,
                attempts,
                maxChanges,
                limited: false,
              };
            queue.push({ ids: nextIds, swaps, result });
          }
      }
  }
  return {
    proposal: null,
    attempts,
    maxChanges,
    limited: attempts >= maxAttempts,
  };
}
