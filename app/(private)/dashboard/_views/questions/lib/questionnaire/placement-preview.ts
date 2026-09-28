import { questionFromField } from '../field-question';
import type {
  QuestionBlockClause,
  QuestionBlockField,
  QuestionBlockRow,
} from '../question-blocks';
import {
  choiceAnswerId,
  choiceAnswerValue,
  scaleAnswer,
  validTypedAnswer,
} from '../question-types';
import type { PreviewAnswerRow } from '../reference-rows';
import { richTextPlainText } from '../rich-text';

function answered(field: QuestionBlockField, value: string) {
  return field.kind === 'text'
    ? !!richTextPlainText(value).trim()
    : validTypedAnswer(questionFromField(field), value, true);
}

function matches(
  row: PreviewAnswerRow,
  clause: QuestionBlockClause,
  question: QuestionBlockRow,
) {
  const field = question.fields.find((f) => f.id === clause.fieldId);
  if (clause.op === 'answered') {
    const fields = clause.fieldId ? (field ? [field] : []) : question.fields;
    return (
      fields.length > 0 &&
      fields.every((f) => answered(f, row.answers[f.id] ?? ''))
    );
  }
  if (!field) return false;
  const value = row.answers[field.id] ?? '';
  if (!answered(field, value)) return false;
  if (field.kind === 'scale') {
    const score = scaleAnswer(value).score;
    if (score === null || typeof clause.value !== 'number') return false;
    return clause.op === 'gte'
      ? score >= clause.value
      : clause.op === 'lte'
        ? score <= clause.value
        : clause.op === 'equals' && score === clause.value;
  }
  if (field.kind === 'text')
    return (
      clause.op === 'equals' &&
      richTextPlainText(value).trim() === String(clause.value ?? '')
    );
  const choices = choiceAnswerValue(
    value,
    field.kind === 'multiple',
  ).choices.map(choiceAnswerId);
  return (
    (clause.op === 'equals' || clause.op === 'includes') &&
    choices.includes(String(clause.value))
  );
}

export function placementPreviewState(
  question: QuestionBlockRow,
  library: QuestionBlockRow[],
  answers: Record<string, PreviewAnswerRow[]>,
) {
  const clauses = question.condition?.clauses ?? [];
  const all = question.condition?.mode !== 'any';
  const matchedBySource = new Map<string, PreviewAnswerRow[]>();
  for (const id of new Set(clauses.map((clause) => clause.blockId))) {
    const source = library.find((q) => q.id === id);
    const sourceClauses = clauses.filter((c) => c.blockId === id);
    matchedBySource.set(
      id,
      source
        ? (answers[id] ?? []).filter((row) =>
            all
              ? sourceClauses.every((c) => matches(row, c, source))
              : sourceClauses.some((c) => matches(row, c, source)),
          )
        : [],
    );
  }
  const conditionMet =
    !clauses.length ||
    (all
      ? [...matchedBySource.values()].every((rows) => rows.length > 0)
      : [...matchedBySource.values()].some((rows) => rows.length > 0));
  const afterMet =
    !question.after_block_id || !!answers[question.after_block_id]?.length;
  let matchedRows: PreviewAnswerRow[] = [];
  if (question.source_block_id) {
    const source = library.find((q) => q.id === question.source_block_id);
    matchedRows =
      matchedBySource.get(question.source_block_id) ??
      answers[question.source_block_id] ??
      [];
    if (question.source_field_id) {
      const field = source?.fields.find(
        (f) => f.id === question.source_field_id,
      );
      matchedRows = field
        ? matchedRows.filter((row) =>
            answered(field, row.answers[field.id] ?? ''),
          )
        : [];
    }
  }
  return {
    waiting:
      !conditionMet ||
      !afterMet ||
      (question.row_mode === 'reference' && !matchedRows.length),
    matchedRows,
  };
}
