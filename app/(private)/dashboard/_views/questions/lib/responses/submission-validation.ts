import { flowRowLabel } from '../flow-rows';
import type { QuestionBlockRow } from '../question-blocks';
import type { QuestionResponseSnapshot } from '../question-responses';
import { placementPreviewState } from '../questionnaire/placement-preview';
import type { PreviewAnswerRow } from '../reference-rows';

import { responseFieldAnswered as answered } from './field-validation';

export type SubmissionIssue = {
  questionId: string;
  rowId?: number;
  fieldId?: string;
  message: string;
};
/** Validate one active question. Completion rules mirror the DB save workflow;
 * the DB remains authoritative and still checks every direct API submission. */
export function validateQuestionSubmission(
  definition: QuestionBlockRow,
  rows: PreviewAnswerRow[],
  referenceRows?: PreviewAnswerRow[],
): { issues: SubmissionIssue[]; activeRows: PreviewAnswerRow[] } {
  const issues: SubmissionIssue[] = [];
  const activeRows: PreviewAnswerRow[] = [];
  const fields = definition.fields;
  const rule = definition.response_requirements;
  const layout = definition.answer_layout ?? 'cards';
  let counted = 0;
  const add = (message: string, rowId?: number, fieldId?: string) =>
    issues.push({ questionId: definition.id, rowId, fieldId, message });
  for (const [index, row] of rows.entries()) {
    if (referenceRows && !referenceRows.some((source) => source.id === row.id))
      continue;
    const values = fields.map((field) =>
      answered(field, row.answers[field.id] ?? ''),
    );
    const hasAnswer = values.some(Boolean);
    const label =
      layout === 'flow'
        ? flowRowLabel(row, definition.row_labels)
        : row.label?.trim() ||
          definition.row_labels?.[index]?.trim() ||
          `항목 ${index + 1}`;
    for (const field of fields) {
      if ((row.answers[field.id] ?? '').length > 20000)
        add(
          `${label} · ${field.label}: 답변은 20,000자 이내로 입력해 주세요.`,
          row.id,
          field.id,
        );
    }
    if (!rule) {
      for (const field of fields) {
        const value = row.answers[field.id] ?? '';
        if (field.kind !== 'text' && value.trim() && !answered(field, value))
          add(
            `${label} · ${field.label}: 선택 또는 직접 입력 내용을 완성해 주세요.`,
            row.id,
            field.id,
          );
      }
    }
    // Empty spare table/flow rows do not count toward the minimum and do not
    // require every field; a partially answered table row does.
    if ((layout === 'table' || layout === 'flow') && !hasAnswer) continue;
    counted++;
    if (row.flowAfter !== undefined && !row.label?.trim())
      add(`${label}: 추가한 시기의 이름을 입력해 주세요.`, row.id);
    if (!rule && layout !== 'flow') {
      for (const [fieldIndex, field] of fields.entries()) {
        if (
          field.required !== false &&
          !values[fieldIndex] &&
          !(field.kind !== 'text' && row.answers[field.id]?.trim())
        )
          add(
            `${label} · ${field.label}: 필수 답변을 입력해 주세요.`,
            row.id,
            field.id,
          );
      }
    }
    if (hasAnswer) activeRows.push(row);
  }
  if (rule) {
    const has = (id: string) => {
      const field = fields.find((field) => field.id === id);
      return (
        !!field &&
        activeRows.some((row) => answered(field, row.answers[id] ?? ''))
      );
    };
    if (!rule.startFieldIds.some(has))
      add(
        '고교 입학 전: 중등 또는 예비 고1 중 한 시기에 답변해 주세요.',
        undefined,
        rule.startFieldIds[0],
      );
    if (!has(rule.admissionFieldId))
      add(
        '고3 수시 원서 접수 시기에 답변해 주세요.',
        undefined,
        rule.admissionFieldId,
      );
  } else {
    const minimum =
      referenceRows?.length ??
      (definition.row_mode === 'repeatable' ? (definition.min_rows ?? 1) : 1);
    if (counted < minimum)
      add(
        `${layout === 'flow' ? '시기' : '항목'}를 ${minimum}개 이상 작성해 주세요. (현재 ${counted}개)`,
      );
  }
  return { issues, activeRows };
}

/** Process in questionnaire order, passing only active answered source rows to
 * later conditions. Retained inputs in hidden questions cannot activate others. */
export function validateResponseSubmission(
  snapshot: QuestionResponseSnapshot,
  answers: Record<string, PreviewAnswerRow[]>,
): SubmissionIssue[] {
  const active: Record<string, PreviewAnswerRow[]> = {};
  const library = snapshot.questions.map((q) => q.definition);
  return snapshot.questions.flatMap(({ definition }) => {
    if (definition.purpose === 'study_registration') return [];
    const state = placementPreviewState(definition, library, active);
    if (state.waiting) {
      active[definition.id] = [];
      return [];
    }
    const result = validateQuestionSubmission(
      definition,
      answers[definition.id] ?? [],
      definition.row_mode === 'reference' ? state.matchedRows : undefined,
    );
    active[definition.id] = result.activeRows;
    return result.issues;
  });
}
