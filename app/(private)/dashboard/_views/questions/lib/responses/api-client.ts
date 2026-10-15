import type { QuestionResponseSnapshot } from '../question-responses';
import {
  QUESTIONNAIRE_API,
  QUESTIONNAIRE_HEADERS,
  QuestionnaireApiError,
} from '../questionnaire/api-client';

export async function requestQuestionResponse(
  questionnaireId: string,
  method: string,
  body?: unknown,
  published = false,
): Promise<QuestionResponseSnapshot> {
  const response = await fetch(
    `${QUESTIONNAIRE_API}/${questionnaireId}/${published ? 'published-responses' : 'review-responses'}`,
    {
      method,
      cache: 'no-store',
      headers: { ...QUESTIONNAIRE_HEADERS, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const result = await response.json();
  if (!response.ok)
    throw new QuestionnaireApiError(
      response.status,
      result.error ?? '답변을 처리하지 못했어요.',
    );
  return result;
}
