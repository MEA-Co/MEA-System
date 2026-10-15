import {
  documentFromRow,
  type QuestionBlockDocument,
  type QuestionBlockRow,
} from './question-blocks';

/** Import a definition into a new draft, never its answers, ownership or history. */
export function copyQuestionContent(
  source: QuestionBlockRow,
  targetId: string,
): QuestionBlockDocument {
  if (source.purpose === 'study_registration')
    throw new Error('질문지 시작 안내는 불러올 수 없어요.');
  const document = structuredClone(documentFromRow(source));
  const fieldIds = new Map(
    document.fields.map((field) => [field.id, crypto.randomUUID()]),
  );
  return {
    ...document,
    responseRequirements: document.responseRequirements
      ? {
          kind: 'career_flow',
          startFieldIds: document.responseRequirements.startFieldIds.map((id) =>
            fieldIds.get(id)!,
          ) as [string, string],
          admissionFieldId: fieldIds.get(
            document.responseRequirements.admissionFieldId,
          )!,
        }
      : null,
    id: targetId,
    fields: document.fields.map((field) => ({
      ...field,
      id: fieldIds.get(field.id)!,
      ...(field.options
        ? {
            options: field.options.map((option) => ({
              ...option,
              id: crypto.randomUUID(),
            })),
          }
        : {}),
    })),
    details: document.details?.map((detail) => ({
      ...detail,
      id: crypto.randomUUID(),
    })),
    sourceBlockId: null,
    sourceFieldId: null,
    afterBlockId: null,
    condition: null,
    ...(document.rowMode === 'reference'
      ? {
          rowMode: 'single' as const,
          maxRows: null,
          minRows: 1,
          initialRows: 1,
          rowLabels: [],
          flowInsertAfter: [],
        }
      : {}),
  };
}
