import {
  courseDomainMatches,
  normalizeCourseName,
  type PriorityProfile,
} from '@/features/subject-selection/recommendations';
import { scienceSequenceGaps } from '@/features/subject-selection/science-sequence';

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

function standardCourseScore(
  course: CurriculumCourse,
  profile: PriorityProfile | null,
) {
  if (!profile) return 0;
  if (profile.subCore.some((name) => sameCourse(name, course.name))) return 400;
  if (profile.recommendCourses?.some((name) => sameCourse(name, course.name)))
    return 300;

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

export function buildStandardDraft(
  curriculum: ConfirmedCurriculum,
  confirmedCourseIds: readonly string[],
  profile: PriorityProfile | null,
  replacements: Record<string, string> = {},
  scoreCourse: (course: CurriculumCourse) => number = (course) =>
    standardCourseScore(course, profile),
) {
  const confirmedIds = new Set(confirmedCourseIds);
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
        )
        .sort(
          (left, right) =>
            Number(neededBasics.has(normalizeCourseName(right.course.name))) -
              Number(neededBasics.has(normalizeCourseName(left.course.name))) ||
            scoreCourse(right.course) - scoreCourse(left.course) ||
            left.index - right.index,
        );

      let addedCount = 0;
      // Recheck after each pick so a newly selected basic can unlock its advanced courses.
      while (addedCount < remainingCount) {
        const index = candidates.findIndex(
          ({ course }) =>
            !usedCourseNames.has(normalizeCourseName(course.name)) &&
            scienceSequenceGaps([course]).every(({ basic }) =>
              usedCourseNames.has(normalizeCourseName(basic)),
            ),
        );
        if (index === -1) break;
        const [{ course }] = candidates.splice(index, 1);
        recommendedCourses.push({ course, groupName: group.name });
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
    recommendedCourses: term.recommendedCourses.map((item) => ({
      ...item,
      course:
        curriculum.terms[index].selectionGroups
          .flatMap((group) => group.courses)
          .find((course) => course.id === replacements[item.course.id]) ??
        item.course,
    })),
  }));
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
