import type { QuestionBlockRow } from './question-blocks';
export type QuestionLibraryProps = {
  displayRole?: string;
  embedded?: {
    onPlace: (question: QuestionBlockRow) => void | Promise<void>;
    onCancel: () => void;
    questionId?: string;
    allowSharedEdit?: boolean;
    questionnaireId?: string;
    sharedSources?: QuestionBlockRow[];
    actionLabel?: string;
    onSaved?: (question: QuestionBlockRow) => void;
    paused?: boolean;
    onStateChange?: (state: { dirty: boolean; saving: boolean }) => void;
  };
};
