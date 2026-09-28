'use client';

import { ArrowUpRight, Blocks, FilePenLine, Globe } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type QuestionBlockRow, questionName } from '../../lib/question-blocks';
import {
  questionnaireFetcher,
  useQuestionnaireResource,
} from '../../lib/questionnaire/api-client';
import type { QuestionnaireViewData } from '../../lib/questionnaire/types';
import {
  NewPublicationBadge,
  usePublicationNotifications,
} from '../questionnaire/PublicationNotifications';

const base = '/dashboard?view=questions';
const date = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeZone: 'Asia/Seoul',
});

export function QuestionsDashboard() {
  const { data, error } = useQuestionnaireResource<QuestionnaireViewData>('');
  const questions = useSWR<{ total: number; blocks: QuestionBlockRow[] }>(
    '/api/questions?page=1',
    questionnaireFetcher,
    { revalidateOnFocus: true },
  );
  const { unreadIds } = usePublicationNotifications();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const mine = data
    ? [...data.drafts, ...data.published, ...data.distributed]
        .filter((item) => item.isOwner)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    : [];
  const published = (data?.published ?? [])
    .filter(
      (item) =>
        !item.isOwner &&
        !item.archivedAt &&
        item.title
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pages = Math.max(1, Math.ceil(published.length / 6));
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
            icon: Blocks,
            items: (questions.data?.blocks ?? [])
              .slice(0, 4)
              .map((question) => ({
                id: question.id,
                title: questionName(question),
                updatedAt: question.updated_at,
              })),
            empty: '아직 만든 질문이 없어요.',
          },
          {
            title: '질문지 관리',
            count: data ? mine.length : undefined,
            loading: !data && !error,
            failed: !!error,
            href: `${base}&tab=questionnaires`,
            icon: FilePenLine,
            items: mine.slice(0, 4).map((item) => ({
              id: item.id,
              title: item.title || '제목 없는 질문지',
              updatedAt: item.updatedAt,
            })),
            empty: '아직 만든 질문지가 없어요.',
          },
        ].map(
          ({
            title,
            count,
            loading,
            failed,
            href,
            icon: Icon,
            items,
            empty,
          }) => (
            <Link
              key={title}
              href={href}
              prefetch={false}
              aria-label={`${title} 목록으로 이동`}
              className="group flex flex-col gap-5 rounded-2xl border bg-background p-6 transition-colors hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-muted p-2.5">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h2 className="text-lg font-semibold">{title}</h2>
                  {count !== undefined && (
                    <span className="text-sm text-muted-foreground">
                      {count}개
                    </span>
                  )}
                </div>
                <ArrowUpRight
                  className="size-5 text-muted-foreground transition-colors group-hover:text-foreground"
                  aria-hidden="true"
                />
              </div>
              <div className="flex-1">
                <p className="mb-2 text-xs text-muted-foreground">
                  최근 수정순
                </p>
                {failed ? (
                  <p className="py-4 text-sm text-destructive">
                    목록을 불러오지 못했어요. 눌러서 목록 화면에서 다시 확인해
                    주세요.
                  </p>
                ) : loading ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    불러오는 중…
                  </p>
                ) : items.length ? (
                  <ul className="divide-y">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <span className="min-w-0 truncate text-sm font-medium">
                          {item.title}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {date.format(new Date(item.updatedAt))}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">{empty}</p>
                )}
              </div>
            </Link>
          ),
        )}
      </div>
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Globe className="size-5" />
              게시된 질문지
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              공유된 질문지를 살펴보고 내용을 검토하세요.
            </p>
          </div>
          <Input
            aria-label="다른 사람이 게시한 질문지 검색"
            placeholder="질문지 제목으로 검색"
            className="max-w-sm"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            게시된 질문지를 불러오지 못했어요.
          </p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">
            게시된 질문지를 불러오고 있어요.
          </p>
        ) : !published.length ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {search
              ? '검색 결과가 없어요.'
              : '다른 사람이 게시한 질문지가 아직 없어요.'}
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {published.slice((current - 1) * 6, current * 6).map((item) => (
                <Link
                  key={item.id}
                  href={`${base}&tab=questionnaires&draft=${item.id}`}
                  prefetch={false}
                  className="space-y-4 rounded-xl border bg-background p-5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                      게시
                    </span>
                    {unreadIds.includes(item.id) && <NewPublicationBadge />}
                  </div>
                  <h3 className="line-clamp-2 font-semibold">
                    {item.title || '제목 없는 질문지'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    게시일{' '}
                    {date.format(new Date(item.publishedAt ?? item.updatedAt))}
                  </p>
                </Link>
              ))}
            </div>
            <nav
              aria-label="다른 사람이 게시한 질문지 페이지"
              className="flex items-center justify-between gap-3"
            >
              <span className="text-sm text-muted-foreground">
                {published.length}개
              </span>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={current === 1}
                  onClick={() => setPage(current - 1)}
                >
                  이전
                </Button>
                <span className="text-sm">
                  {current} / {pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={current === pages}
                  onClick={() => setPage(current + 1)}
                >
                  다음
                </Button>
              </div>
            </nav>
          </>
        )}
      </section>
    </div>
  );
}
