import { z } from 'zod';

const term = {
  grade: z.number().int().min(1).max(3),
  semester: z.number().int().min(1).max(2),
};
const text = z.string().max(2000);
export const extractionSchema = z.object({
  table_found: z.boolean(),
  table_title: text.nullable(),
  cohort: z.number().int().min(2000).max(2100).nullable(),
  cohort_evidence: text.nullable(),
  structure_clear: z.boolean(),
  curriculum: z
    .array(
      z.object({
        ...term,
        subject: z.string().min(1).max(120),
        subject_group: text.nullable(),
        credit: z.number().min(0).max(40).nullable(),
        type: z.enum(['school_required', 'student_choice', 'unknown']),
        selection_group: text.nullable(),
        evidence: text,
      }),
    )
    .max(1000),
  selection_groups: z
    .array(
      z.object({
        ...term,
        id: z.string().min(1).max(120),
        name: text,
        choose: z.number().int().min(0).max(100).nullable(),
        from: z.number().int().min(0).max(100).nullable(),
        subjects: z.array(z.string().min(1).max(120)).max(100),
        rule_raw: text,
        simple_count: z.boolean(),
      }),
    )
    .max(100),
  linked_rules: z
    .array(
      z.object({
        rule_type: z.enum([
          'same_subject_across_semesters',
          'prerequisite',
          'other',
        ]),
        selection_group_ids: z.array(text).max(100),
        rule_raw: text,
      }),
    )
    .max(100),
  totals: z
    .array(
      z.object({
        ...term,
        credit: z.number().min(0).max(100),
        scope: z.enum(['subjects_only', 'including_activities', 'unknown']),
        evidence: text,
      }),
    )
    .max(30),
  warnings: z.array(text).max(100),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type School = { id: string; name: string; address: string };
export type Attachment = {
  id: string;
  name: string;
  url: string;
  score: number;
};
export type ImportContext = {
  school: string;
  cohort: number;
  sourceYear: number;
  track?: string;
};
export type ImportResult = Extraction &
  Omit<ImportContext, 'cohort'> & {
    targetCohort: number;
    status: 'verified' | 'review_required' | 'failed';
    source: {
      name: string;
      url: string | null;
      format: string;
      sha256: string;
    };
    validation: {
      cohort_match: boolean;
      selection_group_match: boolean;
      credit_sum_match: boolean;
      issues: string[];
      terms: {
        grade: number;
        semester: number;
        calculated: number | null;
        reported: number | null;
        matches: boolean;
      }[];
    };
  };

export function validateExtraction(
  data: Extraction,
  expectedCohort: number,
  parserWarnings: string[] = [],
) {
  const issues = [...parserWarnings, ...data.warnings];
  const cohortMatch =
    data.cohort === expectedCohort && Boolean(data.cohort_evidence?.trim());
  if (!data.table_found)
    issues.push('원문에서 교육과정 편제표를 찾지 못했습니다.');
  if (!cohortMatch)
    issues.push('대상 입학년도와 원문 코호트를 확인해야 합니다.');
  if (!data.structure_clear)
    issues.push('표의 학년·학기 또는 병합셀 구조가 불명확합니다.');
  if (!data.table_title?.trim()) issues.push('편제표 제목 근거가 없습니다.');
  if (!data.curriculum.length) issues.push('추출된 과목이 없습니다.');
  const seen = new Set<string>();
  for (const row of data.curriculum) {
    const key = `${row.grade}:${row.semester}:${row.subject.replace(/\s+/g, '')}`;
    if (seen.has(key))
      issues.push(`중복 과목: ${row.grade}-${row.semester} ${row.subject}`);
    seen.add(key);
    if (row.credit === null || row.type === 'unknown' || !row.evidence.trim())
      issues.push(
        `${row.grade}-${row.semester} ${row.subject}: 학점·필수 여부·원문 근거 확인 필요`,
      );
  }
  const ids = new Set<string>();
  let groupMatch = true;
  for (const group of data.selection_groups) {
    const rows = data.curriculum.filter(
      (r) =>
        r.selection_group === group.id &&
        r.grade === group.grade &&
        r.semester === group.semester,
    );
    const names = new Set(group.subjects);
    if (
      ids.has(group.id) ||
      !names.size ||
      names.size !== group.subjects.length ||
      group.from === null ||
      group.from !== names.size ||
      group.choose === null ||
      group.choose > names.size ||
      !group.simple_count ||
      !group.rule_raw.trim() ||
      rows.length !== names.size ||
      rows.some((r) => !names.has(r.subject) || r.type !== 'student_choice')
    ) {
      groupMatch = false;
      issues.push(`${group.name}: 선택군 구성 또는 택 N 조건 확인 필요`);
    }
    ids.add(group.id);
  }
  for (const row of data.curriculum) {
    const group = data.selection_groups.find(
      (g) =>
        g.id === row.selection_group &&
        g.grade === row.grade &&
        g.semester === row.semester,
    );
    if (
      (row.type === 'student_choice' && !group) ||
      (row.type !== 'student_choice' && row.selection_group !== null)
    ) {
      groupMatch = false;
      issues.push(`${row.subject}: 선택군 연결 확인 필요`);
    }
  }
  for (const rule of data.linked_rules) {
    if (
      !rule.rule_raw.trim() ||
      rule.selection_group_ids.some((id) => !ids.has(id))
    )
      issues.push(
        '학기 간 연동 조건의 원문 또는 선택군 연결을 확인해야 합니다.',
      );
  }
  const terms: ImportResult['validation']['terms'] = [];
  // Count required courses plus choose-N credits, never every elective candidate.
  for (let grade = 1; grade <= 3; grade++)
    for (let semester = 1; semester <= 2; semester++) {
      const rows = data.curriculum.filter(
        (r) => r.grade === grade && r.semester === semester,
      );
      if (!rows.length) continue;
      const groups = data.selection_groups.filter(
        (g) => g.grade === grade && g.semester === semester,
      );
      let calculable =
        new Set(rows.map((r) => r.subject.replace(/\s+/g, ''))).size ===
          rows.length &&
        rows.every(
          (r) =>
            r.credit !== null &&
            r.type !== 'unknown' &&
            (r.type === 'school_required'
              ? r.selection_group === null
              : groups.some((g) => g.id === r.selection_group)),
        );
      let sum = rows
        .filter((r) => r.type === 'school_required')
        .reduce((a, r) => a + (r.credit ?? 0), 0);
      for (const group of groups) {
        const members = rows.filter((r) => r.selection_group === group.id);
        const credits = new Set(members.map((r) => r.credit));
        if (
          !group.simple_count ||
          group.choose === null ||
          group.choose > group.subjects.length ||
          members.length !== group.subjects.length ||
          members.some(
            (r) =>
              r.type !== 'student_choice' ||
              !group.subjects.includes(r.subject),
          ) ||
          new Set(group.subjects).size !== group.subjects.length ||
          groups.filter((g) => g.id === group.id).length !== 1 ||
          credits.size !== 1 ||
          credits.has(null)
        )
          calculable = false;
        else sum += (credits.values().next().value ?? 0) * group.choose;
      }
      const totals = data.totals.filter(
        (t) =>
          t.grade === grade &&
          t.semester === semester &&
          t.scope === 'subjects_only' &&
          t.evidence.trim(),
      );
      const reported = totals.length === 1 ? totals[0].credit : null;
      const matches =
        calculable && reported !== null && Math.abs(sum - reported) < 0.001;
      terms.push({
        grade,
        semester,
        calculated: calculable ? sum : null,
        reported,
        matches,
      });
      if (!matches)
        issues.push(
          `${grade}-${semester}: 교과 학점 총계 대조 ${reported === null ? '근거 없음' : '불일치 또는 계산 불가'}`,
        );
    }
  for (const [grade, semester] of [
    [2, 1],
    [2, 2],
    [3, 1],
    [3, 2],
  ]) {
    if (!terms.some((t) => t.grade === grade && t.semester === semester))
      issues.push(`${grade}-${semester}: 학기 자료가 없습니다.`);
  }
  const creditMatch = terms.length > 0 && terms.every((t) => t.matches);
  return {
    status: (!data.table_found || !data.curriculum.length
      ? 'failed'
      : issues.length
        ? 'review_required'
        : 'verified') as ImportResult['status'],
    validation: {
      cohort_match: cohortMatch,
      selection_group_match: groupMatch,
      credit_sum_match: creditMatch,
      issues: [...new Set(issues)],
      terms,
    },
  };
}
