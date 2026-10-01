import type { QuestionnaireSection } from './questionnaire/types';
import type { QuestionBlockRow } from './question-blocks';
import type { PreviewAnswerRow } from './reference-rows';

export type QuestionResponseSnapshot = {
  id: string;
  definitionToken: string;
  sourceDeleted: boolean;
  revision: number;
  status: 'in_progress' | 'submitted';
  savedAt: string | null;
  title: string;
  sections: QuestionnaireSection[];
  questions: {
    responseId: string;
    versionId: string;
    definition: QuestionBlockRow;
    rows: PreviewAnswerRow[];
    activeRowIds: number[];
    needsReview: boolean;
    previousBody: string;
    previousDefinition: QuestionBlockRow;
    previousResponses: {
      definition: QuestionBlockRow;
      body: string;
      rows: PreviewAnswerRow[];
      savedAt: string;
    }[];
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
      q.needsReview ? [] : q.rows,
    ]),
  );
}
