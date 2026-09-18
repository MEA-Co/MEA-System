import { normalizeCourseName, type PriorityProfile } from './recommendations';

const specializedCourses = new Set(['경제수학'].map(normalizeCourseName));

// 2022 curriculum: these science convergence electives do not report rank grades.
// https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=97551
const scienceConvergenceCourses = new Set(
  ['과학의 역사와 문화', '기후변화와 환경생태', '융합과학 탐구'].map(normalizeCourseName),
);

export function isUnrankedScienceConvergence(name: string) {
  return scienceConvergenceCourses.has(normalizeCourseName(name));
}

// Domain membership alone does not justify recommending specialized applications.
export function allowsDomainRecommendation(
  name: string,
  profile: PriorityProfile | null,
) {
  const normalized = normalizeCourseName(name);
  if (!specializedCourses.has(normalized)) return true;
  return (
    !!profile &&
    [
      ...profile.core,
      ...profile.subCore,
      ...(profile.recommendCourses ?? []),
      ...(profile.coreChoices ?? []).flatMap((rule) => rule.courses),
    ].some((candidate) => normalizeCourseName(candidate) === normalized)
  );
}

export function withinTierPreference(
  name: string,
  profile: PriorityProfile | null,
) {
  const normalized = normalizeCourseName(name);
  return profile?.withinTierPreferences?.find((preference) =>
    preference.courses.some(
      (candidate) => normalizeCourseName(candidate) === normalized,
    ),
  );
}
