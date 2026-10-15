import type { QuestionBlockRow } from '../question-blocks';
import type { QuestionDetail } from '../question-details';
import type { QuestionReview } from '../reviews/types';

import type { QuestionKind } from './question-types';

export type ScaleConfig = {
  max: number;
  low: string;
  middle: string;
  high: string;
  allowText: boolean;
};

export type { QuestionDetail } from '../question-details';

export type Question = {
  sourceQuestionId?: string;
  kind?: QuestionKind;
  choiceStyle?: 'list' | 'chip';
  choiceAllowText?: boolean;
  options?: { id: string; label: string; isOther?: boolean }[];
  scaleConfig?: ScaleConfig;
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

export type QuestionnaireStartNotice = {
  title: string;
  body: string;
  buttonLabel: string;
  explorationButtonLabel?: string;
};

export type QuestionnaireDocument = {
  startNotice?: QuestionnaireStartNotice | null;
  questionnaireId: string;
  title: string;
  sections: QuestionnaireSection[];
};

export type QuestionnaireDraft = QuestionnaireDocument & {
  revision: number;
  savedAt: string | null;
};

export type SaveQuestionnaireRequest = {
  confirmedRemovedGuideQuestions?: string[];
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

export type QuestionnaireStatus = 'draft' | 'in_review' | 'published';
export type QuestionnaireListItem = {
  creatorName?: string | null;
  submittedResponseCount?: number;
  responseStatus?: string | null;
  id: string;
  title: string;
  status: QuestionnaireStatus;
  updatedAt: string;
  reviewStartedAt: string | null;
  publishedAt: string | null;
  revision: number;
  hasPublished: boolean;
  archivedAt?: string | null;
  isOwner: boolean;
  canEditDraft?: boolean;
  canDelete: boolean;
  pendingReviewCount: number;
  unreadReviewCount?: number;
};
export type QuestionnaireReviewContext = {
  questionnaireId: string;
  isOwner: boolean;
  initialReviews: QuestionReview[];
  disabled?: boolean;
};

export type QuestionnaireViewData = {
  sharedSources?: QuestionBlockRow[];
  list?: QuestionnaireListPage;
  staff: boolean;
  selected: QuestionnaireListItem | null;
  reviews: QuestionReview[];
  pendingReviewCount?: number;
  initialDraft: QuestionnaireDraft | null;
  sharedDocument: QuestionnaireDraft | null;
};

export type QuestionnaireListPage = {
  groups: {
    status: QuestionnaireStatus;
    total: number;
    items: QuestionnaireListItem[];
  }[];
  total: number;
  page: number;
  pages: number;
  items: QuestionnaireListItem[];
  responseCounts?: { pending: number; complete: number };
};
