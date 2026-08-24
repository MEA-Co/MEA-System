import type {
  KeywordRecommendation,
  KeywordRecommendationsResponse,
  MajorPreference,
} from '@/features/material-box-consulting/model/types';

function isKeywordRecommendationsResponse(
  value: unknown,
): value is KeywordRecommendationsResponse {
  if (!value || typeof value !== 'object') return false;

  return Array.isArray(
    (value as Partial<KeywordRecommendationsResponse>).recommendations,
  );
}

export async function loadKeywordRecommendations(
  preferences: Array<MajorPreference>,
  signal: AbortSignal,
): Promise<Array<KeywordRecommendation>> {
  const response = await fetch(
    '/api/consulting/material-box/keyword-recommendations',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        majors: preferences.map((preference) => preference.major),
      }),
      signal,
    },
  );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('추천 키워드 응답을 읽지 못했습니다.');
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : '추천 키워드를 불러오지 못했습니다.';

    throw new Error(message);
  }

  if (!isKeywordRecommendationsResponse(payload)) {
    throw new Error('추천 키워드 응답 형식이 올바르지 않습니다.');
  }

  return payload.recommendations;
}
