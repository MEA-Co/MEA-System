import { courseDescriptor } from './course-selection-utils';
import type { ConfirmedCurriculum, CurriculumCourse } from './curriculum';

// 2022 curriculum, general high school credit allocation (creative activities excluded).
// https://www.ice.go.kr/upload/hakjeom/na/bbs_1573/2026/06/20f2fb1e1f2f4396a728f79d994a7750.pdf
export function basicCreditKind(course: CurriculumCourse): 'basic' | 'other' | 'activity' | 'unknown' {
  const { domain } = courseDescriptor(course);
  const normalized = domain?.replaceAll(/[\s()·/]/g, '') ?? '';
  if (/창의적체험|창체/.test(normalized + course.name)) return 'activity';
  if (/^(국어|수학|영어)/.test(normalized)) return 'basic';
  const name = course.name.replaceAll(/\s/g, '');
  if (/^(공통|기본)?(국어|수학|영어)[12ⅠⅡ]*$/.test(name) || /^(대수|확률과통계|미적분[ⅠⅡ12]*|기하|문학|독서|화법과언어|독서와작문|영어독해와작문)$/.test(name)) return 'basic';
  if (/사회|한국사|과학|체육|예술|음악|미술|기술|가정|정보|외국어|한문|교양/.test(normalized)) return 'other';
  return 'unknown';
}

export function basicCreditStatus(curriculum: ConfirmedCurriculum, courses: readonly CurriculumCourse[], projectVacancies = false) {
  const unique = [...new Map(courses.map((course) => [course.id, course])).values()];
  let basicCredits = 0;
  let totalCredits = 0;
  let unknown = 0;
  for (const course of unique) {
    const kind = basicCreditKind(course);
    if (kind === 'activity') continue;
    if (course.credit === null || !Number.isFinite(course.credit) || course.credit <= 0) { unknown++; continue; }
    totalCredits += course.credit;
    if (kind === 'basic') basicCredits += course.credit;
    if (kind === 'unknown') unknown++;
  }
  if (projectVacancies) {
    const ids = new Set(unique.map((course) => course.id));
    for (const term of curriculum.terms) for (const group of term.selectionGroups) {
      const remaining = Math.max(0, group.choose - group.courses.filter((course) => ids.has(course.id)).length);
      const credits = group.courses.filter((course) => !ids.has(course.id)).map((course) =>
        basicCreditKind(course) === 'activity' ? 0 : Math.max(0, course.credit ?? 0),
      ).sort((a, b) => a - b);
      totalCredits += credits.slice(0, remaining).reduce((sum, credit) => sum + credit, 0);
    }
  }
  const applicable = curriculum.targetCohort === null || curriculum.targetCohort >= 2025;
  const limit = 81 + Math.max(0, totalCredits - 174) / 2;
  return { basicCredits, totalCredits, limit, unknown, priorMissing: !curriculum.priorRequiredCourses.length, applicable, exceeded: applicable && basicCredits > limit };
}

export function basicCreditProblem(curriculum: ConfirmedCurriculum, before: readonly CurriculumCourse[], after: readonly CurriculumCourse[], projectVacancies = false) {
  const previous = basicCreditStatus(curriculum, before, projectVacancies);
  const next = basicCreditStatus(curriculum, after, projectVacancies);
  if (!next.applicable) return null;
  // Permit reductions to repair an already invalid imported/fixed plan.
  if (next.exceeded && next.basicCredits - next.limit >= previous.basicCredits - previous.limit)
    return `국어·수학·영어 합계가 ${next.basicCredits}학점으로 상한 ${next.limit}학점을 넘어요. 다른 교과 과목을 선택해 주세요.`;
  if (next.unknown && next.basicCredits > previous.basicCredits)
    return '학점 또는 교과 분류가 미확인인 과목이 있어 국어·수학·영어 상한을 확인할 수 없어요. 편제표 정보를 먼저 확인해 주세요.';
  return null;
}
