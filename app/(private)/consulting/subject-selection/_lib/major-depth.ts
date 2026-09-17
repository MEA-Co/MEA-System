import {
  normalizeCourseName,
  type PriorityProfile,
} from '@/features/subject-selection/recommendations';
import {
  scienceAdvancedForAreas,
  scienceAreaForCourse,
} from '@/features/subject-selection/science-sequence';

import { sameCourse } from './course-selection-utils';
import type { CurriculumCourse } from './curriculum';

// MEA prototype thresholds, not university requirements or admissions probabilities.
export const MAJOR_DEPTH_POLICY = {
  minimumCourses: 2,
  primaryRetention: 0.75,
  sharedFoundation: 2,
};
const scienceBasics = ['물리학', '화학', '생명과학', '지구과학'];

export function majorDepthEvidence(
  profile: PriorityProfile,
  course: { name: string },
) {
  const core = [
    ...profile.core,
    ...(profile.coreChoices ?? []).flatMap((rule) => rule.courses),
  ];
  if (scienceBasics.some((name) => sameCourse(name, course.name))) return null;
  const area = scienceAreaForCourse(course.name);
  const sameArea = (name: string) =>
    scienceAreaForCourse(name)?.basic === area?.basic;
  if (area && core.some(sameArea)) return `${area.basic} 핵심 영역의 심화`;
  if (area && profile.subCore.some(sameArea))
    return `${area.basic} 보완 영역의 심화`;
  if (profile.subCore.some((name) => sameCourse(name, course.name)))
    return '학과 지정 Sub core';
  if (profile.recommendCourses?.some((name) => sameCourse(name, course.name)))
    return '학과 개별 지정 추천';
  return null;
}

export function majorDepth(
  profile: PriorityProfile,
  courses: readonly CurriculumCourse[],
) {
  const core = [
    ...profile.core,
    ...(profile.coreChoices ?? []).flatMap((rule) => rule.courses),
  ];
  const depthNames = [
    ...profile.subCore,
    ...(profile.recommendCourses ?? []),
    ...scienceAdvancedForAreas([...core, ...profile.subCore]),
  ].filter((name) => !scienceBasics.some((basic) => sameCourse(basic, name)));
  const unique = [
    ...new Map(
      courses.map((course) => [normalizeCourseName(course.name), course]),
    ).values(),
  ];
  const relatedDepth = unique.filter((course) =>
    depthNames.some((name) => sameCourse(name, course.name)),
  );
  const missingFoundation = relatedDepth.filter((course) => {
    const area = scienceAreaForCourse(course.name);
    return area && !unique.some((basic) => sameCourse(basic.name, area.basic));
  });
  const depth = relatedDepth.filter(
    (course) => !missingFoundation.includes(course),
  );
  const reserved = new Set(profile.core.map(normalizeCourseName));
  for (const rule of profile.coreChoices ?? []) {
    const available = unique.filter((course) =>
      rule.courses.some((name) => sameCourse(name, course.name)),
    );
    // Reserve only the minimum, satisfying any required sub-area first.
    if (rule.include) {
      const included = available.filter((course) =>
        rule.include!.courses.some((name) => sameCourse(name, course.name)),
      );
      const needed = Math.max(
        0,
        rule.include.choose -
          included.filter((course) =>
            reserved.has(normalizeCourseName(course.name)),
          ).length,
      );
      included
        .filter((course) => !reserved.has(normalizeCourseName(course.name)))
        .slice(0, needed)
        .forEach((course) => reserved.add(normalizeCourseName(course.name)));
    }
    const needed = Math.max(
      0,
      rule.choose -
        available.filter((course) =>
          reserved.has(normalizeCourseName(course.name)),
        ).length,
    );
    available
      .filter((course) => !reserved.has(normalizeCourseName(course.name)))
      .slice(0, needed)
      .forEach((course) => reserved.add(normalizeCourseName(course.name)));
  }
  const beyondCore = depth.filter(
    (course) => !reserved.has(normalizeCourseName(course.name)),
  );
  const minimum = Math.max(
    1,
    Math.min(
      MAJOR_DEPTH_POLICY.minimumCourses,
      new Set(depthNames.map(normalizeCourseName)).size,
    ),
  );
  return {
    depth,
    beyondCore,
    missingFoundation,
    evidence: depth.map((course) => ({
      course,
      reason: majorDepthEvidence(profile, course),
    })),
    minimum,
    sufficient: depth.length >= minimum && missingFoundation.length === 0,
  };
}

export function evaluateMajorDepth(
  primary: PriorityProfile,
  secondary: PriorityProfile,
  baseline: CurriculumCourse[],
  combined: CurriculumCourse[],
) {
  const first = majorDepth(primary, combined);
  const second = majorDepth(secondary, combined);
  const original = majorDepth(primary, baseline);
  const lost = original.depth.filter(
    (course) => !first.depth.some((item) => sameCourse(item.name, course.name)),
  );
  const retention = original.depth.length
    ? (original.depth.length - lost.length) / original.depth.length
    : null;
  const foundation = (
    profile: PriorityProfile,
    name: string,
    depth: ReturnType<typeof majorDepth>,
  ) =>
    profile.core.some((item) => sameCourse(item, name)) ||
    (profile.coreChoices ?? []).some((rule) =>
      rule.courses.some((item) => sameCourse(item, name)),
    ) ||
    depth.depth.some((item) => sameCourse(item.name, name));
  const shared = [
    ...new Map(
      combined
        .filter(
          (course) =>
            foundation(primary, course.name, first) &&
            foundation(secondary, course.name, second),
        )
        .map((course) => [normalizeCourseName(course.name), course]),
    ).values(),
  ];
  return {
    first,
    second,
    original,
    lost,
    retention,
    shared,
    supported:
      first.sufficient &&
      second.sufficient &&
      retention !== null &&
      retention >= MAJOR_DEPTH_POLICY.primaryRetention &&
      shared.length >= MAJOR_DEPTH_POLICY.sharedFoundation,
  };
}
