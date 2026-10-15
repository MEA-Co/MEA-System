'use client';
import Link from 'next/link';
import useSWR from 'swr';

import { Button } from '@/components/ui/button';

import {
  questionnaireFetcher,
  useQuestionnaireResource,
} from '../lib/questionnaire/api-client';
import type { QuestionnaireViewData } from '../lib/questionnaire/types';
export function QuestionsNavigation({
  questionnaire,
  questionCount,
}: {
  questionnaire: boolean;
  questionCount?: number;
}) {
  const { data: questions, error: questionError } = useSWR<{ total: number }>(
    '/api/questions?page=1&search=',
    questionnaireFetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );
  const { data: questionnaires, error: questionnaireError } =
    useQuestionnaireResource<QuestionnaireViewData>('');
  const questionsTotal =
    questionCount ?? (questionError ? undefined : questions?.total);
  const questionnairesTotal =
    questionnaires && !questionnaireError
      ? questionnaires.list?.total
      : undefined;
  return (
    <nav aria-label="질문 관리 영역" className="flex gap-2">
      {[
        {
          tab: 'questions',
          label: '질문',
          active: !questionnaire,
          count: questionsTotal,
        },
        {
          tab: 'questionnaires',
          label: '질문지',
          active: questionnaire,
          count: questionnairesTotal,
        },
      ].map((item) => (
        <Button
          key={item.tab}
          className="relative pr-8"
          variant={item.active ? 'secondary' : 'ghost'}
          nativeButton={false}
          render={
            <Link
              href={`/dashboard?view=questions&tab=${item.tab}`}
              prefetch={false}
              aria-current={item.active ? 'page' : undefined}
            />
          }
        >
          {item.label}
          <span
            className="absolute right-1.5 top-1 min-w-4 rounded bg-foreground/10 px-1 text-center text-[10px] font-semibold leading-4 tabular-nums"
            aria-label={
              item.count === undefined ? '개수 확인 중' : `${item.count}개`
            }
          >
            {item.count ?? '–'}
          </span>
        </Button>
      ))}
    </nav>
  );
}
