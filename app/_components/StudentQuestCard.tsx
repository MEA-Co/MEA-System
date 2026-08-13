'use client';

import { Check, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { useActionState, useState } from 'react';

import { saveQuestResponse } from '@/app/_lib/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { Quest, QuestResponse } from '@/lib/quest';

type StudentQuestCardProps = {
  quest: Quest;
  number: number;
  initialResponse?: QuestResponse;
};

function createInitialRows(
  quest: Quest,
  initialResponse?: QuestResponse,
): string[][] {
  if (
    initialResponse?.answer.type === 'table' &&
    initialResponse.answer.rows.length > 0
  ) {
    return initialResponse.answer.rows.map((row) =>
      quest.table_columns.map((_, index) => row[index] ?? ''),
    );
  }

  return [quest.table_columns.map(() => '')];
}

export function StudentQuestCard({
  quest,
  number,
  initialResponse,
}: StudentQuestCardProps) {
  const [state, formAction, pending] = useActionState(saveQuestResponse, {});
  const [rows, setRows] = useState(() =>
    createInitialRows(quest, initialResponse),
  );
  const textAnswer =
    initialResponse?.answer.type === 'text' ? initialResponse.answer.value : '';

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    setRows((currentRows) =>
      currentRows.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? row.map((cell, currentColumnIndex) =>
              currentColumnIndex === columnIndex ? value : cell,
            )
          : row,
      ),
    );
  }

  function addRow() {
    setRows((currentRows) => [
      ...currentRows,
      quest.table_columns.map(() => ''),
    ]);
  }

  function removeRow(rowIndex: number) {
    setRows((currentRows) =>
      currentRows.length === 1
        ? currentRows
        : currentRows.filter((_, index) => index !== rowIndex),
    );
  }

  return (
    <Card className="gap-0 py-0">
      <form action={formAction}>
        <input type="hidden" name="quest_id" value={quest.id} />
        <input type="hidden" name="answer_type" value={quest.answer_type} />
        {quest.answer_type === 'table' ? (
          <input type="hidden" name="table_rows" value={JSON.stringify(rows)} />
        ) : null}

        <CardHeader className="rounded-none border-b px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {number}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base leading-6">
                  {quest.question}
                </CardTitle>
                <Badge variant="secondary">
                  {quest.answer_type === 'text' ? '텍스트' : '표'}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 py-5 sm:px-6">
          {quest.answer_type === 'text' ? (
            <Textarea
              name="text_answer"
              defaultValue={textAnswer}
              placeholder="답변을 입력해 주세요."
              maxLength={10000}
              className="min-h-32"
              aria-label={`${quest.question} 답변`}
            />
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {quest.table_columns.map((column) => (
                        <TableHead key={column} className="h-10 min-w-40">
                          {column}
                        </TableHead>
                      ))}
                      <TableHead className="h-10 w-12">
                        <span className="sr-only">행 삭제</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, rowIndex) => (
                      <TableRow key={rowIndex} className="hover:bg-transparent">
                        {row.map((cell, columnIndex) => (
                          <TableCell key={columnIndex} className="p-2">
                            <Input
                              value={cell}
                              onChange={(event) =>
                                updateCell(
                                  rowIndex,
                                  columnIndex,
                                  event.target.value,
                                )
                              }
                              maxLength={1000}
                              placeholder="답변 입력"
                              className="min-w-36"
                              aria-label={`${quest.table_columns[columnIndex]} ${rowIndex + 1}행`}
                            />
                          </TableCell>
                        ))}
                        <TableCell className="p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeRow(rowIndex)}
                            disabled={rows.length === 1}
                            aria-label={`${rowIndex + 1}행 삭제`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                disabled={rows.length >= 50}
              >
                <Plus className="size-4" />행 추가
              </Button>
            </div>
          )}

          {state.error ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p
              role="status"
              className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <Check className="size-4" />
              답변을 저장했습니다.
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="justify-end rounded-none border-t px-5 py-4 sm:px-6">
          <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {pending ? '저장 중...' : '답변 저장'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
