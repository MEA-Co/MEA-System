'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';

import { CollectionSearch } from '@/components/patterns/collection';
import { CollectionPagination } from '@/components/patterns/collection-pagination';
import { CollectionTableState } from '@/components/patterns/collection-table-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { type QuestionBlockRow, questionName } from '../../lib/question-blocks';
import {
  questionnaireFetcher,
  useQuestionnaireResource,
} from '../../lib/questionnaire/api-client';
import type { QuestionnaireListItem } from '../../lib/questionnaire/types';
import type { QuestionnaireViewData } from '../../lib/questionnaire/types';
import {
  NewPublicationBadge,
  usePublicationNotifications,
} from '../questionnaire/PublicationNotifications';
import { NewReviewBadge } from '../questionnaire/ReviewRequestBadge';

const base = '/dashboard?view=questions';
const date = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeZone: 'Asia/Seoul',
});

export function QuestionsDashboard() {
  const { data, error, mutate } =
    useQuestionnaireResource<QuestionnaireViewData>('');
  const questions = useSWR<{ total: number; blocks: QuestionBlockRow[] }>(
    '/api/questions?page=1',
    questionnaireFetcher,
    { revalidateOnFocus: true },
  );
  const { unreadIds } = usePublicationNotifications();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [distributedSearch, setDistributedSearch] = useState('');
  const [distributedPage, setDistributedPage] = useState(1);
  const mine = data
    ? [...data.drafts, ...data.published, ...data.distributed]
        .filter((item) => item.isOwner)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    : [];
  const published = (data?.published ?? [])
    .filter(
      (item) =>
        !item.archivedAt &&
        item.title
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const distributed = (data?.distributed ?? [])
    .filter(
      (item) =>
        !item.archivedAt &&
        item.title
          .toLocaleLowerCase()
          .includes(distributedSearch.trim().toLocaleLowerCase()),
    )
    .sort((a, b) =>
      (b.distributedAt ?? b.updatedAt).localeCompare(
        a.distributedAt ?? a.updatedAt,
      ),
    );
  const distributedPages = Math.max(1, Math.ceil(distributed.length / 10));
  const distributedCurrent = Math.min(distributedPage, distributedPages);
  const pages = Math.max(1, Math.ceil(published.length / 10));
  const current = Math.min(page, pages);
  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            title: '질문 관리',
            count: questions.data?.total,
            loading: !questions.data && !questions.error,
            failed: !!questions.error,
            href: `${base}&tab=questions`,
            items: (questions.data?.blocks ?? [])
              .slice(0, 4)
              .map((question) => ({
                id: question.id,
                title: questionName(question),
                updatedAt: question.updated_at,
                unreadReviewCount: 0,
              })),
            empty: '아직 만든 질문이 없어요.',
          },
          {
            title: '질문지 관리',
            count: data ? mine.length : undefined,
            loading: !data && !error,
            failed: !!error,
            href: `${base}&tab=questionnaires`,
            items: mine.slice(0, 4).map((item) => ({
              id: item.id,
              title: item.title || '제목 없는 질문지',
              updatedAt: item.updatedAt,
              unreadReviewCount: item.unreadReviewCount ?? 0,
            })),
            empty: '아직 만든 질문지가 없어요.',
          },
        ].map(({ title, count, loading, failed, href, items, empty }) => (
          <Link
            key={title}
            href={href}
            prefetch={false}
            aria-label={`${title} 목록으로 이동`}
            className="group min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Card
              size="sm"
              className="h-full transition-colors group-hover:border-foreground/30"
            >
              <CardHeader
                variant="emphasis"
                className="flex flex-row items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{title}</h2>
                  {count !== undefined && (
                    <Badge variant="count">{count}</Badge>
                  )}
                </div>
                <ArrowUpRight
                  className="size-5 text-muted-foreground transition-colors group-hover:text-foreground"
                  aria-hidden="true"
                />
              </CardHeader>
              <CardContent className="min-h-56 flex-1">
                <p className="mb-2 text-xs text-muted-foreground">
                  최근 수정순
                </p>
                {failed ? (
                  <p className="py-4 text-sm text-destructive">
                    목록을 불러오지 못했어요. 눌러서 목록 화면에서 다시 확인해
                    주세요.
                  </p>
                ) : loading ? (
                  <div role="status" className="space-y-5 py-3">
                    <span className="sr-only">불러오는 중</span>
                    {[0, 1, 2, 3].map((index) => (
                      <Skeleton key={index} className="h-7 w-full" />
                    ))}
                  </div>
                ) : items.length ? (
                  <ul className="divide-y">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className={`grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-1 py-3 ${(item.unreadReviewCount ?? 0) > 0 ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="min-w-0 truncate text-sm font-medium">
                            {item.title}
                          </span>
                          <NewReviewBadge count={item.unreadReviewCount ?? 0} />
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {date.format(new Date(item.updatedAt))}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">{empty}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <SharedQuestionnaireList
        kind="published"
        items={published}
        loading={!data && !error}
        error={error}
        query={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        page={current}
        pages={pages}
        onPageChange={setPage}
        unreadIds={unreadIds}
        onRetry={() => void mutate()}
      />
      <SharedQuestionnaireList
        kind="distributed"
        items={distributed}
        loading={!data && !error}
        error={error}
        query={distributedSearch}
        onSearch={(value) => {
          setDistributedSearch(value);
          setDistributedPage(1);
        }}
        page={distributedCurrent}
        pages={distributedPages}
        onPageChange={setDistributedPage}
        unreadIds={unreadIds}
        onRetry={() => void mutate()}
      />
    </div>
  );
}

function SharedQuestionnaireList({
  kind,
  items,
  loading,
  error,
  query,
  onSearch,
  page,
  pages,
  onPageChange,
  unreadIds,
  onRetry,
}: {
  kind: 'published' | 'distributed';
  items: QuestionnaireListItem[];
  loading: boolean;
  error: unknown;
  query: string;
  onSearch: (value: string) => void;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  unreadIds: string[];
  onRetry: () => void;
}) {
  const published = kind === 'published';
  const title = published ? '게시된 질문지' : '배포된 질문지';
  return (
    <section aria-labelledby={`${kind}-title`} className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2
            id={`${kind}-title`}
            className="flex items-center gap-2 text-lg font-bold"
          >
            {title}
            {!loading && !error && (
              <Badge variant="count">{items.length}</Badge>
            )}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {published
              ? '내가 게시한 질문지와 다른 사람이 공유한 질문지를 살펴보세요.'
              : '질문지를 열어 컨설턴트가 제출한 답변을 확인하세요.'}
          </p>
        </div>
        <CollectionSearch
          aria-label={`${title} 검색`}
          placeholder="질문지 제목으로 검색"
          value={query}
          onChange={(event) => onSearch(event.target.value)}
          containerClassName="sm:shrink-0"
        />
      </div>
      <div
        className="min-h-84 overflow-hidden rounded-lg border bg-background"
        aria-busy={loading}
      >
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="pl-4">질문지</TableHead>
              {published && (
                <TableHead className="hidden w-32 md:table-cell">
                  제작자
                </TableHead>
              )}
              <TableHead className="hidden w-32 lg:table-cell">
                {published ? '게시일' : '배포일'}
              </TableHead>
              {published && (
                <TableHead className="hidden w-32 xl:table-cell">
                  최근 수정
                </TableHead>
              )}
              <TableHead className="w-24 pr-4 text-right sm:w-28">
                {published ? '확인 상태' : '제출된 응답'}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || error || !items.length ? (
              <CollectionTableState
                colSpan={published ? 5 : 3}
                loading={loading}
                title={
                  loading
                    ? `${title}를 불러오는 중입니다`
                    : error
                      ? `${title}를 불러오지 못했습니다`
                      : query.trim()
                        ? '검색 결과가 없습니다'
                        : `${title}가 없습니다`
                }
                description={
                  loading
                    ? undefined
                    : error
                      ? '잠시 후 다시 시도해 주세요.'
                      : query.trim()
                        ? '다른 제목으로 검색해 보세요.'
                        : published
                          ? '게시된 질문지를 이곳에서 확인할 수 있습니다.'
                          : '배포된 질문지와 제출된 응답 수를 이곳에서 확인할 수 있습니다.'
                }
                action={
                  error ? (
                    <Button variant="outline" onClick={onRetry}>
                      다시 불러오기
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              items.slice((page - 1) * 10, page * 10).map((item) => {
                const unread =
                  published &&
                  ((!item.isOwner && unreadIds.includes(item.id)) ||
                    (item.unreadReviewCount ?? 0) > 0);
                const day = date.format(
                  new Date(
                    (published ? item.publishedAt : item.distributedAt) ??
                      item.updatedAt,
                  ),
                );
                return (
                  <TableRow
                    key={item.id}
                    className={
                      unread
                        ? 'bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/30'
                        : undefined
                    }
                  >
                    <TableCell className="whitespace-normal py-4 pl-4">
                      <Link
                        href={`${base}&tab=questionnaires&draft=${item.id}&return=dashboard`}
                        prefetch={false}
                        className="block rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="line-clamp-2 break-words font-semibold hover:underline">
                            {item.title || '제목 없는 질문지'}
                          </span>
                          {(item.unreadReviewCount ?? 0) > 0 && published ? (
                            <NewReviewBadge
                              count={item.unreadReviewCount ?? 0}
                            />
                          ) : unread ? (
                            <NewPublicationBadge />
                          ) : null}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground lg:hidden">
                          {published && (
                            <span className="md:hidden">
                              {item.creatorName?.trim() || '이름 없음'} ·{' '}
                            </span>
                          )}
                          {published ? '게시' : '배포'} {day}
                        </span>
                      </Link>
                    </TableCell>
                    {published && (
                      <TableCell className="hidden whitespace-normal break-words md:table-cell">
                        {item.creatorName?.trim() || '이름 없음'}
                      </TableCell>
                    )}
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {day}
                    </TableCell>
                    {published && (
                      <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                        {date.format(new Date(item.updatedAt))}
                      </TableCell>
                    )}
                    <TableCell className="pr-4 text-right text-xs">
                      {published ? (
                        <span
                          className={
                            unread
                              ? 'font-medium text-blue-700 dark:text-blue-300'
                              : 'text-muted-foreground'
                          }
                        >
                          {item.isOwner
                            ? '내가 게시함'
                            : unread
                              ? '미확인'
                              : '확인함'}
                        </span>
                      ) : (
                        <Badge variant="subtle">
                          {item.submittedResponseCount ?? 0}개
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <CollectionPagination
        label={`${title} 페이지`}
        total={items.length}
        page={page}
        pages={pages}
        loading={loading}
        error={error}
        onPageChange={onPageChange}
      />
    </section>
  );
}
