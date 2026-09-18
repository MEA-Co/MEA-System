import { sameCourse } from './course-selection-utils';
import { allocatedCourses, requirementDeficits } from './course-swap';
import type { ConfirmedCurriculum, CurriculumCourse } from './curriculum';

export type GraduationCompensation = {
  course: CurriculumCourse;
  term: string;
  group: string;
};

export function compensationProblem(
  curriculum: ConfirmedCurriculum,
  nextIds: string[],
  additions: GraduationCompensation[],
) {
  const used = allocatedCourses(curriculum, nextIds);
  for (const addition of additions) {
    const term = curriculum.terms.find((item) => item.label === addition.term);
    const group = term?.selectionGroups.find((item) =>
      item.courses.some((course) => course.id === addition.course.id),
    );
    const course = group?.courses.find(
      (item) => item.id === addition.course.id,
    );
    if (
      !group ||
      !course ||
      !Number.isFinite(course.credit) ||
      (course.credit ?? 0) <= 0
    )
      return '보충 과목의 편제와 학점을 확인해 주세요.';
    if (
      used.some(
        (item) => item.id === course.id || sameCourse(item.name, course.name),
      )
    )
      return '이미 이수하거나 선택한 과목은 보충할 수 없어요.';
    if (
      group.courses.filter((item) =>
        used.some((selected) => selected.id === item.id),
      ).length >= group.choose
    )
      return '보충 과목을 넣을 선택군의 빈자리가 없어요.';
    used.push(course);
  }
  return null;
}

// Search later semesters first, but backtrack when a choice cannot cover all deficits.
export function findGraduationCompensation(
  curriculum: ConfirmedCurriculum,
  beforeIds: string[],
  nextIds: string[],
  accept: (additions: GraduationCompensation[]) => boolean,
): GraduationCompensation[] | null {
  const before = allocatedCourses(curriculum, beforeIds);
  const candidates = [...curriculum.terms]
    .sort((a, b) => b.label.localeCompare(a.label))
    .flatMap((term) =>
      term.selectionGroups.flatMap((group) =>
        group.courses.map((course) => ({
          course,
          term: term.label,
          group: group.name,
        })),
      ),
    );
  let attempts = 0;
  const search = (
    additions: GraduationCompensation[],
    start: number,
  ): GraduationCompensation[] | null => {
    if (++attempts > 200) return null;
    const currentIds = [...nextIds, ...additions.map((item) => item.course.id)];
    const deficits = requirementDeficits(
      curriculum,
      before,
      allocatedCourses(curriculum, currentIds),
    );
    if (!deficits.length) return accept(additions) ? additions : null;
    const missing = deficits.reduce((total, item) => total + item.missing, 0);
    for (let index = start; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (compensationProblem(curriculum, currentIds, [candidate])) continue;
      const remaining = requirementDeficits(
        curriculum,
        before,
        allocatedCourses(curriculum, [...currentIds, candidate.course.id]),
      ).reduce((total, item) => total + item.missing, 0);
      if (remaining >= missing) continue;
      const result = search([...additions, candidate], index + 1);
      if (result) return result;
    }
    return null;
  };
  return search([], 0);
}
