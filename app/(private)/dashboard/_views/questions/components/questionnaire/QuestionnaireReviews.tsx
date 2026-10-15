import type { QuestionnaireReviewContext } from '../../lib/questionnaire/types';
import { QuestionReviews } from '../question/QuestionReviews';
export function QuestionnaireReviews({
  questionId,
  disabled,
}: QuestionnaireReviewContext & { questionId?: string }) {
  return questionId ? (
    <QuestionReviews questionId={questionId} disabled={disabled} />
  ) : null;
}
