'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [status, setStatus] = useState('active');
  const items = useMemo(
    () =>
      [...drafts, ...published, ...distributed, ...archived]
        .filter((item) =>
          (item.title || '제목 없는 질문지')
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
        )
        .filter(
          (item) =>
            status === 'all' ||
            (status === 'active'
              ? !item.archivedAt
              : status === 'archived'
                ? !!item.archivedAt
                : !item.archivedAt && item.status === status),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [drafts, published, distributed, archived, query, status],
  );
  if (!staff) return <ConsultantQuestionnaireList items={distributed} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-md"
          aria-label="질문지 검색"
          placeholder="질문지 제목으로 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          value={status}
          onValueChange={(value) => value && setStatus(value)}
        >
          <SelectTrigger aria-label="질문지 상태 필터">
            <SelectValue>
              {status === 'active'
                ? '보관 제외'
                : status === 'all'
                  ? '전체 상태'
                  : questionnaireStatusLabels[
                      status as keyof typeof questionnaireStatusLabels
                    ]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">보관 제외</SelectItem>
            <SelectItem value="all">전체 상태</SelectItem>
            {Object.entries(questionnaireStatusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <TableHead className="text-right pr-5">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
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
                  {query || status !== 'active'
                    ? '조건에 맞는 질문지가 없어요.'
                    : '아직 만든 질문지가 없어요. 새 질문지를 제작해 보세요.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
