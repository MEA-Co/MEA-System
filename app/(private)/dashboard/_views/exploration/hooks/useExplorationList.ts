'use client';

import useSWR from 'swr';

import type { ActivityRow } from '../lib/storage-model';

export type ExplorationList = { userId: string; activities: ActivityRow[] };

export async function fetchExplorationList(
  url: string,
): Promise<ExplorationList> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('탐구활동을 불러오지 못했어요.');
  const data: unknown = await response.json();
  if (
    !data ||
    typeof data !== 'object' ||
    !('userId' in data) ||
    typeof data.userId !== 'string' ||
    !('activities' in data) ||
    !Array.isArray(data.activities)
  )
    throw new Error('탐구활동 목록을 확인하지 못했어요. 다시 시도해 주세요.');
  return data as ExplorationList;
}

export function useExplorationList(
  scope: 'own' | 'accessible',
  enabled = true,
  referenceId?: string,
) {
  const url =
    scope === 'own'
      ? '/api/exploration?scope=own'
      : referenceId
        ? `/api/exploration?reference=${encodeURIComponent(referenceId)}`
        : '/api/exploration';
  // Version the response contract so old array-shaped URL caches cannot be reused.
  return useSWR(
    enabled ? ['exploration-list-v1', url] : null,
    ([, requestUrl]: [string, string]) => fetchExplorationList(requestUrl),
  );
}
