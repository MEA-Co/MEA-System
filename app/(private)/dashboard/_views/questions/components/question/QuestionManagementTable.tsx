'use client';

import { Files, Link2, Trash2 } from 'lucide-react';
import useSWR from 'swr';

import { CollectionTableState } from '@/components/patterns/collection-table-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { type QuestionBlockRow, questionName } from '../../lib/question-blocks';
import { questionnaireFetcher } from '../../lib/questionnaire/api-client';
import { richTextPlainText } from '../../lib/rich-text';
import {
  NewReviewBadge,
  ReviewRequestBadge,
} from '../questionnaire/ReviewRequestBadge';

const usageStatusLabels = {
  draft: '수정 중',
  published: '게시',
  distributed: '배포',
  archived: '보관',
};

function QuestionUsageList({ question }: { question: QuestionBlockRow }) {
  const usages = question.questionnaire_usage;
  if (usages == null)
    return (
      <span className="text-xs text-muted-foreground">
        사용 질문지 확인 불가
      </span>
    );
  if (!usages.length)
    return (
      <span className="text-xs text-muted-foreground">사용 질문지 없음</span>
    );
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          onClick={(event) => event.stopPropagation()}
          aria-label={`사용 중인 질문지 ${usages.length}개`}
        >
          <Files className="size-3" aria-hidden="true" />
          질문지 {usages.length}개에서 사용
        </TooltipTrigger>
        <TooltipContent className="block max-h-72 max-w-sm overflow-y-auto p-3">
          <p className="mb-2 font-semibold">사용 중인 질문지</p>
          <ul className="space-y-1.5">
            {usages.map((usage) => (
              <li key={usage.id} className="break-words">
                {usage.title}{' '}
                <span className="opacity-70">
                  · {usageStatusLabels[usage.status]}
                </span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function QuestionReferenceList({ question }: { question: QuestionBlockRow }) {
  const references = question.referencing_questions;
  if (references == null)
    return (
      <span className="text-xs text-muted-foreground">참조 질문 확인 불가</span>
    );
  if (!references.length)
    return (
      <span className="text-xs text-muted-foreground">
        {question.referenced_by_question
          ? '조회할 수 없는 질문에서 참조 중'
          : '참조 질문 없음'}
      </span>
    );
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          onClick={(event) => event.stopPropagation()}
          aria-label={`참조 중인 질문 ${references.length}개`}
        >
          <Link2 className="size-3" aria-hidden="true" />
          질문 {references.length}개에서 참조
        </TooltipTrigger>
        <TooltipContent className="block max-h-72 max-w-sm overflow-y-auto p-3">
          <p className="mb-2 font-semibold">이 질문을 참조하는 질문</p>
          <ul className="space-y-1.5">
            {references.map((reference) => (
              <li key={reference.id} className="break-words">
                {reference.title}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DeleteQuestionButton({
  question,
  onArchive,
}: {
  question: QuestionBlockRow;
  onArchive: (question: QuestionBlockRow) => void;
}) {
  const reasons = [
    question.questionnaire_usage?.length
      ? '사용 중인 질문지가 있어 삭제할 수 없어요.'
      : null,
    question.referenced_by_question
      ? '다른 질문이 참조하고 있어 삭제할 수 없어요.'
      : null,
    question.questionnaire_usage == null ||
    question.referenced_by_question == null
      ? '사용 여부를 확인할 수 없어요. 목록을 새로고침해 주세요.'
      : null,
  ].filter(Boolean);
  const reason = reasons.join(' ');
  const button = (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={!!reason}
      aria-label={`${questionName(question)} 삭제`}
      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/10"
      onClick={(event) => {
        event.stopPropagation();
        if (!reason) onArchive(question);
      }}
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </Button>
  );
  if (!reason) return button;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={<span tabIndex={0} />}
          className="inline-flex"
          aria-label={`${questionName(question)} 삭제 불가: ${reason}`}
          onClick={(event) => event.stopPropagation()}
        >
          {button}
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function QuestionManagementTable({
  questions,
  canManage,
  showCreator = false,
  onOpen,
  onArchive,
  loading = false,
  error = false,
  filtered = false,
  onRetry,
  selection,
}: {
  selection?: { addedIds: Set<string>; disabled?: boolean };
  questions: QuestionBlockRow[];
  loading?: boolean;
  error?: boolean;
  filtered?: boolean;
  onRetry?: () => void;
  showCreator?: boolean;
  canManage: (q: QuestionBlockRow) => boolean;
  onOpen: (q: QuestionBlockRow) => void;
  onArchive: (q: QuestionBlockRow) => void;
}) {
  const { data: reviewCounts, error: reviewError } = useSWR<{
    counts: Record<string, number>;
    unreadCounts: Record<string, number>;
  }>(
    !selection && questions.length
      ? `/api/question-reviews?questions=${questions.map((q) => q.id).join(',')}`
      : null,
    questionnaireFetcher,
    { refreshInterval: 10000 },
  );
  return (
    <div className="min-h-84 overflow-hidden rounded-lg border bg-background">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead
              className={showCreator ? 'pl-4 lg:w-[35%]' : 'pl-4 lg:w-[43%]'}
            >
              질문
            </TableHead>
            <TableHead className="hidden w-[22%] lg:table-cell">
              참조 중인 질문
            </TableHead>
            <TableHead className="hidden w-[23%] lg:table-cell">
              사용 중인 질문지
            </TableHead>
            {showCreator && (
              <TableHead className="hidden w-[13%] lg:table-cell">
                제작자
              </TableHead>
            )}
            <TableHead className="w-20 text-right pr-4">
              <span className="inline-block w-8 text-center">
                {selection ? '선택' : '관리'}
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading || error || !questions.length ? (
            <CollectionTableState
              colSpan={showCreator ? 5 : 4}
              loading={loading}
              title={
                loading
                  ? '질문을 불러오는 중입니다'
                  : error
                    ? '질문 목록을 불러오지 못했습니다'
                    : filtered
                      ? '검색 결과가 없습니다'
                      : '등록된 질문이 없습니다'
              }
              description={
                error
                  ? '잠시 후 다시 시도해 주세요.'
                  : filtered
                    ? '다른 이름이나 내용으로 검색해 보세요.'
                    : '새 질문 만들기 버튼으로 질문을 등록하세요.'
              }
              action={
                error && onRetry ? (
                  <Button variant="outline" onClick={onRetry}>
                    다시 불러오기
                  </Button>
                ) : undefined
              }
            />
          ) : (
            questions.map((q) => (
              <TableRow
                key={q.id}
                className={`${(selection ? !selection.disabled && !selection.addedIds.has(q.id) : canManage(q)) ? 'cursor-pointer' : ''} ${reviewCounts?.unreadCounts[q.id] ? 'bg-blue-50/80 hover:bg-blue-100/70 dark:bg-blue-950/30' : ''}`}
                onClick={() => {
                  if (
                    selection
                      ? !selection.disabled && !selection.addedIds.has(q.id)
                      : canManage(q)
                  )
                    onOpen(q);
                }}
              >
                <TableCell className="whitespace-normal py-4 pl-4 align-top">
                  {(
                    selection
                      ? !selection.disabled && !selection.addedIds.has(q.id)
                      : canManage(q)
                  ) ? (
                    <button
                      type="button"
                      className="max-w-full cursor-pointer text-left font-semibold hover:underline focus-visible:outline-ring"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(q);
                      }}
                      title={questionName(q)}
                    >
                      <span className="line-clamp-2 break-words">
                        {questionName(q)}
                      </span>
                    </button>
                  ) : (
                    <span
                      className="line-clamp-2 font-medium"
                      title={questionName(q)}
                    >
                      {questionName(q)}
                    </span>
                  )}
                  <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">
                    {richTextPlainText(q.prompt)}
                  </p>
                  {q.purpose === 'study_registration' && (
                    <Badge variant="subtle" className="mt-2">
                      학습법 등록 안내
                    </Badge>
                  )}
                  {!selection && (
                    <div className="mt-2 flex flex-wrap gap-2 empty:hidden">
                      <NewReviewBadge
                        count={reviewCounts?.unreadCounts[q.id] ?? 0}
                      />
                      <ReviewRequestBadge
                        count={reviewCounts?.counts[q.id] ?? 0}
                      />
                      {reviewError && (
                        <span className="text-xs text-muted-foreground">
                          검토 요청 확인 불가
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 lg:hidden">
                    <QuestionReferenceList question={q} />
                    <QuestionUsageList question={q} />
                    {showCreator && (
                      <span className="text-xs text-muted-foreground">
                        제작자 · {q.creator_name?.trim() || '이름 없음'}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden whitespace-normal py-4 align-top lg:table-cell">
                  <QuestionReferenceList question={q} />
                </TableCell>
                <TableCell className="hidden whitespace-normal py-4 align-top lg:table-cell">
                  <QuestionUsageList question={q} />
                </TableCell>
                {showCreator && (
                  <TableCell className="hidden whitespace-normal break-words py-4 align-top lg:table-cell">
                    {q.creator_name?.trim() || '이름 없음'}
                  </TableCell>
                )}
                <TableCell className="py-4 pr-4 text-right align-top">
                  {selection ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        selection.disabled || selection.addedIds.has(q.id)
                      }
                      aria-label={`${questionName(q)} ${selection.addedIds.has(q.id) ? '추가됨' : '추가'}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(q);
                      }}
                    >
                      {selection.addedIds.has(q.id) ? '추가됨' : '추가'}
                    </Button>
                  ) : canManage(q) ? (
                    <DeleteQuestionButton question={q} onArchive={onArchive} />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      읽기 전용
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
