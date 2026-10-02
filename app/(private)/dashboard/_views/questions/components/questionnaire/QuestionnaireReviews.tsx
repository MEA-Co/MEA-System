import type { QuestionnaireReviewContext } from '../../lib/questionnaire/types';
import { QuestionReviews } from '../question/QuestionReviews';
export function QuestionnaireReviews({
  questionId,
  versionId,
  disabled,
  canRequest,
}: QuestionnaireReviewContext & { questionId?: string }) {
  return questionId ? (
    <QuestionReviews
      questionId={questionId}
      versionId={versionId}
      disabled={disabled}
      allowRequest={canRequest}
    />
  ) : null;
}
