'use client';
import { ArrowRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { CollectionEmptyState } from '@/components/patterns/collection';
import { CollectionPagination } from '@/components/patterns/collection-pagination';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  emptyQuestionnaireList,
  questionnaireDetailHref,
  readQuestionnaireListOptions,
} from '../../lib/questionnaire/list-model';
import type { QuestionnaireListPage } from '../../lib/questionnaire/types';

import {
  NewQuestionnaireBadge,
  useQuestionnaireNotifications,
} from './QuestionnaireNotifications';
export function ConsultantQuestionnaireList({
  model,
  loading = false,
}: {
  model?: QuestionnaireListPage;
  loading?: boolean;
}) {
  const params = useSearchParams();
  const options = readQuestionnaireListOptions(params);
  const page = model ?? emptyQuestionnaireList();
  const { unreadIds } = useQuestionnaireNotifications();
  const pending = loading;
  function update(values: Record<string, string>) {
    const url = new URL(window.location.href);
    Object.entries(values).forEach(([key, value]) =>
      value ? url.searchParams.set(key, value) : url.searchParams.delete(key),
    );
    window.history.replaceState(null, '', url);
  }
  const groups = [
    { id: 'pending' as const, label: '제출 전' },
    { id: 'complete' as const, label: '제출 완료' },
  ].map((group) => ({
    ...group,
    total: page.responseCounts?.[group.id] ?? 0,
    items: options.response === group.id ? page.items : [],
  }));
  return (
    <Tabs
      value={options.response}
      onValueChange={(value) =>
        update({ qResponse: value === 'complete' ? 'complete' : '', qPage: '' })
      }
    >
      <TabsList aria-label="답변 상태" className="w-full sm:w-fit">
        {groups.map((group) => (
          <TabsTrigger key={group.id} value={group.id}>
            {group.label}{' '}
            <Badge variant="count">{pending ? '–' : group.total}</Badge>
            {group.id === 'pending' && unreadIds.length > 0 && (
              <NewQuestionnaireBadge count={unreadIds.length} />
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {groups.map((group) => (
        <TabsContent key={group.id} value={group.id}>
          {pending ? (
            <div className="space-y-4 rounded-lg border p-5" role="status">
              <span className="sr-only">
                질문지 답변 상태를 불러오는 중입니다
              </span>
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          ) : group.items.length ? (
            <ul className="divide-y overflow-hidden rounded-lg border bg-background">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className={
                    unreadIds.includes(item.id)
                      ? 'bg-blue-50/40 dark:bg-blue-950/20'
                      : ''
                  }
                >
                  <Link
                    href={questionnaireDetailHref(params, item.id)}
                    prefetch={false}
                    className="flex items-center gap-4 p-5 hover:bg-muted/50"
                  >
                    <FileText className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">
                          {item.title}
                        </span>
                        {unreadIds.includes(item.id) && (
                          <NewQuestionnaireBadge />
                        )}
                        {item.responseStatus === 'in_progress' && (
                          <Badge variant="highlight">저장된 답변 있음</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.responseStatus === 'submitted'
                          ? '제출한 답변 보기 · 수정 가능'
                          : item.responseStatus === 'in_progress'
                            ? '아직 제출하지 않았어요 · 이어서 답변하기'
                            : '답변하기'}
                      </p>
                    </div>
                    <ArrowRight className="size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CollectionEmptyState
              icon={<FileText />}
              title={
                group.id === 'pending'
                  ? '답변할 질문지가 없습니다'
                  : '아직 제출한 질문지가 없습니다'
              }
              description={
                group.id === 'pending'
                  ? '새로 배포된 질문지는 이곳에서 확인할 수 있습니다.'
                  : '답변을 제출하면 이곳에서 다시 확인하고 수정할 수 있습니다.'
              }
            />
          )}
          <CollectionPagination
            label="질문지 페이지"
            total={page.total}
            page={page.page}
            pages={page.pages}
            loading={loading}
            onPageChange={(value) => update({ qPage: String(value) })}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
