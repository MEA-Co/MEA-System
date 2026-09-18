import {
  coreChoiceStatuses,
  type PriorityProfile,
} from '@/features/subject-selection/recommendations';

import { sameCourse } from './course-selection-utils';
import { compareAdvice, priority, type SwapReason } from './course-swap';
import type { CurriculumCourse } from './curriculum';
import { majorDepth } from './major-depth';

export type CounselingMajor = { department: string; profile: PriorityProfile };

export function combinedComparison(
  current: CurriculumCourse,
  candidate: CurriculumCourse,
  primary: CounselingMajor,
  secondary: CounselingMajor,
  completed: CurriculumCourse[],
  reason: SwapReason,
  confident: boolean,
) {
  const after = completed.map((course) =>
    course.id === current.id ? candidate : course,
  );
  const impacts = [primary, secondary].map(({ department, profile }) => {
    const beforeDepth = majorDepth(profile, completed);
    const afterDepth = majorDepth(profile, after);
    const lostCore = profile.core.filter(
      (name) =>
        completed.some((course) => sameCourse(course.name, name)) &&
        !after.some((course) => sameCourse(course.name, name)),
    );
    const beforeChoices = coreChoiceStatuses(profile, completed);
    const lostChoices = coreChoiceStatuses(profile, after).filter(
      (rule, index) => beforeChoices[index]?.satisfied && !rule.satisfied,
    );
    const currentRank = priority(current, profile);
    const candidateRank = priority(candidate, profile);
    const lostDepth = beforeDepth.depth.length > afterDepth.depth.length;
    // A small preference within the same tier is not a loss of preparation.
    const lowerTier =
      currentRank.label !== candidateRank.label &&
      currentRank.score > candidateRank.score;
    const weakened =
      !!lostCore.length || !!lostChoices.length || lostDepth || lowerTier;
    const insufficient =
      !!lostCore.length ||
      !!lostChoices.length ||
      (beforeDepth.sufficient && !afterDepth.sufficient);
    const message = `${department}: ${current.name}(${currentRank.label}) → ${candidate.name}(${candidateRank.label}). ${
      insufficient
        ? '교체하면 확보했던 코어 또는 심화 준비 기준이 부족해져요.'
        : lostDepth
          ? '전공 심화를 보여줄 과목이 줄어들어요.'
          : weakened
            ? '이 학과 기준에서는 전공 관련 과목의 우선순위가 낮아져요.'
            : '이 교체로 전공 준비 기준이 약해지는 항목은 확인되지 않았어요.'
    }`;
    return { department, weakened, insufficient, message };
  });
  const base = compareAdvice(
    current,
    candidate,
    primary.profile,
    reason,
    confident,
  );
  const caution = impacts.some((impact) => impact.weakened);
  return {
    ...base,
    verdict: caution ? '현재 과목 우선 추천' : base.verdict,
    explanation: caution
      ? `${primary.department}을 우선하되 ${secondary.department}도 함께 준비한다면 ${current.name} 유지 쪽을 추천해요.`
      : base.explanation,
    impacts,
    score:
      base.score +
      priority(candidate, secondary.profile).score * 0.5 -
      (caution ? 20 : 0),
  };
}
