import { questionFromField } from '../field-question';
import type { QuestionBlockField } from '../question-blocks';
import { validTypedAnswer } from '../question-types';
import type { PreviewAnswerRow } from '../reference-rows';
import { richTextPlainText } from '../rich-text';

/** Existing stored questions may still allow the legacy supplementary text. */
export function responseFieldAnswered(
  field: QuestionBlockField,
  value: string,
) {
  return field.kind === 'text'
    ? !!richTextPlainText(value).trim()
    : validTypedAnswer(
        {
          ...questionFromField(field),
          choiceAllowText: field.choiceAllowText ?? false,
          ...(field.scaleConfig ? { scaleConfig: field.scaleConfig } : {}),
        },
        value,
        true,
      );
}

/** Rows reported by the preview to following questions use the submission predicate. */
export function answeredResponseRows(
  fields: QuestionBlockField[],
  rows: PreviewAnswerRow[],
) {
  return rows.filter((row) =>
    fields.some((field) =>
      responseFieldAnswered(field, row.answers[field.id] ?? ''),
    ),
  );
}
