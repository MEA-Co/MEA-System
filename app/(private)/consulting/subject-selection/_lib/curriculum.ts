import type { ImportResult } from '@/features/subject-selection/schema';

import type { SubjectSelectionTermId } from './subjects';

export type CurriculumCourse = {
  id: string;
  name: string;
  credit: number | null;
  domain: string | null;
  description: string | null;
};

export type CurriculumSelectionGroup = {
  id: string;
  name: string;
  choose: number;
  courses: CurriculumCourse[];
  rule: string | null;
};

export type CurriculumTerm = {
  id: SubjectSelectionTermId;
  label: string;
  requiredCourses: CurriculumCourse[];
  selectionGroups: CurriculumSelectionGroup[];
};

export type ConfirmedCurriculum = {
  schoolName: string;
  currentGrade: 1 | 2 | 3 | null;
  targetCohort: number | null;
  track: string | null;
  priorRequiredCourses: CurriculumCourse[];
  terms: CurriculumTerm[];
  linkedRules: string[];
  source: 'manual' | 'schoolinfo' | 'upload';
};

const curriculumTerms = [
  { grade: 2, semester: 1, id: 'grade-2-semester-1', label: '2-1' },
  { grade: 2, semester: 2, id: 'grade-2-semester-2', label: '2-2' },
  { grade: 3, semester: 1, id: 'grade-3-semester-1', label: '3-1' },
  { grade: 3, semester: 2, id: 'grade-3-semester-2', label: '3-2' },
] as const satisfies ReadonlyArray<{
  grade: number;
  semester: number;
  id: SubjectSelectionTermId;
  label: string;
}>;

export function curriculumFromImport(
  result: ImportResult,
): ConfirmedCurriculum {
  const calculatedGrade = new Date().getFullYear() - result.targetCohort + 1;
  const currentGrade =
    calculatedGrade >= 1 && calculatedGrade <= 3
      ? (calculatedGrade as 1 | 2 | 3)
      : null;

  return {
    schoolName: result.school,
    currentGrade,
    targetCohort: result.targetCohort,
    track: result.track?.trim() || null,
    source: result.source.url ? 'schoolinfo' : 'upload',
    linkedRules: result.linked_rules.map((rule) => rule.rule_raw),
    priorRequiredCourses: result.curriculum
      .filter((row) => row.grade === 1 && row.type === 'school_required')
      .map((row, index) => ({
        id: `grade-1-import-required-${index + 1}`,
        name: row.subject,
        credit: row.credit,
        domain: row.subject_group ?? null,
        description: null,
      })),
    terms: curriculumTerms.map((term) => {
      const rows = result.curriculum.filter(
        (row) => row.grade === term.grade && row.semester === term.semester,
      );
      const groups = result.selection_groups.filter(
        (group) =>
          group.grade === term.grade && group.semester === term.semester,
      );
      const groupIds = new Set(groups.map((group) => group.id));
      const requiredRows = rows.filter(
        (row) =>
          row.type === 'school_required' &&
          (!row.selection_group || !groupIds.has(row.selection_group)),
      );
      const remainingRows = rows.filter(
        (row) =>
          !requiredRows.includes(row) &&
          (!row.selection_group || !groupIds.has(row.selection_group)),
      );
      const toCourse = (subject: string, id: string): CurriculumCourse => {
        const row = rows.find((candidate) => candidate.subject === subject);
        return {
          id,
          name: subject,
          credit: row?.credit ?? null,
          domain: row?.subject_group ?? null,
          description: null,
        };
      };
      const selectionGroups = groups.map((group, groupIndex) => ({
        id: `${term.id}-import-group-${groupIndex + 1}`,
        name: group.name.trim() || `선택군 ${groupIndex + 1}`,
        choose: Math.max(1, Math.min(group.choose ?? 1, group.subjects.length)),
        rule: group.rule_raw.trim() || null,
        courses: group.subjects.map((subject, courseIndex) =>
          toCourse(
            subject,
            `${term.id}-import-group-${groupIndex + 1}-course-${courseIndex + 1}`,
          ),
        ),
      }));

      if (remainingRows.length) {
        selectionGroups.push({
          id: `${term.id}-import-unclassified`,
          name: '선택군 확인 필요',
          choose: 1,
          rule: '원문에서 선택군 연결이 확인되지 않은 과목입니다.',
          courses: remainingRows.map((row, index) =>
            toCourse(
              row.subject,
              `${term.id}-import-unclassified-course-${index + 1}`,
            ),
          ),
        });
      }

      return {
        id: term.id,
        label: term.label,
        requiredCourses: requiredRows.map((row, index) =>
          toCourse(row.subject, `${term.id}-import-required-${index + 1}`),
        ),
        selectionGroups,
      };
    }),
  };
}
