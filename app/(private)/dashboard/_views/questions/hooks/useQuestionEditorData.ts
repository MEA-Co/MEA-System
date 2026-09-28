'use client';

import useSWR from 'swr';

import type { QuestionBlockRow } from '../lib/question-blocks';

async function loadDetail(url: string): Promise<QuestionBlockRow | null> {
  const response = await fetch(url, { cache: 'no-store' });
  if (response.status === 404) return null;
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? '질문을 불러오지 못했어요.');
  return result.block;
}
async function loadRelationships(url: string): Promise<QuestionBlockRow[]> {
  const response = await fetch(url, { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? '참조 질문을 불러오지 못했어요.');
  return result.blocks;
}
export function useQuestionEditorData(id: string | null, unsaved: boolean) {
  const detail = useSWR(
    id && id !== 'new' && !unsaved ? `/api/questions/${id}` : null,
    loadDetail,
    { revalidateOnFocus: false, keepPreviousData: false },
  );
  const relationships = useSWR(
    id ? '/api/questions?mode=relationships' : null,
    loadRelationships,
    { dedupingInterval: 60000, revalidateOnFocus: true },
  );
  return { detail, relationships };
}
