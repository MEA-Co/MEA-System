import type {
  QuestionBlockClause,
  QuestionBlockField,
} from './question-blocks';
import type { PreviewAnswerRow } from './reference-rows';

export function supportsChoiceCondition(field: QuestionBlockField): boolean {
  return (
    (field.kind === 'single' || field.kind === 'multiple') &&
    !!field.options?.length &&
    !field.options.some((option) => option.isOther)
  );
}

export function matchingChoiceRows(
  rows: PreviewAnswerRow[],
  clause: QuestionBlockClause,
  fields: QuestionBlockField[],
): PreviewAnswerRow[] {
  const field = fields.find((item) => item.id === clause.fieldId);
  if (
    !field ||
    !supportsChoiceCondition(field) ||
    typeof clause.value !== 'string' ||
    !field.options?.some((option) => option.id === clause.value) ||
    clause.op !== (field.kind === 'single' ? 'equals' : 'includes')
  )
    return [];
  return rows.filter((row) => {
    const value = row.answers[field.id] ?? '';
    if (!value.trim()) return false;
    let decoded: unknown = value;
    try {
      decoded = JSON.parse(value);
    } catch {
      /* Legacy single-choice IDs are plain strings. */
    }
    if (
      decoded &&
      typeof decoded === 'object' &&
      !Array.isArray(decoded) &&
      'choices' in decoded
    )
      decoded = decoded.choices;
    const choices = Array.isArray(decoded) ? decoded : [decoded];
    return (
      choices.length > 0 &&
      (field.kind === 'multiple' || choices.length === 1) &&
      new Set(choices).size === choices.length &&
      choices.every(
        (choice) =>
          typeof choice === 'string' &&
          field.options?.some((option) => option.id === choice),
      ) &&
      choices.includes(clause.value)
    );
  });
}
