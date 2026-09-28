'use client';

import useSWR from 'swr';

import type { QuestionBlockRow } from '../../lib/question-blocks';

async function fetchQuestions(url: string): Promise<QuestionBlockRow[]> {
  const response = await fetch(url, { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? '질문 목록을 불러오지 못했어요.');
  return result.blocks;
}

export function useQuestionLibrary(enabled = true) {
  return useSWR<QuestionBlockRow[]>(
    enabled ? '/api/questions' : null,
    fetchQuestions,
    {
      refreshInterval: 60000,
      revalidateOnFocus: true,
    },
  );
}
