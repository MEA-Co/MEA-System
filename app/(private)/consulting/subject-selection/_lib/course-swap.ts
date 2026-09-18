import {
  allowsDomainRecommendation,
  isUnrankedScienceConvergence,
  withinTierPreference,
} from '@/features/subject-selection/course-priority-policy';
import {
  courseMatchesSchoolRequirement,
  schoolCourseRequirements,
} from '@/features/subject-selection/graduation';
import {
  courseDomainMatches,
  findUniversityMatches,
  type PriorityProfile,
} from '@/features/subject-selection/recommendations';
import {
  scienceSequenceGaps,
  scienceSequenceMessage,
} from '@/features/subject-selection/science-sequence';
import { universityRuleStatus } from '@/features/subject-selection/university-status';

import { basicCreditProblem } from './basic-credit-limit';
import {
  courseDescriptor,
  graduationAreaForCourse,
  graduationAreaRequirements,
  sameCourse,
} from './course-selection-utils';
import type { ConfirmedCurriculum, CurriculumCourse } from './curriculum';

export type SwapReason = 'neutral' | 'interest' | 'grades';

export function priority(
  course: CurriculumCourse,
  profile: PriorityProfile | null,
) {
  const tieBonus = withinTierPreference(course.name, profile) ? 0.5 : 0;
  if (profile?.subCore.some((name) => sameCourse(name, course.name)))
    return { score: 6 + tieBonus, label: 'Sub core' };
  const domain = courseDescriptor(course).domain;
  if (
    profile?.recommendCourses?.some((name) => sameCourse(name, course.name)) ||
    (domain &&
      allowsDomainRecommendation(course.name, profile) &&
      profile?.recommendDomains.some((item) =>
        courseDomainMatches(item, domain),
      ))
  )
    return { score: 4 + tieBonus, label: '추천 과목군' };
  return { score: 2, label: '기타 과목' };
}

export function compareAdvice(
  current: CurriculumCourse,
  candidate: CurriculumCourse,
  profile: PriorityProfile | null,
  reason: SwapReason,
  confident: boolean,
) {
  // These weights rank advice, never permission or university admissions outcomes.
  const currentPriority = priority(current, profile);
  const candidatePriority = priority(candidate, profile);
  const currentSubCore = currentPriority.label === 'Sub core';
  const candidateSubCore = candidatePriority.label === 'Sub core';
  const bonus =
    reason === 'interest'
      ? 2
      : reason === 'grades'
          ? confident
            ? 2
            : 0
          : 0;
  const difference =
    priority(candidate, profile).score +
    bonus -
    priority(current, profile).score;
  let verdict =
    difference > 1
      ? '교체 추천'
      : difference < -1
        ? '현재 과목 우선 추천'
        : '둘 다 가능';
  let explanation =
    difference > 1
      ? `${candidate.name}을 더 추천해요. 기본 우선순위와 학생이 선택한 비교 이유를 함께 반영한 결과예요.`
      : difference < -1
        ? `전공 기본 경로에서는 ${current.name}을 먼저 추천해요. 다만 차이를 이해하고 ${candidate.name}을 선택해도 됩니다.`
        : `두 선택 모두 가능해요. 전공 기본 우선순위와 본인의 관심·부담 중 무엇을 더 중요하게 볼지 결정해 주세요.`;
  if (currentSubCore || candidateSubCore) {
    verdict = currentSubCore === candidateSubCore
      ? '둘 다 가능'
      : candidateSubCore ? '교체 추천' : '현재 과목 우선 추천';
    explanation = currentSubCore && candidateSubCore
      ? '두 과목 모두 전공 학습을 보완하는 Sub core로 강하게 추천해요. 조금 부담되더라도 수강을 추천하며, 둘 중에서는 관심 방향과 실제 학습 부담을 비교해 선택해 주세요.'
      : `${currentSubCore ? current.name : candidate.name}은 전공 학습을 보완하는 Sub core라 강하게 추천해요. 조금 부담되더라도 듣는 것을 추천하지만, 필수로 잠기는 과목은 아니므로 실제 학업 부담을 고려한 최종 선택은 학생에게 있어요.`;
  } else if (reason === 'grades') {
    const convergence = isUnrankedScienceConvergence(current.name)
      && courseDescriptor(candidate).selectionType === 'career'
      ? current
      : isUnrankedScienceConvergence(candidate.name)
          && courseDescriptor(current).selectionType === 'career'
        ? candidate : null;
    if (convergence) {
      verdict = '둘 다 가능';
      explanation = `전공 기본 우선순위와 별개로, 성적 부담이 있다면 과학 융합선택인 ${convergence.name}을 고르는 것도 괜찮은 선택이에요. 2022 개정 교육과정에서 이 과목은 상대평가 석차등급을 기재하지 않지만, 성취도 평가는 있으며 수업이 더 쉽거나 대입에 더 유리하다는 뜻은 아니에요. 실제 평가 방식과 학습량을 확인하고 선택해 주세요.`;
    }
  }
  return {
    verdict,
    explanation,
    score: priority(candidate, profile).score + bonus,
  };
}

export function allocatedCourses(
  curriculum: ConfirmedCurriculum,
  ids: readonly string[],
) {
  const selected = new Set(ids);
  return [
    ...curriculum.priorRequiredCourses,
    ...curriculum.terms.flatMap((term) => [
      ...term.requiredCourses,
      ...term.selectionGroups.flatMap((group) =>
        group.courses.filter((course) => selected.has(course.id)),
      ),
    ]),
  ];
}

export function swapProblem(
  curriculum: ConfirmedCurriculum,
  confirmedIds: readonly string[],
  recommendedIds: readonly string[],
  fromId: string,
  toId: string,
  acknowledgeScience = false,
  compensationIds: readonly string[] = [],
): string | null {
  if (!recommendedIds.includes(fromId) || confirmedIds.includes(fromId))
    return '2단계 선택 과목만 변경할 수 있어요.';
  const term = curriculum.terms.find((item) =>
    item.selectionGroups.some((group) =>
      group.courses.some((course) => course.id === fromId),
    ),
  );
  const group = term?.selectionGroups.find((item) =>
    item.courses.some((course) => course.id === fromId),
  );
  const from = group?.courses.find((course) => course.id === fromId);
  const to = group?.courses.find((course) => course.id === toId);
  if (!term || !from || !to)
    return '같은 학기·선택군 안에서만 교체할 수 있어요.';
  const ids = [...confirmedIds, ...recommendedIds];
  const before = allocatedCourses(curriculum, ids);
  if (
    before.some(
      (course) =>
        course.id === toId ||
        (course.id !== fromId && sameCourse(course.name, to.name)),
    )
  )
    return '이미 선택했거나 이수한 과목이에요.';
  if (
    from.credit === null ||
    to.credit === null ||
    !Number.isFinite(from.credit) ||
    from.credit <= 0 ||
    from.credit !== to.credit
  )
    return '초안에서는 학점이 확인된 동일 학점 과목끼리 교체할 수 있어요.';
  const after = allocatedCourses(curriculum, [
    ...ids.map((id) => (id === fromId ? toId : id)),
    ...compensationIds,
  ]);
  const previousGaps = scienceSequenceGaps(before);
  const creditProblem = basicCreditProblem(curriculum, before, after);
  if (creditProblem) return creditProblem;
  const newGaps = scienceSequenceGaps(after).filter(
    (gap) =>
      !previousGaps.some((previous) => previous.advanced === gap.advanced),
  );
  if (newGaps.length && !acknowledgeScience)
    return `${scienceSequenceMessage(newGaps)} 기초 과목을 먼저 반영하거나, 연결된 심화 과목을 먼저 교체해 주세요.`;
  return requirementDeficits(curriculum, before, after)[0]?.message ?? null;
}

export function requirementDeficits(
  curriculum: ConfirmedCurriculum,
  before: CurriculumCourse[],
  after: CurriculumCourse[],
) {
  const deficits: { missing: number; message: string }[] = [];
  for (const area of graduationAreaRequirements) {
    const credits = (courses: CurriculumCourse[]) =>
      courses
        .filter((course) => graduationAreaForCourse(course) === area.id)
        .reduce((total, course) => total + (course.credit ?? 0), 0);
    const missing =
      Math.min(credits(before), area.minimumCredit) - credits(after);
    if (missing > 0)
      deficits.push({
        missing,
        message: `${area.label} 이수조건이 부족해지는 교체예요.`,
      });
  }
  for (const requirement of schoolCourseRequirements(curriculum.linkedRules)) {
    const scopedIds = new Set(
      curriculum.terms
        .filter(
          (item) =>
            !requirement.grade ||
            item.label === `${requirement.grade}-${requirement.semester}`,
        )
        .flatMap((item) => [
          ...item.requiredCourses,
          ...item.selectionGroups.flatMap((selection) => selection.courses),
        ])
        .map((course) => course.id),
    );
    const count = (courses: CurriculumCourse[]) =>
      courses.filter(
        (course) =>
          scopedIds.has(course.id) &&
          courseMatchesSchoolRequirement(courseDescriptor(course), requirement),
      ).length;
    // The replacement has another id, but still belongs to the same scoped group.
    const missing =
      Math.min(count(before), requirement.minimumCourses) - count(after);
    if (missing > 0)
      deficits.push({
        missing,
        message: `${requirement.label} 학교 이수조건을 유지하는 과목을 골라 주세요.`,
      });
  }
  return deficits;
}

export function universityChanges(
  curriculum: ConfirmedCurriculum,
  ids: readonly string[],
  fromId: string,
  candidate: CurriculumCourse,
  department: string,
  profile: PriorityProfile | null,
) {
  const before = allocatedCourses(curriculum, ids);
  const after = before.map((course) =>
    course.id === fromId ? candidate : course,
  );
  return findUniversityMatches(department, profile?.id ?? null).flatMap(
    (university) =>
      university.rules.flatMap((rule) => {
        const previous = universityRuleStatus(
          rule,
          before.map(courseDescriptor),
        );
        const next = universityRuleStatus(rule, after.map(courseDescriptor));
        const target = next.target;
        if (
          previous.count === next.count &&
          previous.satisfied === next.satisfied
        )
          return [];
        return [
          `${university.university} ${rule.category === 'core' ? '핵심' : '권장'}: ${previous.count}/${target} → ${next.count}/${target} (${next.satisfied ? '충족' : '부족'}) · ${rule.note}`,
        ];
      }),
  );
}
