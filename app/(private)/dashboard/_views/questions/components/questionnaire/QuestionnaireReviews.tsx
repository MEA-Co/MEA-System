import type { QuestionnaireReviewContext } from '../../lib/questionnaire/types';
import { QuestionReviews } from '../question/QuestionReviews';
export function QuestionnaireReviews({
  questionId,
  questionnaireId,
  disabled,
  canRequest,
}: QuestionnaireReviewContext & { questionId?: string }) {
  return questionId ? (
    <QuestionReviews
      questionId={questionId}
      questionnaireId={questionnaireId}
      disabled={disabled}
      allowRequest={canRequest}
    />
  ) : null;
}
