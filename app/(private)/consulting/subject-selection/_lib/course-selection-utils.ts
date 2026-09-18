import { allowsDomainRecommendation } from '@/features/subject-selection/course-priority-policy';
import {
  courseDomainMatches,
  normalizeCourseName,
  type PriorityProfile,
  ruleMatchesCourse,
  type UniversityMatch,
} from '@/features/subject-selection/recommendations';
import { universityRuleStatus } from '@/features/subject-selection/university-status';

import type {
  CurriculumCourse,
  CurriculumSelectionGroup,
  CurriculumTerm,
} from './curriculum';
import { subjectSelectionCourses } from './subjects';

export type CourseOccurrence = {
  course: CurriculumCourse;
  term: CurriculumTerm;
  group: CurriculumSelectionGroup | null;
  required: boolean;
};

export type CourseTag = {
  id: string;
  label: string;
  description?: string;
  kind:
    | 'core'
    | 'sub-core'
    | 'internal'
    | 'university-core'
    | 'university'
    | 'graduation';
};

export type GraduationAreaId = 'arts' | 'integrated';

export type GraduationAreaRequirement = {
  id: GraduationAreaId;
  label: string;
  minimumCredit: number;
};

export const graduationAreaRequirements: GraduationAreaRequirement[] = [
  { id: 'arts', label: '예술', minimumCredit: 10 },
  {
    id: 'integrated',
    label: '기술·가정·정보·제2외국어·한문·교양',
    minimumCredit: 16,
  },
];

const catalogByName = new Map<
  string,
  (typeof subjectSelectionCourses)[number]
>();
for (const course of subjectSelectionCourses) {
  const key = normalizeCourseName(course.name);
  if (!catalogByName.has(key)) catalogByName.set(key, course);
}

export function catalogCourseFor(course: CurriculumCourse) {
  return catalogByName.get(normalizeCourseName(course.name));
}

export function courseDescriptor(course: CurriculumCourse) {
  const catalogCourse = catalogCourseFor(course);
  return {
    name: course.name,
    domain: course.domain || catalogCourse?.domain || null,
    selectionType: catalogCourse?.selectionType || null,
  };
}

export function sameCourse(left: string, right: string) {
  return normalizeCourseName(left) === normalizeCourseName(right);
}

export function courseCredit(course: CurriculumCourse) {
  return typeof course.credit === 'number' && Number.isFinite(course.credit)
    ? Math.max(0, course.credit)
    : null;
}

export function creditLabel(credit: number | null) {
  return credit === null ? '학점 미확인' : `${credit}학점`;
}

export function graduationAreaForCourse(
  course: CurriculumCourse,
): GraduationAreaId | null {
  const descriptor = courseDescriptor(course);
  const domain = descriptor.domain?.replaceAll(/\s+/g, '') ?? '';
  const name = normalizeCourseName(course.name);

  if (
    domain.includes('예술') ||
    domain.includes('음악') ||
    domain.includes('미술')
  ) {
    return 'arts';
  }
  if (/기술가정|정보|제2외국어|외국어|한문|교양/.test(domain)) {
    return 'integrated';
  }
  if (/미술|음악|예술/.test(name)) return 'arts';
  if (
    /정보|인공지능|소프트웨어|데이터|기술|가정|한문|중국어|일본어|스페인어|외국어|교양|보건|진로|생태|철학|심리|종교/.test(
      name,
    )
  ) {
    return 'integrated';
  }
  return null;
}

function universityTagStatuses(
  matches: UniversityMatch[],
  completedCourses: readonly CurriculumCourse[],
) {
  const completed = completedCourses.map(courseDescriptor);
  return new Map(
    matches.map((match) => [
      match,
      new Map(
        match.rules.map((rule) => [
          rule,
          universityRuleStatus(rule, completed),
        ]),
      ),
    ]),
  );
}

export function createCourseTagger(
  profile: PriorityProfile | null,
  matches: UniversityMatch[],
  completed: readonly CurriculumCourse[],
) {
  const statuses = universityTagStatuses(matches, completed);
  return (course: CurriculumCourse) =>
    getCourseTags(course, profile, matches, [], completed, statuses);
}

export function getCourseTags(
  course: CurriculumCourse,
  profile: PriorityProfile | null,
  universityMatches: UniversityMatch[],
  graduationNeeds: GraduationAreaRequirement[] = [],
  completedCourses?: readonly CurriculumCourse[],
  preparedStatuses?: ReturnType<typeof universityTagStatuses>,
) {
  const statuses =
    preparedStatuses ??
    (completedCourses
      ? universityTagStatuses(universityMatches, completedCourses)
      : undefined);
  const tags: CourseTag[] = [];
  const descriptor = courseDescriptor(course);
  const isCore = profile?.core.some((name) => sameCourse(name, course.name));
  const isSubCore = profile?.subCore.some((name) =>
    sameCourse(name, course.name),
  );

  if (isCore) {
    tags.push({ id: 'core', label: '필수 Core', kind: 'core' });
  } else if (isSubCore) {
    tags.push({ id: 'sub-core', label: '서브코어', kind: 'sub-core' });
  } else if (
    profile &&
    (profile.recommendCourses?.some((name) => sameCourse(name, course.name)) ||
      (descriptor.domain &&
        allowsDomainRecommendation(course.name, profile) &&
        profile.recommendDomains.some((domain) =>
          courseDomainMatches(domain, descriptor.domain!),
        )))
  ) {
    tags.push({ id: 'internal', label: '추천 과목군', kind: 'internal' });
  }

  for (const match of universityMatches) {
    const matchStatuses = statuses?.get(match);
    const universitySatisfied = matchStatuses
      ? [...matchStatuses.values()].every((status) => status.satisfied)
      : false;
    const matchingRules = match.rules.filter((rule) => {
      if (!ruleMatchesCourse(rule, descriptor)) return false;
      // Keep candidate membership stable; only callers rendering tags supply completion.
      if (!matchStatuses || (rule.choose === undefined && !rule.domain))
        return true;
      const status = matchStatuses.get(rule)!;
      // Tag visibility only; do not turn autonomous guidance into a university requirement.
      if (
        match.university === '연세대' &&
        rule.domain === '과학' &&
        rule.selectionType === 'general' &&
        rule.choose === undefined &&
        status.target === 0 &&
        !rule.requiredCourses?.length
      )
        return status.count === 0;
      // An unrestricted domain is guidance, not an invented course-count requirement.
      if (status.target === 0 && !rule.requiredCourses?.length)
        return !universitySatisfied;
      return !status.satisfied;
    });
    if (!matchingRules.length) continue;
    const category = matchingRules.some((rule) => rule.category === 'core')
      ? 'core'
      : 'recommended';
    const individuallyRecommended = matchingRules.some(
      (rule) =>
        (rule.choose === undefined && !rule.domain) ||
        rule.requiredCourses?.some((name) => sameCourse(name, course.name)),
    );
    tags.push({
      id: `${match.university}-${category}`,
      label: `${match.university} ${category === 'core' ? '핵심' : '권장'}${individuallyRecommended ? '' : ' 후보'}`,
      description: matchingRules.map((rule) => rule.note).join(' · '),
      kind: category === 'core' ? 'university-core' : 'university',
    });
  }

  const graduationNeed = graduationNeeds.find(
    (requirement) => graduationAreaForCourse(course) === requirement.id,
  );
  if (graduationNeed) {
    tags.push({
      id: `graduation-${graduationNeed.id}`,
      label: `${graduationNeed.label} 이수 필요`,
      kind: 'graduation',
    });
  }
  return tags;
}
