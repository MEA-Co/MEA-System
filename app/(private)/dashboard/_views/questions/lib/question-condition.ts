import type { QuestionBlockDocument } from './question-blocks';

export function clearQuestionCondition(
  document: QuestionBlockDocument,
): Partial<QuestionBlockDocument> {
  return {
    condition: null,
    sourceBlockId: null,
    sourceFieldId: null,
    afterBlockId: null,
    ...(document.rowMode === 'reference'
      ? { rowMode: 'single', maxRows: null, minRows: 1, initialRows: 1 }
      : {}),
  };
}
