import { majorMethodRelationship } from '@/features/subject-selection/major-relationships';
import {
  coreChoiceStatuses,
  type PriorityProfile,
} from '@/features/subject-selection/recommendations';
import {
  scienceAreaForCourse,
  scienceSequenceGaps,
} from '@/features/subject-selection/science-sequence';

import {
  basicCreditKind,
  basicCreditProblem,
  basicCreditStatus,
} from './basic-credit-limit';
import {
  buildStandardDraft,
  withUnselectedGroups,
} from './course-selection-draft';
import { sameCourse } from './course-selection-utils';
import { allocatedCourses, priority } from './course-swap';
import type { ConfirmedCurriculum, CurriculumCourse } from './curriculum';
import { evaluateMajorDepth, majorDepthEvidence } from './major-depth';

export const PRIMARY_MAJOR_WEIGHT = 1.5;

export function buildCombinedMajorDraft(
  curriculum: ConfirmedCurriculum,
  confirmedIds: string[],
  primary: PriorityProfile,
  secondary: PriorityProfile,
  previousRecommendedIds: string[] = [],
) {
  const entries = curriculum.terms.flatMap((term, termIndex) =>
    term.selectionGroups.flatMap((group) =>
      group.courses.map((course) => ({ course, group, termIndex })),
    ),
  );
  let selected = new Set(confirmedIds);
  const has = (name: string) =>
    allocatedCourses(curriculum, [...selected]).some((course) =>
      sameCourse(course.name, name),
    );
  // A conservative first-fit proposal, not proof that no other timetable combination exists.
  const add = (name: string, latestTerm = Infinity): boolean => {
    if (has(name)) return true;
    for (const entry of entries.filter(
      (item) =>
        item.termIndex <= latestTerm && sameCourse(item.course.name, name),
    )) {
      const snapshot = new Set(selected);
      const prerequisites = scienceSequenceGaps([entry.course]);
      if (!prerequisites.every((gap) => add(gap.basic, entry.termIndex))) {
        selected = snapshot;
        continue;
      }
      if (
        entry.group.courses.filter((course) => selected.has(course.id)).length <
        entry.group.choose
      ) {
        const before = allocatedCourses(curriculum, [...selected]);
        if (
          basicCreditProblem(
            curriculum,
            before,
            [...before, entry.course],
            true,
          )
        ) {
          selected = snapshot;
          continue;
        }
        selected.add(entry.course.id);
        return true;
      }
      selected = snapshot;
    }
    return false;
  };
  const profiles = [primary, secondary];
  for (const profile of profiles) {
    profile.core.forEach((name) => add(name));
    for (const rule of profile.coreChoices ?? []) {
      for (const part of [rule.include, rule].filter(
        (item) => item !== undefined,
      )) {
        for (const name of part.courses) {
          if (part.courses.filter(has).length >= part.choose) break;
          add(name);
        }
      }
    }
  }
  const method = majorMethodRelationship(primary, secondary);
  for (const group of method?.groups ?? []) {
    for (const name of group.courses) {
      if (group.courses.filter(has).length >= group.choose) break;
      add(name);
    }
  }
  const additions = [...selected].filter((id) => !confirmedIds.includes(id));
  const score = (course: CurriculumCourse) => {
    const first = Math.max(
      priority(course, primary).score,
      scienceAreaForCourse(course.name) && majorDepthEvidence(primary, course)
        ? 6
        : 0,
    );
    const second = Math.max(
      priority(course, secondary).score,
      scienceAreaForCourse(course.name) && majorDepthEvidence(secondary, course)
        ? 6
        : 0,
    );
    return first * PRIMARY_MAJOR_WEIGHT + second;
  };
  let terms = buildStandardDraft(
    curriculum,
    [...selected],
    primary,
    {},
    score,
  ).map((term) => ({
    ...term,
    confirmedCourses: term.confirmedCourses.filter((item) =>
      confirmedIds.includes(item.course.id),
    ),
    recommendedCourses: [
      ...term.confirmedCourses
        .filter((item) => additions.includes(item.course.id))
        .map((item) => ({ ...item, note: '복수 학과 코어·선행 과목 검토안' })),
      ...term.recommendedCourses,
    ],
  }));
  // Recheck secondary-core additions after actual vacancies are known.
  while (
    basicCreditStatus(
      curriculum,
      allocatedCourses(curriculum, [
        ...confirmedIds,
        ...terms.flatMap((term) =>
          term.recommendedCourses.map((item) => item.course.id),
        ),
      ]),
    ).exceeded
  ) {
    const removable = terms
      .flatMap((term) =>
        term.recommendedCourses
          .filter((item) => basicCreditKind(item.course) === 'basic')
          .map((item) => ({ term, item })),
      )
      .sort((a, b) => score(a.item.course) - score(b.item.course))[0];
    if (!removable) break;
    removable.term.recommendedCourses =
      removable.term.recommendedCourses.filter(
        (item) => item !== removable.item,
      );
    removable.term.unfilledCount++;
  }
  terms = withUnselectedGroups(curriculum, terms);
  const recommended = terms.flatMap((term) =>
    term.recommendedCourses.map((item) => item.course),
  );
  const completed = allocatedCourses(curriculum, [
    ...confirmedIds,
    ...recommended.map((course) => course.id),
  ]);
  const coreNames = [primary, secondary].flatMap((profile) => [
    ...profile.core,
    ...(profile.coreChoices ?? []).flatMap((rule) => rule.courses),
  ]);
  const assess = (profile: PriorityProfile) => ({
    missing: profile.core.filter(
      (name) => !completed.some((course) => sameCourse(course.name, name)),
    ),
    choices: coreChoiceStatuses(profile, completed).filter(
      (rule) => !rule.satisfied,
    ),
    support: completed.filter(
      (course) =>
        entries.some((entry) => entry.course.id === course.id) &&
        !coreNames.some((name) => sameCourse(name, course.name)) &&
        priority(course, profile).score >= 4,
    ),
  });
  const assessments = [assess(primary), assess(secondary)];
  const missingCore = assessments.some(
    (item) => item.missing.length || item.choices.length,
  );
  const gaps = scienceSequenceGaps(completed);
  const baselineDraft = buildStandardDraft(curriculum, confirmedIds, primary);
  const baseline = allocatedCourses(curriculum, [
    ...confirmedIds,
    ...baselineDraft.flatMap((term) =>
      term.recommendedCourses.map((item) => item.course.id),
    ),
  ]);
  const depth = evaluateMajorDepth(primary, secondary, baseline, completed);
  const status =
    basicCreditStatus(curriculum, completed).exceeded ||
    missingCore ||
    gaps.length ||
    (depth.method.relationship && !depth.method.satisfied)
      ? 'review'
      : depth.supported
        ? 'both'
        : depth.humanities
          ? 'review'
          : 'focused';
  return {
    terms,
    assessments,
    status,
    gaps,
    depth,
    additions: recommended.filter((course) => additions.includes(course.id)),
    shared: completed.filter((course) => {
      const related = (profile: PriorityProfile) =>
        profile.core.some((name) => sameCourse(name, course.name)) ||
        (profile.coreChoices ?? []).some((rule) =>
          rule.courses.some((name) => sameCourse(name, course.name)),
        ) ||
        priority(course, profile).score >= 4;
      return related(primary) && related(secondary);
    }),
    displaced: entries
      .filter(
        ({ course }) =>
          previousRecommendedIds.includes(course.id) &&
          !recommended.some((item) => item.id === course.id),
      )
      .map(({ course }) => course),
  };
}
