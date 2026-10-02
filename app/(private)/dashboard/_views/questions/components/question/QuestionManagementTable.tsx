'use client';

import { Files, Link2, Trash2 } from 'lucide-react';
import useSWR from 'swr';

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
          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 focus-visible:outline-2 focus-visible:outline-ring dark:bg-blue-950 dark:text-blue-200"
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
          className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 focus-visible:outline-2 focus-visible:outline-ring dark:bg-violet-950 dark:text-violet-200"
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
}: {
  questions: QuestionBlockRow[];
  showCreator?: boolean;
  canManage: (q: QuestionBlockRow) => boolean;
  onOpen: (q: QuestionBlockRow) => void;
  onArchive: (q: QuestionBlockRow) => void;
}) {
  const { data: reviewCounts, error: reviewError } = useSWR<{
    counts: Record<string, number>;
    unreadCounts: Record<string, number>;
  }>(
    questions.length
      ? `/api/question-reviews?questions=${questions.map((q) => q.id).join(',')}`
      : null,
    questionnaireFetcher,
    { refreshInterval: 10000 },
  );
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <Table className="min-w-[940px] table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead
              className={showCreator ? 'w-[30%] pl-5' : 'w-[43%] pl-5'}
            >
              질문
            </TableHead>
            <TableHead className="w-[22%]">참조 중인 질문</TableHead>
            <TableHead className="w-[23%]">사용 중인 질문지</TableHead>
            {showCreator && <TableHead className="w-[13%]">제작자</TableHead>}
            <TableHead className="w-[12%] text-right pr-5">
              <span className="inline-block w-8 text-center">관리</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((q) => (
            <TableRow
              key={q.id}
              className={`${canManage(q) ? 'cursor-pointer' : ''} ${reviewCounts?.unreadCounts[q.id] ? 'bg-blue-50/80 hover:bg-blue-100/70 dark:bg-blue-950/30' : ''}`}
              onClick={() => {
                if (canManage(q)) onOpen(q);
              }}
            >
              <TableCell className="whitespace-normal py-4 pl-5 align-top">
                {canManage(q) ? (
                  <button
                    type="button"
                    className="max-w-full cursor-pointer text-left font-medium hover:underline focus-visible:outline-ring"
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
                {(reviewCounts?.unreadCounts[q.id] ?? 0) > 0 && (
                  <span className="mt-2 mr-2 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                    <span className="size-2 rounded-full bg-blue-500" />새 검토
                    요청 {reviewCounts?.unreadCounts[q.id]}
                  </span>
                )}
                {reviewCounts?.counts[q.id] ? (
                  <span className="mt-2 inline-block rounded-full bg-green-50 px-2 py-1 text-xs text-green-700">
                    검토 요청 {reviewCounts.counts[q.id]}
                  </span>
                ) : reviewError ? (
                  <span className="text-xs text-muted-foreground">
                    검토 요청 확인 불가
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="whitespace-normal py-4 align-top">
                <QuestionReferenceList question={q} />
              </TableCell>
              <TableCell className="whitespace-normal py-4 align-top">
                <QuestionUsageList question={q} />
              </TableCell>
              {showCreator && (
                <TableCell className="whitespace-normal break-words py-4 align-top">
                  {q.creator_name?.trim() || '이름 없음'}
                </TableCell>
              )}
              <TableCell className="py-4 pr-5 text-right align-top">
                {canManage(q) ? (
                  <DeleteQuestionButton question={q} onArchive={onArchive} />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    읽기 전용
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
