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

export type QuestionnaireStatus = 'draft' | 'published' | 'distributed';
export type QuestionnaireListItem = {
  id: string;
  title: string;
  status: QuestionnaireStatus;
  updatedAt: string;
  publishedAt: string | null;
  distributedAt: string | null;
  revision: number;
  hasDistributed: boolean;
  isOwner: boolean;
  canDelete: boolean;
  pendingReviewCount: number;
};
export type QuestionnaireReview = {
  id: string;
  question_id: string | null;
  title: string;
  requester_name: string;
  description: string;
  created_at: string;
  resolved_at: string | null;
};

export type QuestionnaireReviewContext = {
  versionId: string;
  isOwner: boolean;
  initialReviews: QuestionnaireReview[];
  disabled?: boolean;
};

export type QuestionnaireViewData = {
  editableExplanationIds: string[];
  drafts: QuestionnaireListItem[];
  published: QuestionnaireListItem[];
  distributed: QuestionnaireListItem[];
  staff: boolean;
  selected: QuestionnaireListItem | null;
  reviews: QuestionnaireReview[];
  initialDraft: QuestionnaireDraft | null;
  publishedDocument: QuestionnaireDraft | null;
};
