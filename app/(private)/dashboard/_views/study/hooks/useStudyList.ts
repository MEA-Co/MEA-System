'use client';

import useSWR from 'swr';

import type { StudyRow } from '@/lib/study/storage-model';

export type StudyList = {
  userId: string;
  activities: StudyRow[];
  total?: number;
  page?: number;
  pageSize?: number;
};

export async function fetchStudyList(url: string): Promise<StudyList> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('학습법을 불러오지 못했어요.');
  const data: unknown = await response.json();
  if (
    !data ||
    typeof data !== 'object' ||
    !('userId' in data) ||
    typeof data.userId !== 'string' ||
    !('activities' in data) ||
    !Array.isArray(data.activities)
  )
    throw new Error('학습법 목록을 확인하지 못했어요. 다시 시도해 주세요.');
  return data as StudyList;
}

export function useStudyList(
  scope: 'own' | 'accessible',
  enabled = true,
  referenceId?: string,
  options: { query?: string; page?: number; identityOnly?: boolean } = {},
) {
  const params = new URLSearchParams({
    scope: 'own',
    page: String(options.page ?? 1),
    q: options.query?.trim() ?? '',
  });
  if (options.identityOnly) params.set('mode', 'context');
  if (referenceId) {
    params.set('reference', referenceId);
    if (scope === 'accessible') params.delete('scope');
  }
  const url = `/api/study?${params}`;
  // Version the response contract so old array-shaped URL caches cannot be reused.
  return useSWR(
    enabled ? ['study-list-v1', url] : null,
    ([, requestUrl]: [string, string]) => fetchStudyList(requestUrl),
  );
}
