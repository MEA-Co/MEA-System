import type { QuestionBlockField } from './question-blocks';
import { DEFAULT_SCALE_CONFIG } from './question-types';
import type { Question } from './types';

export function questionFromField(field: QuestionBlockField): Question {
  return {
    id: field.id,
    logicalKey: field.id,
    text: '',
    details: [],
    kind: field.kind,
    options: field.options ?? [],
    choiceStyle: field.choiceStyle,
    choiceAllowText: false,
    scaleConfig:
      field.kind === 'scale'
        ? {
            ...(field.scaleConfig ?? {
              ...DEFAULT_SCALE_CONFIG,
              max: field.scaleMax ?? 5,
            }),
            allowText: false,
          }
        : undefined,
  };
}
