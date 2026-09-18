import {
  normalizeCourseName,
  type RecommendationRule,
  ruleMatchesCourse,
} from './recommendations';

export function universityRuleStatus(
  rule: RecommendationRule,
  courses: readonly Parameters<typeof ruleMatchesCourse>[1][],
) {
  const selectedNames = new Set(
    courses
      .filter((course) => ruleMatchesCourse(rule, course))
      .map((course) => normalizeCourseName(course.name)),
  );
  const target =
    rule.choose ?? new Set(rule.courses?.map(normalizeCourseName) ?? []).size;
  const missingNames = (rule.requiredCourses ?? []).filter(
    (name) => !selectedNames.has(normalizeCourseName(name)),
  );
  return {
    selectedNames,
    count: selectedNames.size,
    target,
    missingNames,
    satisfied: selectedNames.size >= target && !missingNames.length,
  };
}
