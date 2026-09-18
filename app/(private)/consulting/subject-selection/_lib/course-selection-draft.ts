import {
  allowsDomainRecommendation,
  withinTierPreference,
} from '@/features/subject-selection/course-priority-policy';
import {
  courseDomainMatches,
  normalizeCourseName,
  type PriorityProfile,
} from '@/features/subject-selection/recommendations';
import { scienceSequenceGaps } from '@/features/subject-selection/science-sequence';

import {
  basicCreditKind,
  basicCreditProblem,
  basicCreditStatus,
} from './basic-credit-limit';
import { courseDescriptor, sameCourse } from './course-selection-utils';
import type { ConfirmedCurriculum, CurriculumCourse } from './curriculum';

export type DraftCourse = {
  course: CurriculumCourse;
  groupName: string | null;
  note?: string;
};

export type StandardDraftTerm = {
  label: string;
  requiredCourses: CurriculumCourse[];
  confirmedCourses: DraftCourse[];
  recommendedCourses: DraftCourse[];
  unfilledCount: number;
  unselectedGroups: Array<{ id: string; name: string; courses: DraftCourse[] }>;
};

function standardCourseTierScore(
  course: CurriculumCourse,
  profile: PriorityProfile | null,
  planned: readonly CurriculumCourse[],
) {
  if (!profile) return 0;
  if (profile.subCore.some((name) => sameCourse(name, course.name))) return 400;
  const group = profile.draftRecommendationGroups?.find((rule) =>
    rule.courses.some((name) => sameCourse(name, course.name)),
  );
  const groupFilled =
    group &&
    new Set(
      planned
        .filter((selected) =>
          group.courses.some((name) => sameCourse(name, selected.name)),
        )
        .map((selected) => normalizeCourseName(selected.name)),
    ).size >= group.preferCount;
  if (
    !groupFilled &&
    profile.recommendCourses?.some((name) => sameCourse(name, course.name))
  )
    return 300;
  if (!allowsDomainRecommendation(course.name, profile)) return 0;

  const descriptor = courseDescriptor(course);
  if (
    descriptor.domain &&
    profile.recommendDomains.some((domain) =>
      courseDomainMatches(domain, descriptor.domain!),
    )
  )
    return 200;

  const relatedDomains = [...profile.core, ...profile.subCore]
    .map(
      (name) =>
        courseDescriptor({
          id: `profile-${name}`,
          name,
          credit: null,
          domain: null,
          description: null,
        }).domain,
    )
    .filter((domain): domain is string => Boolean(domain));
  if (
    descriptor.domain &&
    relatedDomains.some((domain) =>
      courseDomainMatches(domain, descriptor.domain!),
    )
  )
    return 100;
  return 0;
}

function standardCourseScore(
  course: CurriculumCourse,
  profile: PriorityProfile | null,
  planned: readonly CurriculumCourse[],
) {
  const tier = standardCourseTierScore(course, profile, planned);
  return (
    tier + (tier > 0 && withinTierPreference(course.name, profile) ? 25 : 0)
  );
}

export function buildStandardDraft(
  curriculum: ConfirmedCurriculum,
  confirmedCourseIds: readonly string[],
  profile: PriorityProfile | null,
  replacements: Record<string, string> = {},
  scoreCourse: (
    course: CurriculumCourse,
    planned: readonly CurriculumCourse[],
  ) => number = (course, planned) =>
    standardCourseScore(course, profile, planned),
) {
  const confirmedIds = new Set(confirmedCourseIds);
  const planned = [
    ...curriculum.priorRequiredCourses,
    ...curriculum.terms.flatMap((term) => [
      ...term.requiredCourses,
      ...term.selectionGroups.flatMap((group) =>
        group.courses.filter((course) => confirmedIds.has(course.id)),
      ),
    ]),
  ];
  const usedCourseNames = new Set(
    [
      ...curriculum.priorRequiredCourses,
      ...curriculum.terms.flatMap((term) => term.requiredCourses),
    ].map((course) => normalizeCourseName(course.name)),
  );

  for (const term of curriculum.terms) {
    for (const group of term.selectionGroups) {
      for (const course of group.courses) {
        if (confirmedIds.has(course.id))
          usedCourseNames.add(normalizeCourseName(course.name));
      }
    }
  }

  // Reserve free recommendation slots for prerequisites of already fixed advanced courses.
  const neededBasics = new Set(
    scienceSequenceGaps([...usedCourseNames].map((name) => ({ name }))).map(
      ({ basic }) => normalizeCourseName(basic),
    ),
  );

  const initialDraft = curriculum.terms.map((term) => {
    const confirmedCourses: DraftCourse[] = [];
    const recommendedCourses: DraftCourse[] = [];
    let unfilledCount = 0;

    for (const group of term.selectionGroups) {
      const confirmedInGroup = group.courses.filter((course) =>
        confirmedIds.has(course.id),
      );
      confirmedCourses.push(
        ...confirmedInGroup.map((course) => ({
          course,
          groupName: group.name,
        })),
      );

      const remainingCount = Math.max(
        group.choose - confirmedInGroup.length,
        0,
      );
      const candidates = group.courses
        .map((course, index) => ({ course, index }))
        .filter(
          ({ course }) =>
            !confirmedIds.has(course.id) &&
            !usedCourseNames.has(normalizeCourseName(course.name)),
        );
      const sortCandidates = () =>
        candidates.sort(
          (left, right) =>
            Number(neededBasics.has(normalizeCourseName(right.course.name))) -
              Number(neededBasics.has(normalizeCourseName(left.course.name))) ||
            scoreCourse(right.course, planned) -
              scoreCourse(left.course, planned) ||
            left.index - right.index,
        );

      let addedCount = 0;
      // Recheck after each pick so a newly selected basic can unlock its advanced courses.
      while (addedCount < remainingCount) {
        // Re-rank after a pick: one ethics course can satisfy the breadth preference.
        sortCandidates();
        const index = candidates.findIndex(
          ({ course }) =>
            !usedCourseNames.has(normalizeCourseName(course.name)) &&
            !basicCreditProblem(
              curriculum,
              planned,
              [...planned, course],
              true,
            ) &&
            scienceSequenceGaps([course]).every(({ basic }) =>
              usedCourseNames.has(normalizeCourseName(basic)),
            ),
        );
        if (index === -1) break;
        const [{ course }] = candidates.splice(index, 1);
        planned.push(course);
        recommendedCourses.push({
          course,
          groupName: group.name,
          note:
            profile?.draftRecommendationGroups?.find((group) =>
              group.courses.some((name) => sameCourse(name, course.name)),
            )?.reason ?? withinTierPreference(course.name, profile)?.reason,
        });
        usedCourseNames.add(normalizeCourseName(course.name));
        addedCount += 1;
      }
      unfilledCount += remainingCount - addedCount;
    }

    return {
      label: term.label,
      requiredCourses: term.requiredCourses,
      confirmedCourses,
      recommendedCourses,
      unfilledCount,
    };
  });
  const draft = initialDraft.map((term, index) => ({
    ...term,
    recommendedCourses: term.recommendedCourses.map((item) => {
      let course =
        curriculum.terms[index].selectionGroups
          .flatMap((group) => group.courses)
          .find((course) => course.id === replacements[item.course.id]) ??
        item.course;
      const after = planned.map((selected) =>
        selected.id === item.course.id ? course : selected,
      );
      if (basicCreditProblem(curriculum, planned, after, true))
        course = item.course;
      const plannedIndex = planned.findIndex(
        (selected) => selected.id === item.course.id,
      );
      if (plannedIndex >= 0) planned[plannedIndex] = course;
      return {
        ...item,
        course,
        note:
          profile?.draftRecommendationGroups?.find((group) =>
            group.courses.some((name) => sameCourse(name, course.name)),
          )?.reason ?? withinTierPreference(course.name, profile)?.reason,
      };
    }),
  }));
  // Vacancies may leave fewer credits than projected; never keep an over-limit recommendation.
  const actualCourses = () => [
    ...curriculum.priorRequiredCourses,
    ...draft.flatMap((term) => [
      ...term.requiredCourses,
      ...term.confirmedCourses.map((item) => item.course),
      ...term.recommendedCourses.map((item) => item.course),
    ]),
  ];
  while (basicCreditStatus(curriculum, actualCourses()).exceeded) {
    const removable = draft
      .flatMap((term) =>
        term.recommendedCourses
          .filter((item) => basicCreditKind(item.course) === 'basic')
          .map((item) => ({ term, item })),
      )
      .sort(
        (a, b) =>
          scoreCourse(a.item.course, planned) -
          scoreCourse(b.item.course, planned),
      )[0];
    if (!removable) break;
    removable.term.recommendedCourses =
      removable.term.recommendedCourses.filter(
        (item) => item !== removable.item,
      );
    removable.term.unfilledCount++;
  }
  return withUnselectedGroups(curriculum, draft);
}

export function withUnselectedGroups(
  curriculum: ConfirmedCurriculum,
  draft: Omit<StandardDraftTerm, 'unselectedGroups'>[],
): StandardDraftTerm[] {
  const allocated = [
    ...curriculum.priorRequiredCourses.map((course) => ({
      course,
      location: '1학년 기이수',
    })),
    ...draft.flatMap((term) => [
      ...term.requiredCourses.map((course) => ({
        course,
        location: `${term.label} 학교지정`,
      })),
      ...term.confirmedCourses.map(({ course }) => ({
        course,
        location: `${term.label} 확정`,
      })),
      ...term.recommendedCourses.map(({ course }) => ({
        course,
        location: `${term.label} 추천`,
      })),
    ]),
  ];
  const allocatedIds = new Set(allocated.map(({ course }) => course.id));
  return draft.map<StandardDraftTerm>((term, index) => ({
    ...term,
    unselectedGroups: curriculum.terms[index].selectionGroups.map((group) => ({
      id: group.id,
      name: group.name,
      courses: group.courses
        .filter((course) => !allocatedIds.has(course.id))
        .map((course) => {
          const elsewhere = allocated.find((item) =>
            sameCourse(item.course.name, course.name),
          );
          return {
            course,
            groupName: group.name,
            note: elsewhere
              ? `동일 과목이 ${elsewhere.location}에 반영되어 있어요.`
              : undefined,
          };
        }),
    })),
  }));
}
