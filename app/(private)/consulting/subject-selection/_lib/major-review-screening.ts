import {
  coreChoiceStatuses,
  type PriorityProfile,
} from '@/features/subject-selection/recommendations';

import { sameCourse } from './course-selection-utils';
import type { ConfirmedCurriculum } from './curriculum';
import { evaluateMajorDepth } from './major-depth';

export function screenMajorReview(
  curriculum: ConfirmedCurriculum,
  primary: PriorityProfile,
  secondary: PriorityProfile,
) {
  // Use offered courses, not only the incomplete current draft, for this preliminary screen.
  const offered = [
    ...curriculum.priorRequiredCourses,
    ...curriculum.terms.flatMap((term) => [
      ...term.requiredCourses,
      ...term.selectionGroups.flatMap((group) => group.courses),
    ]),
  ];
  const depth = evaluateMajorDepth(primary, secondary, offered, offered);
  const { shared, method } = depth;
  const unavailable = [
    ...new Set(
      [primary, secondary].flatMap((profile) => [
        ...profile.core.filter(
          (name) => !offered.some((course) => sameCourse(name, course.name)),
        ),
        ...coreChoiceStatuses(profile, offered)
          .filter((rule) => !rule.satisfied)
          .map((rule) => rule.label),
      ]),
    ),
  ];
  const reasons: string[] = [];
  if (!depth.connectionSupported)
    reasons.push(
      method.relationship
        ? `연구 방법의 접점은 있지만 편제에서 필요한 기반 과목을 확보하기 어려워요: ${method.groups
            .filter((group) => group.count < group.choose)
            .map((group) => `${group.label} ${group.count}/${group.choose}`)
            .join(', ')}.`
        : `학교 편제에서 두 전공의 코어·심화에 함께 연결되는 과목이 ${shared.length}개로 적어요. 각 전공의 기반을 따로 준비해야 할 가능성이 커요.`,
    );
  if (unavailable.length)
    reasons.push(
      `현재 편제와 1학년 지정 과목만으로 확보하기 어려운 코어가 있어요: ${unavailable.join(', ')}.`,
    );
  return {
    humanities: depth.humanities,
    method,
    worthReviewing: reasons.length === 0,
    sharedNames: shared.map((course) => course.name),
    reasons,
  };
}

export type MajorReviewScreening = ReturnType<typeof screenMajorReview>;
