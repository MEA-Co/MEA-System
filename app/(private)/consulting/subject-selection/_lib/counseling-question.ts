import type { PriorityProfile } from '@/features/subject-selection/recommendations';

import {
  catalogCourseFor,
  courseDescriptor,
  sameCourse,
} from './course-selection-utils';
import { allocatedCourses, priority, swapProblem } from './course-swap';
import type { ConfirmedCurriculum, CurriculumCourse } from './curriculum';

export type CounselingIntent = 'compare' | 'consider' | 'omit';
export const counselingTemplates: { id: CounselingIntent; label: string }[] = [
  { id: 'compare', label: '두 과목 중 고민이에요' },
  { id: 'omit', label: '추천 과목 중, 이 과목 안 듣고 싶어요' },
  { id: 'consider', label: '미선택 과목 중, 이 과목 듣고 싶어요' },
];

export function suggestsReducingScience(detail: string) {
  const text = detail.replaceAll(/\s/g, '');
  if (/줄이고싶지않|줄일생각없|부담없|어렵지않/.test(text)) return false;
  return (
    /과학/.test(text) &&
    (/과학(?:과목)?(?:수|개수|비중).*(?:줄이|줄였|적게)/.test(text) ||
      /과학.*(?:[2-9두세네몇여러]+과목|너무많).*(?:어려|어렵|부담|힘들)/.test(
        text,
      ))
  );
}

export function isScienceCourse(course: CurriculumCourse) {
  return (courseDescriptor(course).domain ?? '').includes('과학');
}

export function counselingCandidates(
  eligible: CurriculumCourse[],
  profile: PriorityProfile | null,
  explicitId: string,
  reduceScience: boolean,
  removedCourses: readonly CurriculumCourse[] = [],
  candidateScore?: (course: CurriculumCourse) => number,
) {
  const explicit = eligible.find((course) => course.id === explicitId);
  const automatic = eligible
    .filter(
      (course) =>
        course.id !== explicitId &&
        !removedCourses.some((removed) =>
          sameCourse(removed.name, course.name),
        ) &&
        (!reduceScience || !isScienceCourse(course)),
    )
    .sort((a, b) => (candidateScore?.(b) ?? priority(b, profile).score) - (candidateScore?.(a) ?? priority(a, profile).score));
  return [...(explicit ? [explicit] : []), ...automatic].slice(0, 2);
}

export function removedCourseIds(history: readonly Record<string, string>[]) {
  const removed = new Set<string>();
  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1];
    for (const [original, replacement] of Object.entries(history[index])) {
      const from = previous[original] ?? original;
      if (from !== replacement) removed.add(from);
    }
  }
  return removed;
}

export function questionOptions(
  curriculum: ConfirmedCurriculum,
  confirmedIds: string[],
  recommendedIds: string[],
  targetId: string,
) {
  const entries = curriculum.terms.flatMap((term) =>
    term.selectionGroups.flatMap((group) =>
      group.courses.map((course) => ({ course, group, term })),
    ),
  );
  const completed = allocatedCourses(curriculum, [
    ...confirmedIds,
    ...recommendedIds,
  ]);
  const chosen = entries.filter(
    (item) =>
      recommendedIds.includes(item.course.id) &&
      !confirmedIds.includes(item.course.id),
  );
  const unselected = entries.filter(
    (item) =>
      !completed.some((course) => sameCourse(course.name, item.course.name)),
  );
  const replacements = chosen.filter(
    (item) =>
      !swapProblem(
        curriculum,
        confirmedIds,
        recommendedIds,
        item.course.id,
        targetId,
        true,
      ),
  );
  return { chosen, unselected, replacements };
}

export function courseQuestionSummary(
  course: CurriculumCourse,
  profile: PriorityProfile | null,
) {
  const rank = priority(course, profile);
  const isCore = profile?.core.some((name) => sameCourse(name, course.name));
  const isCoreOption = profile?.coreChoices?.some((choice) =>
    choice.courses.some((name) => sameCourse(name, course.name)),
  );
  const recommendation = isCore
    ? '메아의 필수 코어에 해당하는 과목이에요. 이미 다른 학기에 반영되어 있는지 먼저 확인하고, 빠져 있다면 1단계 선택도 확인해 주세요.'
    : isCoreOption
      ? '필수 코어 선택군의 후보예요. 이 과목 자체가 무조건 필수라는 뜻은 아니며, 1단계에서 확정한 선택군 조건을 유지하면서 판단해야 해요.'
      : rank.label === 'Sub core'
        ? '전공 관련 학습을 보완하는 Sub core라 강하게 추천해요. 조금 부담되더라도 듣는 것을 추천해요. 다만 필수 코어처럼 선택이 고정되지는 않으며, 실제 학업 부담을 고려한 최종 결정은 학생에게 있어요.'
        : rank.label === '추천 과목군'
          ? '전공의 추천 과목군에 해당해요. 관련 분야를 넓히는 선택이지만, 이 과목 하나가 반드시 필수인 것은 아니에요.'
          : '현재 전공의 필수 코어나 우선 추천 과목에는 해당하지 않아요. 관심과 탐구 방향에 도움이 된다면 선택할 수 있고, 다른 과목을 고려할 수도 있어요.';
  const catalog = catalogCourseFor(course);
  return {
    recommendation,
    content: catalog?.coreArea
      ? `주요 영역: ${catalog.coreArea}`
      : course.description || catalog?.description || null,
  };
}
