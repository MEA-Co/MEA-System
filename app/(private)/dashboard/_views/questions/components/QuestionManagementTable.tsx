import { Trash2 } from 'lucide-react';

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

import { type QuestionBlockRow, questionName } from '../lib/question-blocks';
import { describeClause } from '../lib/question-list';
import { richTextPlainText } from '../lib/rich-text';

function ConditionBadge({ children }: { children: string }) {
  return (
    <Badge variant="secondary" className="max-w-44 align-middle">
      <span className="truncate" title={children}>
        {children}
      </span>
    </Badge>
  );
}

export function QuestionConditions({
  question,
  questions,
}: {
  question: QuestionBlockRow;
  questions: QuestionBlockRow[];
}) {
  const name = (id: string) => {
    const q = questions.find((q) => q.id === id);
    return q ? questionName(q) : '찾을 수 없는 질문';
  };
  const clauses = question.condition?.clauses ?? [];
  return (
    <div className="space-y-2 text-xs leading-6 text-muted-foreground">
      {clauses.map((clause, index) => {
        const text = describeClause(clause, questions);
        return (
          <div key={index}>
            {index > 0 && (
              <span className="mr-1">
                {question.condition?.mode === 'any' ? '또는' : '그리고'}
              </span>
            )}
            <ConditionBadge>{name(clause.blockId)}</ConditionBadge>의{' '}
            <ConditionBadge>{text.fieldLabel}</ConditionBadge>
            {text.particle}{' '}
            {text.valueLabel !== null && (
              <>
                <ConditionBadge>{text.valueLabel}</ConditionBadge>{' '}
              </>
            )}
            {text.suffix}
          </div>
        );
      })}
      {question.source_block_id && (
        <div>
          <ConditionBadge>{name(question.source_block_id)}</ConditionBadge>의
          응답 항목 참조
        </div>
      )}
      {question.after_block_id && (
        <div>
          <ConditionBadge>{name(question.after_block_id)}</ConditionBadge>{' '}
          다음에 진행
        </div>
      )}
      {!clauses.length &&
        !question.source_block_id &&
        !question.after_block_id && <span>조건 없음</span>}
    </div>
  );
}

export function QuestionManagementTable({
  questions,
  allQuestions,
  canManage,
  onOpen,
  onArchive,
}: {
  questions: QuestionBlockRow[];
  allQuestions: QuestionBlockRow[];
  canManage: (q: QuestionBlockRow) => boolean;
  onOpen: (q: QuestionBlockRow) => void;
  onArchive: (q: QuestionBlockRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <Table className="min-w-[940px] table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[45%] pl-5">질문</TableHead>
            <TableHead className="w-[43%]">조건</TableHead>
            <TableHead className="w-[12%] text-right pr-5">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((q) => (
            <TableRow
              key={q.id}
              className={canManage(q) ? 'cursor-pointer' : ''}
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
              </TableCell>
              <TableCell className="whitespace-normal py-4 align-top">
                <QuestionConditions question={q} questions={allQuestions} />
              </TableCell>
              <TableCell className="py-4 pr-5 text-right align-top">
                {canManage(q) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${questionName(q)} 보관`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onArchive(q);
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
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
