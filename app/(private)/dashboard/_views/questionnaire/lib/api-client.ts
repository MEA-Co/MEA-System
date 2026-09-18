'use client';

import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import type {
  SaveQuestionnaireRequest,
  SaveQuestionnaireResult,
} from './types';

export const QUESTIONNAIRE_API = '/api/questionnaires';
// Realtime handles changes; polling only recovers from missed notifications.
export const QUESTIONNAIRE_REFRESH_INTERVAL = 60_000;
export class QuestionnaireApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function questionnaireFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const data = await response.json();
  if (!response.ok)
    throw new QuestionnaireApiError(
      response.status,
      data.error ?? '질문지를 불러오지 못했어요.',
    );
  return data;
}
export function useQuestionnaireResource<T>(path: string | null) {
  return useSWR<T, QuestionnaireApiError>(
    path === null ? null : `${QUESTIONNAIRE_API}${path}`,
    questionnaireFetcher<T>,
    {
      refreshInterval:
        path?.split('?')[0] === '/new' ? 0 : QUESTIONNAIRE_REFRESH_INTERVAL,
      revalidateOnFocus: path?.split('?')[0] !== '/new',
      revalidateOnReconnect: path?.split('?')[0] !== '/new',
      revalidateIfStale: path?.split('?')[0] !== '/new',
      dedupingInterval: 500,
      shouldRetryOnError: (error) => ![401, 403, 404].includes(error.status),
      errorRetryInterval: 2000,
      errorRetryCount: 3,
      keepPreviousData: true,
    },
  );
}
async function send(path: string, method: string, body: unknown) {
  const response = await fetch(`${QUESTIONNAIRE_API}${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { response, data };
}
export function useQuestionnaireApi() {
  const { mutate } = useSWRConfig();
  const refresh = useCallback(
    () =>
      mutate(
        (key) =>
          typeof key === 'string' &&
          key.startsWith(QUESTIONNAIRE_API) &&
          !key.startsWith(`${QUESTIONNAIRE_API}/new`),
      ),
    [mutate],
  );
  const command = useCallback(
    async (
      path: string,
      method: string,
      body: unknown,
    ): Promise<{ error?: string; mode?: 'deleted' | 'archived' }> => {
      const { response, data } = await send(path, method, body);
      if (!response.ok)
        return { error: data.error ?? '요청을 처리하지 못했어요.' };
      // A failed refresh does not make an already committed command a failure.
      void refresh().catch(() => {});
      return data;
    },
    [refresh],
  );
  const saveQuestionnaire = useCallback(
    async (
      request: SaveQuestionnaireRequest,
    ): Promise<SaveQuestionnaireResult> => {
      const { response, data } = await send(
        request.expectedRevision === 0 ? '' : `/${request.document.versionId}`,
        request.expectedRevision === 0 ? 'POST' : 'PUT',
        request,
      );
      if (data.ok === true || data.ok === false) return data;
      return {
        ok: false,
        code:
          response.status === 401 || response.status === 403
            ? 'forbidden'
            : response.status === 409
              ? 'conflict'
              : response.status >= 500
                ? 'unavailable'
                : 'invalid',
        error: data.error ?? '저장하지 못했어요.',
      };
    },
    [],
  );
  return { command, saveQuestionnaire, refresh };
}
