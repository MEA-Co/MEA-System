export type QuestionDetail = {
  id: string;
  title: string;
  text: string;
  visibleToConsultants: boolean;
};

export type Question = {
  id: string;
  logicalKey: string;
  text: string;
  details: QuestionDetail[];
};

export type QuestionnaireSection = {
  id: string;
  title: string;
  questions: Question[];
};

export type QuestionnaireDocument = {
  questionnaireId: string;
  versionId: string;
  title: string;
  sections: QuestionnaireSection[];
};

export type QuestionnaireDraft = QuestionnaireDocument & {
  revision: number;
  savedAt: string | null;
};

export type SaveQuestionnaireRequest = {
  document: QuestionnaireDocument;
  expectedRevision: number;
  saveId: string;
};

export type SaveQuestionnaireResult =
  | { ok: true; revision: number; savedAt: string }
  | {
      ok: false;
      code: 'conflict' | 'forbidden' | 'invalid' | 'unavailable';
      error: string;
    };
