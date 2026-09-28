'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { QuestionnaireListItem as Item } from '../../lib/questionnaire/types';

import { ConsultantQuestionnaireList } from './ConsultantQuestionnaireList';
import { DeleteQuestionnaireButton } from './DeleteQuestionnaireButton';
import {
  NewPublicationBadge,
  usePublicationNotifications,
} from './PublicationNotifications';
import { questionnaireStatusColors } from './questionnaire-styles';
import {
  questionnaireStatusLabels,
  QuestionnaireStatusSelect,
} from './QuestionnaireStatusSelect';
import { ReviewRequestBadge } from './ReviewRequestBadge';

const date = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
});
export function QuestionnaireList({
  drafts,
  published,
  distributed,
  archived = [],
  staff,
}: {
  drafts: Item[];
  published: Item[];
  distributed: Item[];
  archived?: Item[];
  staff: boolean;
}) {
  const { unreadIds } = usePublicationNotifications();
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<string[]>([
    'draft',
    'published',
    'distributed',
  ]);
  const [page, setPage] = useState(1);
  const items = useMemo(
    () =>
      [...drafts, ...published, ...distributed, ...archived]
        .filter((item) => item.isOwner)
        .filter((item) =>
          (item.title || '제목 없는 질문지')
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
        )
        .filter((item) =>
          statuses.includes(item.archivedAt ? 'archived' : item.status),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [drafts, published, distributed, archived, query, statuses],
  );
  const pageCount = Math.max(1, Math.ceil(items.length / 10));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * 10;
  const pageItems = items.slice(pageStart, pageStart + 10);
  if (!staff) return <ConsultantQuestionnaireList items={distributed} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-md"
          aria-label="질문지 검색"
          placeholder="질문지 제목으로 검색"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <div
          role="group"
          aria-label="질문지 상태 필터"
          className="flex flex-wrap gap-2"
        >
          {Object.entries(questionnaireStatusLabels).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={statuses.includes(value)}
              onClick={() => {
                setStatuses((current) =>
                  current.includes(value)
                    ? current.filter((status) => status !== value)
                    : [...current, value],
                );
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${statuses.includes(value) ? questionnaireStatusColors[value as keyof typeof questionnaireStatusColors] : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{items.length}개</p>
      </div>
      <div className="overflow-hidden rounded-xl border bg-background">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[40%] pl-5">질문지</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>최근 수정</TableHead>
              <TableHead>배포일</TableHead>
              <TableHead className="text-right pr-5">
                <span className="inline-block w-8 text-center">관리</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((item) => (
              <TableRow
                key={item.id}
                className={
                  item.isOwner && item.pendingReviewCount > 0
                    ? 'bg-green-50/50 dark:bg-green-950/20'
                    : undefined
                }
              >
                <TableCell className="pl-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.archivedAt ? (
                      <span className="font-medium text-muted-foreground">
                        {item.title || '제목 없는 질문지'}
                      </span>
                    ) : (
                      <Link
                        scroll={false}
                        prefetch={false}
                        href={`/dashboard?view=questions&tab=questionnaires&draft=${item.id}`}
                        className="font-medium hover:underline"
                      >
                        {item.title || '제목 없는 질문지'}
                      </Link>
                    )}
                    {!item.archivedAt && unreadIds.includes(item.id) && (
                      <NewPublicationBadge />
                    )}
                    {item.isOwner && (
                      <ReviewRequestBadge count={item.pendingReviewCount} />
                    )}
                  </div>
                  {item.archivedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      복원 후 내용을 열 수 있어요.
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <QuestionnaireStatusSelect item={item} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {date.format(new Date(item.updatedAt))}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {item.distributedAt
                    ? date.format(new Date(item.distributedAt))
                    : '—'}
                </TableCell>
                <TableCell className="pr-5 text-right">
                  {item.canDelete &&
                    !item.hasDistributed &&
                    !item.archivedAt && (
                      <DeleteQuestionnaireButton
                        versionId={item.id}
                        revision={item.revision}
                        hasDistributed={false}
                        title={item.title}
                      />
                    )}
                </TableCell>
              </TableRow>
            ))}
            {!items.length && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-32 text-center text-muted-foreground"
                >
                  {query ||
                  statuses.length !== 3 ||
                  statuses.includes('archived')
                    ? '조건에 맞는 질문지가 없어요.'
                    : '아직 만든 질문지가 없어요. 새 질문지를 제작해 보세요.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {items.length > 0 && (
        <nav
          aria-label="질문지 목록 페이지"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-muted-foreground" aria-live="polite">
            전체 {items.length}개 중 {pageStart + 1}–
            {Math.min(pageStart + 10, items.length)}개
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              이전
            </Button>
            <span className="text-sm tabular-nums">
              {currentPage} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              다음
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
