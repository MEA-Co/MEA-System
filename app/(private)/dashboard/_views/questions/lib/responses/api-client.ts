import type { QuestionResponseSnapshot } from '../question-responses';
import {
  QUESTIONNAIRE_API,
  QUESTIONNAIRE_HEADERS,
  QuestionnaireApiError,
} from '../questionnaire/api-client';

import type { ResponseVersion } from './polling';

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
      ...(method === 'GET' ? { signal: AbortSignal.timeout(30_000) } : {}),
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

export async function requestResponseVersion(
  id: string,
  published: boolean,
): Promise<ResponseVersion> {
  const response = await fetch(
    `${QUESTIONNAIRE_API}/${id}/${published ? 'published-responses' : 'review-responses'}?version=1`,
    {
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
      headers: QUESTIONNAIRE_HEADERS,
    },
  );
  const result = await response.json();
  if (!response.ok)
    throw new QuestionnaireApiError(
      response.status,
      result.error ?? '답변을 확인하지 못했어요.',
    );
  return result;
}
