'use client';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { CollectionPagination } from '@/components/patterns/collection-pagination';
import { CollectionTable } from '@/components/patterns/collection-table';
import { CollectionTableState } from '@/components/patterns/collection-table-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
const publishedDate = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeZone: 'Asia/Seoul',
});

export function ConsultantQuestionnaireList({
  model,
  loading = false,
}: {
  model?: QuestionnaireListPage;
  loading?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
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
            {group.label}
            <Badge variant="count">{pending ? '–' : group.total}</Badge>
          </TabsTrigger>
        ))}
      </TabsList>
      {groups.map((group) => (
        <TabsContent key={group.id} value={group.id}>
          <div className="mb-3 flex min-h-6 flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{pending ? '질문지 –개' : `질문지 ${group.total}개`}</span>
            {group.id === 'pending' && unreadIds.length > 0 && (
              <NewQuestionnaireBadge count={unreadIds.length} />
            )}
          </div>
          <CollectionTable
            aria-label={`${group.label} 질문지`}
            aria-busy={pending}
          >
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>질문지</TableHead>
                <TableHead className="hidden w-32 sm:table-cell">
                  답변 상태
                </TableHead>
                <TableHead className="w-16 text-right sm:w-40">열기</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending || !group.items.length ? (
                <CollectionTableState
                  colSpan={3}
                  loading={pending}
                  title={
                    pending
                      ? '질문지를 불러오는 중입니다'
                      : group.id === 'pending'
                        ? '답변할 질문지가 없습니다'
                        : '아직 제출한 질문지가 없습니다'
                  }
                  description={
                    group.id === 'pending'
                      ? '새로 배포된 질문지는 이곳에서 확인할 수 있습니다.'
                      : '답변을 제출하면 이곳에서 다시 확인하고 수정할 수 있습니다.'
                  }
                />
              ) : (
                group.items.map((item) => {
                  const href = questionnaireDetailHref(params, item.id);
                  const submitted = item.responseStatus === 'submitted';
                  const saved = item.responseStatus === 'in_progress';
                  const actionLabel = submitted
                    ? '답변 보기'
                    : saved
                      ? '이어서 답변'
                      : '답변하기';
                  const status = (
                    <Badge
                      variant={
                        submitted ? 'secondary' : saved ? 'highlight' : 'subtle'
                      }
                    >
                      {submitted ? '제출 완료' : saved ? '작성 중' : '미작성'}
                    </Badge>
                  );
                  return (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer focus-within:bg-muted/50"
                      onClick={(event) => {
                        if (
                          (event.target as HTMLElement).closest('a, button') ||
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey
                        )
                          return;
                        router.push(href);
                      }}
                    >
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={href}
                            prefetch={false}
                            className="wrap-anywhere font-semibold outline-offset-4 hover:underline"
                          >
                            {item.title}
                          </Link>
                          {unreadIds.includes(item.id) && (
                            <NewQuestionnaireBadge />
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-5 text-muted-foreground">
                          {item.publishedAt && (
                            <span>
                              배포{' '}
                              {publishedDate.format(new Date(item.publishedAt))}
                            </span>
                          )}
                          <span className="sm:hidden">{status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {status}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          render={<Link href={href} prefetch={false} />}
                          nativeButton={false}
                          variant="outline"
                          size="sm"
                          className="size-9 p-0 sm:w-auto sm:px-3"
                          aria-label={`${item.title} · ${actionLabel}`}
                          title={actionLabel}
                        >
                          <span className="hidden sm:inline">
                            {actionLabel}
                          </span>
                          <ArrowRight aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </CollectionTable>
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
