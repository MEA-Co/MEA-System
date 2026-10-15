export type QuestionReview = {
  id: string;
  question_id: string;
  origin_questionnaire_id?: string | null;
  question_revision?: number;
  title: string;
  requester_name: string;
  description: string;
  created_at: string;
  resolved_at: string | null;
};
export type QuestionReviewPage = {
  reviews: QuestionReview[];
  canResolve: boolean;
  canRequest: boolean;
  unreadIds: string[];
  pendingCount: number;
  completedCount: number;
  page: number;
  hasMore: boolean;
};
