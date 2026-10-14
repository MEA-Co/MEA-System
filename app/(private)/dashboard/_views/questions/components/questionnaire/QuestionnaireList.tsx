'use client';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { CollectionSearch } from '@/components/patterns/collection';
import { CollectionPagination } from '@/components/patterns/collection-pagination';
import { CollectionTableState } from '@/components/patterns/collection-table-state';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { QUESTIONNAIRE_REVIEWS_VISIBLE } from '../../lib/questionnaire/features';
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
import { NewReviewBadge, ReviewRequestBadge } from './ReviewRequestBadge';

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
        <CollectionSearch
          containerClassName="sm:flex-1 sm:w-auto"
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
            <Button
              key={value}
              variant="outline"
              size="sm"
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
              className={`${statuses.includes(value) ? questionnaireStatusColors[value as keyof typeof questionnaireStatusColors] : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
            >
              <Check
                aria-hidden="true"
                className={
                  statuses.includes(value) ? 'size-3.5' : 'invisible size-3.5'
                }
              />
              {label}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{items.length}개</p>
      </div>
      <div className="min-h-84 overflow-hidden rounded-lg border bg-background">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="pl-4">질문지</TableHead>
              <TableHead className="w-28 sm:w-32">상태</TableHead>
              <TableHead className="hidden w-40 lg:table-cell">
                최근 수정
              </TableHead>
              <TableHead className="hidden w-40 xl:table-cell">
                배포일
              </TableHead>
              <TableHead className="w-14 text-right pr-4">
                <span className="inline-block w-8 text-center">관리</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((item) => (
              <TableRow
                key={item.id}
                className={
                  QUESTIONNAIRE_REVIEWS_VISIBLE &&
                  item.isOwner &&
                  (item.unreadReviewCount ?? 0) > 0
                    ? 'bg-blue-50/80 hover:bg-blue-100/70 dark:bg-blue-950/30 dark:hover:bg-blue-950/50'
                    : undefined
                }
              >
                <TableCell className="whitespace-normal break-words py-4 pl-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.archivedAt ? (
                      <span className="font-medium text-muted-foreground">
                        {item.title || '제목 없는 질문지'}
                      </span>
                    ) : (
                      <Link
                        scroll={false}
                        prefetch={false}
                        href={`/dashboard?view=questions&tab=questionnaires&draft=${item.id}${item.status === 'published' ? '&return=dashboard' : ''}`}
                        className="line-clamp-2 font-semibold hover:underline focus-visible:outline-ring"
                      >
                        {item.title || '제목 없는 질문지'}
                      </Link>
                    )}
                    {!item.archivedAt && unreadIds.includes(item.id) && (
                      <NewPublicationBadge />
                    )}
                    {item.isOwner && (
                      <>
                        <NewReviewBadge count={item.unreadReviewCount ?? 0} />
                        <ReviewRequestBadge count={item.pendingReviewCount} />
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground lg:hidden">
                    최근 수정 · {date.format(new Date(item.updatedAt))}
                  </p>
                  {item.archivedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      복원 후 내용을 열 수 있어요.
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <QuestionnaireStatusSelect item={item} />
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground whitespace-nowrap lg:table-cell">
                  {date.format(new Date(item.updatedAt))}
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground whitespace-nowrap xl:table-cell">
                  {item.distributedAt
                    ? date.format(new Date(item.distributedAt))
                    : '—'}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {item.canDelete &&
                    !item.hasDistributed &&
                    !item.archivedAt && (
                      <DeleteQuestionnaireButton
                        questionnaireId={item.id}
                        revision={item.revision}
                        hasDistributed={false}
                        title={item.title}
                      />
                    )}
                </TableCell>
              </TableRow>
            ))}
            {!items.length && (
              <CollectionTableState
                colSpan={5}
                title={
                  query ||
                  statuses.length !== 3 ||
                  statuses.includes('archived')
                    ? '조건에 맞는 질문지가 없습니다'
                    : '등록된 질문지가 없습니다'
                }
                description={
                  query ||
                  statuses.length !== 3 ||
                  statuses.includes('archived')
                    ? '검색어나 상태 필터를 바꿔 보세요.'
                    : '새 질문지 만들기 버튼으로 질문지를 등록하세요.'
                }
              />
            )}
          </TableBody>
        </Table>
      </div>
      <CollectionPagination
        label="질문지 목록 페이지"
        total={items.length}
        page={currentPage}
        pages={pageCount}
        loading={false}
        onPageChange={setPage}
      />
    </div>
  );
}
