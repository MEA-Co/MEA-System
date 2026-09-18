import {
  type StandardDraftTerm,
  withUnselectedGroups,
} from './course-selection-draft';
import { swapProblem } from './course-swap';
import type { ConfirmedCurriculum } from './curriculum';

export function replaceDraftCourse(
  curriculum: ConfirmedCurriculum,
  confirmedIds: string[],
  terms: StandardDraftTerm[],
  fromId: string,
  toId: string,
  acknowledgeScience = false,
  source: 'counseling' | 'direct' = 'counseling',
) {
  const recommendedIds = terms.flatMap((term) =>
    term.recommendedCourses.map(({ course }) => course.id),
  );
  const problem = swapProblem(
    curriculum,
    confirmedIds,
    recommendedIds,
    fromId,
    toId,
    acknowledgeScience,
  );
  if (problem) return { problem, terms };
  const replacement = curriculum.terms
    .flatMap((term) => term.selectionGroups.flatMap((group) => group.courses))
    .find((course) => course.id === toId);
  if (!replacement) return { problem: '교체할 과목을 찾을 수 없어요.', terms };
  return {
    problem: null,
    terms: withUnselectedGroups(
      curriculum,
      terms.map((term) => ({
        ...term,
        recommendedCourses: term.recommendedCourses.map((item) =>
          item.course.id === fromId
            ? { ...item, course: replacement, note: source === 'counseling' ? '상담 후 직접 선택' : undefined }
            : item,
        ),
      })),
    ),
  };
}
