'use client';

import { ArrowRight, Eye, MessageSquareText, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Fragment } from 'react';

import { CollectionSearch } from '@/components/patterns/collection';
import { CollectionPagination } from '@/components/patterns/collection-pagination';
import { CollectionTableState } from '@/components/patterns/collection-table-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { QUESTIONNAIRE_REVIEWS_VISIBLE } from '../../lib/questionnaire/features';
import {
  emptyQuestionnaireList,
  questionnaireDetailHref,
  type QuestionnaireListStatus,
  readQuestionnaireListOptions,
} from '../../lib/questionnaire/list-model';
import type {
  QuestionnaireListItem as Item,
  QuestionnaireListPage,
} from '../../lib/questionnaire/types';

import { ConsultantQuestionnaireList } from './ConsultantQuestionnaireList';
import { DeleteQuestionnaireButton } from './DeleteQuestionnaireButton';
import { questionnaireStatusColors } from './questionnaire-styles';
import {
  NewQuestionnaireBadge,
  useQuestionnaireNotifications,
} from './QuestionnaireNotifications';
import {
  questionnaireStatusLabels,
  QuestionnaireStatusSelect,
} from './QuestionnaireStatusSelect';
import { NewReviewBadge, ReviewRequestBadge } from './ReviewRequestBadge';

const date = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeZone: 'Asia/Seoul',
});
export function QuestionnaireList(props: {
  model?: QuestionnaireListPage;
  staff: boolean;
  loading?: boolean;
}) {
  return props.staff ? (
    <StaffQuestionnaireList {...props} />
  ) : (
    <ConsultantQuestionnaireList model={props.model} loading={props.loading} />
  );
}
function StaffQuestionnaireList(props: {
  model?: QuestionnaireListPage;
  loading?: boolean;
}) {
  const params = useSearchParams();
  const options = readQuestionnaireListOptions(params);
  const model = props.loading
    ? emptyQuestionnaireList()
    : (props.model ?? emptyQuestionnaireList());
  const { unreadIds } = useQuestionnaireNotifications();
  function update(values: Record<string, string>) {
    const url = new URL(window.location.href);
    Object.entries(values).forEach(([key, value]) =>
      value ? url.searchParams.set(key, value) : url.searchParams.delete(key),
    );
    window.history.replaceState(null, '', url);
  }
  function selectStatus(status: string) {
    update({ qStage: status === 'all' ? '' : status, qStatus: '', qPage: '' });
  }
  const groups =
    options.status === 'all'
      ? model.groups
      : [{ status: options.status, total: model.total, items: model.items }];
  return (
    <Tabs
      value={options.status}
      onValueChange={(value) => {
        if (typeof value === 'string') selectStatus(value);
      }}
      className="gap-4"
    >
      <TabsList
        aria-label="질문지 상태"
        className="h-auto! w-full flex-wrap justify-start sm:w-fit"
      >
        {(
          [
            'all',
            'draft',
            'in_review',
            'published',
            'archived',
          ] as QuestionnaireListStatus[]
        ).map((status) => (
          <TabsTrigger key={status} value={status} className="px-3">
            {status === 'all' ? '전체' : questionnaireStatusLabels[status]}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span aria-live="polite">
          {options.query.trim() ? '검색 결과' : '열람 가능한 질문지'}{' '}
          {props.loading ? '–' : model.total}개
        </span>
        {options.status !== 'all' && (
          <span>
            {options.status === 'published' ? '최근 배포순' : '최근 수정순'}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <CollectionSearch
          containerClassName="sm:w-auto sm:flex-1"
          aria-label="질문지 검색"
          placeholder="질문지 제목으로 검색"
          value={options.query}
          onChange={(event) =>
            update({ qSearch: event.target.value, qPage: '' })
          }
        />
        <Select
          value={options.owner}
          onValueChange={(value) =>
            update({ qOwner: value === 'mine' ? 'mine' : '', qPage: '' })
          }
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="질문지 작성자">
            <SelectValue>
              {options.owner === 'mine' ? '내가 작성한 질문지' : '전체 작성자'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 작성자</SelectItem>
            <SelectItem value="mine">내가 작성한 질문지</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <TabsContent value={options.status} className="space-y-4">
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table className="block table-fixed sm:table">
            <TableHeader className="hidden sm:table-header-group">
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="pl-4">질문지</TableHead>
                <TableHead className="w-36 sm:w-44">상태 변경</TableHead>
                <TableHead className="w-28 pr-4 text-right">
                  바로가기 · 삭제
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="block sm:table-row-group max-sm:[&>tr>td]:block max-sm:[&>tr]:w-full">
              {groups.map((group) => (
                <Fragment key={group.status}>
                  <TableRow
                    className={`block sm:table-row ${questionnaireStatusColors[group.status]}`}
                  >
                    <TableCell
                      colSpan={3}
                      className="whitespace-normal px-4 py-2"
                    >
                      <div className="flex min-h-8 items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-semibold">
                            {questionnaireStatusLabels[group.status]}{' '}
                            <Badge variant="count">
                              {props.loading ? '–' : group.total}
                            </Badge>
                          </span>
                        </div>
                        {options.status === 'all' && group.total > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => selectStatus(group.status)}
                            aria-label={`${questionnaireStatusLabels[group.status]} 질문지 전체 ${group.total}개 보기`}
                          >
                            전체 보기 <ArrowRight aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {group.items.map((item) => (
                    <QuestionnaireListRow
                      key={item.id}
                      item={item}
                      href={questionnaireDetailHref(params, item.id)}
                      responsesHref={questionnaireDetailHref(
                        params,
                        item.id,
                        true,
                      )}
                      unread={unreadIds.includes(item.id)}
                    />
                  ))}
                  {props.loading && (
                    <TableRow
                      className="block hover:bg-transparent sm:table-row"
                      aria-hidden="true"
                    >
                      <TableCell colSpan={3} className="h-32 px-4 py-4 sm:h-20">
                        <div className="space-y-3">
                          <Skeleton className="h-4 w-48 max-w-full" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!props.loading &&
                    !group.items.length &&
                    (options.status === 'all' ? (
                      <TableRow className="block hover:bg-transparent sm:table-row">
                        <TableCell
                          colSpan={3}
                          className="h-32 whitespace-normal px-4 py-4 text-sm text-muted-foreground sm:h-20 sm:py-6"
                        >
                          {options.query || options.owner === 'mine'
                            ? '조건에 맞는 질문지가 없습니다.'
                            : `${questionnaireStatusLabels[group.status]} 질문지가 없습니다.`}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <CollectionTableState
                        colSpan={3}
                        title="조건에 맞는 질문지가 없습니다"
                        description="검색어나 작성자 조건을 바꿔 보세요."
                      />
                    ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        {options.status !== 'all' && (
          <CollectionPagination
            label={`${questionnaireStatusLabels[options.status]} 질문지 페이지`}
            total={model.total}
            page={model.page}
            pages={model.pages}
            loading={!!props.loading}
            onPageChange={(page) => update({ qPage: String(page) })}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
function Management({ item }: { item: Item }) {
  if (!item.isOwner && !(item.canDelete && !item.archivedAt)) return null;
  return (
    <div className="flex items-center gap-1">
      <div className="w-28 shrink-0">
        <QuestionnaireStatusSelect item={item} />
      </div>
    </div>
  );
}
function QuestionnaireListRow({
  item,
  href,
  responsesHref,
  unread,
}: {
  item: Item;
  href: string;
  responsesHref: string;
  unread: boolean;
}) {
  const fresh =
    !item.archivedAt &&
    ((!item.isOwner && unread) ||
      (QUESTIONNAIRE_REVIEWS_VISIBLE && (item.unreadReviewCount ?? 0) > 0));
  const published = item.status === 'published';
  const day = date.format(
    new Date(published ? (item.publishedAt ?? item.updatedAt) : item.updatedAt),
  );
  const creator = item.isOwner ? '나' : item.creatorName?.trim() || '—';
  return (
    <TableRow
      className={`grid grid-cols-[1fr_auto] items-center sm:table-row ${fresh ? 'bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-950/20' : ''}`}
    >
      <TableCell className="col-span-2 min-w-0 whitespace-normal break-words px-4 pb-2 pt-4 sm:py-4 sm:pr-2">
        <div className="flex flex-wrap items-center gap-2">
          {item.archivedAt ? (
            <span className="font-semibold text-muted-foreground">
              {item.title || '제목 없는 질문지'}
            </span>
          ) : (
            <Link
              href={href}
              prefetch={false}
              scroll={false}
              className="line-clamp-2 font-semibold hover:underline focus-visible:outline-ring"
            >
              {item.title || '제목 없는 질문지'}
            </Link>
          )}
          {!item.archivedAt && !item.isOwner && unread && (
            <NewQuestionnaireBadge />
          )}
          {item.isOwner && (
            <>
              <NewReviewBadge count={item.unreadReviewCount ?? 0} />
              <ReviewRequestBadge count={item.pendingReviewCount} />
            </>
          )}
        </div>
        <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground">
          <span>{creator}</span>
          <span className="whitespace-nowrap">
            {published ? '배포' : '수정'} {day}
          </span>
          {item.archivedAt && (
            <span className="block">복원 후 내용을 열 수 있습니다.</span>
          )}
        </p>
      </TableCell>
      <TableCell className="px-4 pb-4 pt-2 sm:px-2 sm:py-4">
        <Management item={item} />
      </TableCell>
      <TableCell className="pb-4 pl-2 pr-4 pt-2 sm:py-4">
        <div className="flex items-center justify-end gap-3">
          {!item.archivedAt && (
            <Button
              variant="outline"
              size="icon-sm"
              className="relative"
              title={
                published
                  ? `제출된 응답 ${item.submittedResponseCount ?? 0}명 보기`
                  : item.status === 'draft'
                    ? '이어서 작성'
                    : '질문지 열기'
              }
              nativeButton={false}
              render={
                <Link
                  href={published ? responsesHref : href}
                  prefetch={false}
                  scroll={false}
                />
              }
              aria-label={`${item.title || '제목 없는 질문지'} ${published ? `제출된 응답 ${item.submittedResponseCount ?? 0}명 보기` : item.status === 'draft' ? '이어서 작성' : '열기'}`}
            >
              {published ? (
                <MessageSquareText aria-hidden="true" />
              ) : item.status === 'draft' ? (
                <Pencil aria-hidden="true" />
              ) : (
                <Eye aria-hidden="true" />
              )}
              {published && (
                <span
                  aria-hidden="true"
                  className="absolute -right-2 -top-2 min-w-4 rounded bg-muted px-1 text-[10px] font-semibold leading-4 text-foreground"
                >
                  {item.submittedResponseCount ?? 0}
                </span>
              )}
            </Button>
          )}
          {item.canDelete && !item.hasPublished && !item.archivedAt && (
            <DeleteQuestionnaireButton
              questionnaireId={item.id}
              revision={item.revision}
              hasPublished={false}
              title={item.title}
            />
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
