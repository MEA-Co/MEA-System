import type {
  QuestionnaireNotice,
  QuestionnaireSection,
} from './questionnaire/types';
import type { QuestionBlockRow } from './question-blocks';
import type { PreviewAnswerRow } from './reference-rows';

export type QuestionResponseSnapshot = {
  notices?: QuestionnaireNotice[];
  noticesToken?: string | null;
  id: string;
  definitionToken: string;
  sourceDeleted: boolean;
  revision: number;
  status: 'assigned' | 'in_progress' | 'submitted';
  stage?: 'in_review' | 'published';
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
    snapshot.questions.map((q) => [
      q.definition.id,
      q.definition.purpose === 'study_registration' ? [] : q.rows,
    ]),
  );
}

// A creator can change the layout before another user's draft reaches the DB.
// Keep that user's original flow visible instead of adopting an incompatible
// layout and truncating or reinterpreting their unsaved periods.
export function hasIncompatibleFlowDraft(
  current: Record<string, PreviewAnswerRow[]>,
  previous: QuestionResponseSnapshot,
  next: QuestionResponseSnapshot,
) {
  return previous.questions.some((old) => {
    if (old.definition.answer_layout !== 'flow') return false;
    const changed = next.questions.find(
      (question) =>
        question.definition.id === old.definition.id &&
        question.responseId === old.responseId,
    );
    if (!changed) return false;
    const count = (question: QuestionResponseSnapshot['questions'][number]) =>
      question.definition.row_mode === 'repeatable'
        ? (question.definition.max_rows ?? 1)
        : 1;
    if (
      changed.definition.answer_layout === 'flow' &&
      count(changed) === count(old)
    )
      return false;
    const local = current[old.definition.id] ?? [];
    return (
      JSON.stringify(local) !== JSON.stringify(old.rows) &&
      local.some(
        (row) =>
          row.flowAfter !== undefined ||
          !!row.label?.trim() ||
          Object.values(row.answers).some((value) => value.trim()),
      )
    );
  });
}

// Carry only still-existing fields with the same kind into the current guide layout.
export function mergeGuideResponseRows(
  current: Record<string, PreviewAnswerRow[]>,
  previous: QuestionResponseSnapshot,
  next: QuestionResponseSnapshot,
) {
  return Object.fromEntries(
    next.questions.map((question) => {
      if (question.definition.purpose === 'study_registration')
        return [question.definition.id, []];
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
        question.definition.answer_layout === 'flow' ||
        old.definition.answer_layout === 'flow'
          ? 20
          : question.definition.row_mode === 'single'
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
