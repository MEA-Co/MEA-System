'use client';

import { LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useRef, useState, useTransition } from 'react';

import { createQuest } from '@/app/_lib/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { STUDENT_PERIODS, type StudentPeriod } from '@/lib/profile';
import type { QuestAnswerType } from '@/lib/quest';

type DraftColumn = {
  id: number;
  value: string;
};

const initialColumns: DraftColumn[] = [
  { id: 0, value: '' },
  { id: 1, value: '' },
];

export function QuestFormDialog() {
  const router = useRouter();
  const nextColumnId = useRef(2);
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<StudentPeriod | null>(null);
  const [answerType, setAnswerType] = useState<QuestAnswerType>('text');
  const [columns, setColumns] = useState<DraftColumn[]>(initialColumns);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm(form?: HTMLFormElement) {
    form?.reset();
    setPeriod(null);
    setAnswerType('text');
    setColumns(initialColumns);
    setError(null);
    nextColumnId.current = 2;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setError(null);
    startTransition(async () => {
      const result = await createQuest(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      resetForm(form);
      setOpen(false);
      router.refresh();
    });
  }

  function addColumn() {
    if (columns.length >= 8) return;

    setColumns((current) => [
      ...current,
      { id: nextColumnId.current++, value: '' },
    ]);
  }

  function removeColumn(id: number) {
    if (columns.length === 1) return;
    setColumns((current) => current.filter((column) => column.id !== id));
  }

  function updateColumn(id: number, value: string) {
    setColumns((current) =>
      current.map((column) =>
        column.id === id ? { ...column, value } : column,
      ),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button className="rounded-md bg-blue-600 text-white hover:bg-blue-700" />
        }
      >
        <Plus />
        Quest 추가
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>새 Quest 추가</DialogTitle>
          <DialogDescription>
            학생에게 보여줄 질문과 답변 형식을 설정합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input type="hidden" name="student_period" value={period ?? ''} />
          <input type="hidden" name="answer_type" value={answerType} />

          <div className="space-y-2.5">
            <Label htmlFor="quest-period">대상 시기</Label>
            <Select
              value={period}
              onValueChange={(value) =>
                setPeriod(value as StudentPeriod | null)
              }
            >
              <SelectTrigger id="quest-period" className="h-11 w-full">
                <SelectValue placeholder="시기를 선택해 주세요" />
              </SelectTrigger>
              <SelectContent>
                {STUDENT_PERIODS.map((studentPeriod) => (
                  <SelectItem key={studentPeriod} value={studentPeriod}>
                    {studentPeriod}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="quest-question">질문</Label>
            <Textarea
              id="quest-question"
              name="question"
              placeholder="학생에게 물어볼 질문을 입력해 주세요"
              required
              maxLength={500}
              className="min-h-28 resize-y"
            />
            <p className="text-xs text-muted-foreground">최대 500자</p>
          </div>

          <div className="space-y-3">
            <Label>답변 형식</Label>
            <RadioGroup
              value={answerType}
              onValueChange={(value) => setAnswerType(value as QuestAnswerType)}
              className="grid gap-3 sm:grid-cols-2"
            >
              <Label
                htmlFor="answer-type-text"
                className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-4 hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-primary/5"
              >
                <RadioGroupItem id="answer-type-text" value="text" />
                <span>
                  <span className="block font-medium">일반 텍스트</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    문장이나 단락으로 답변합니다.
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="answer-type-table"
                className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-4 hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-primary/5"
              >
                <RadioGroupItem id="answer-type-table" value="table" />
                <span>
                  <span className="block font-medium">표</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    지정한 열에 맞춰 행을 작성합니다.
                  </span>
                </span>
              </Label>
            </RadioGroup>
          </div>

          {answerType === 'table' ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>표 열 구성</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    학생이 입력할 표의 열 이름을 정합니다.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-md"
                  onClick={addColumn}
                  disabled={columns.length >= 8}
                >
                  <Plus />열 추가
                </Button>
              </div>

              <div className="space-y-2">
                {columns.map((column, index) => (
                  <div key={column.id} className="flex items-center gap-2">
                    <Input
                      name="table_column"
                      value={column.value}
                      onChange={(event) =>
                        updateColumn(column.id, event.target.value)
                      }
                      placeholder={`열 ${index + 1} 이름`}
                      required
                      maxLength={40}
                      className="h-10 rounded-md"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${index + 1}번째 열 삭제`}
                      onClick={() => removeColumn(column.id)}
                      disabled={columns.length === 1}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                열은 최대 8개까지 추가할 수 있습니다.
              </p>
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-md"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button
              type="submit"
              className="rounded-md bg-blue-600 text-white hover:bg-blue-700"
              disabled={isPending}
            >
              {isPending ? <LoaderCircle className="animate-spin" /> : null}
              {isPending ? '추가 중...' : 'Quest 추가'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
