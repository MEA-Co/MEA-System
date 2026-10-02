import type { QuestionnaireSection } from './questionnaire/types';
import type { QuestionBlockRow } from './question-blocks';
import type { PreviewAnswerRow } from './reference-rows';

export type QuestionResponseSnapshot = {
  id: string;
  definitionToken: string;
  sourceDeleted: boolean;
  revision: number;
  status: 'assigned' | 'in_progress' | 'submitted';
  stage?: 'published' | 'distributed';
  submittedAt?: string | null;
  hasUnsubmittedChanges?: boolean;
  savedAt: string | null;
  title: string;
  sections: QuestionnaireSection[];
  questions: {
    responseId: string;
    questionId: string;
    definition: QuestionBlockRow;
    rows: PreviewAnswerRow[];
    activeRowIds: number[];
  }[];
};
export type QuestionResponseSave = {
  answers: Record<string, PreviewAnswerRow[]>;
  revision: number;
  saveId: string;
  complete: boolean;
  definitionToken: string;
};
export function snapshotRows(snapshot: QuestionResponseSnapshot) {
  return Object.fromEntries(
    snapshot.questions.map((q) => [q.definition.id, q.rows]),
  );
}

// Carry only still-existing fields with the same kind into the current guide layout.
export function mergeGuideResponseRows(
  current: Record<string, PreviewAnswerRow[]>,
  previous: QuestionResponseSnapshot,
  next: QuestionResponseSnapshot,
) {
  return Object.fromEntries(
    next.questions.map((question) => {
      const old = previous.questions.find(
        (item) => item.definition.id === question.definition.id,
      );
      if (
        !old ||
        old.responseId !== question.responseId ||
        !current[question.definition.id]
      )
        return [question.definition.id, question.rows];
      const retained = new Set(
        question.definition.fields
          .filter((field) =>
            old.definition.fields.some(
              (prior) => prior.id === field.id && prior.kind === field.kind,
            ),
          )
          .map((field) => field.id),
      );
      const limit =
        question.definition.row_mode === 'single'
          ? 1
          : question.definition.row_mode === 'repeatable'
            ? (question.definition.max_rows ?? 20)
            : 20;
      return [
        question.definition.id,
        current[question.definition.id].slice(0, limit).map((row) => ({
          ...row,
          answers: Object.fromEntries(
            Object.entries(row.answers).filter(([field]) =>
              retained.has(field),
            ),
          ),
        })),
      ];
    }),
  );
}
