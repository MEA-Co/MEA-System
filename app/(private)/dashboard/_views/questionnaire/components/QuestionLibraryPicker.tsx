'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import {
  type QuestionBlockRow,
  questionName,
} from '../../questions/lib/question-blocks';
import { richTextPlainText } from '../../questions/lib/rich-text';

export function QuestionLibraryPicker({
  open,
  onOpenChange,
  questions,
  placedIds,
  onAdd,
  error,
  loading,
  refresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: QuestionBlockRow[];
  placedIds: Set<string>;
  onAdd: (id: string) => void;
  error?: string;
  loading: boolean;
  refresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = questions.filter((q) =>
    `${questionName(q)} ${richTextPlainText(q.prompt)}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>저장된 질문 배치</DialogTitle>
          <DialogDescription>
            질문 관리에서 만든 질문을 고르세요. 참조하는 앞선 질문도 함께
            추가됩니다.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="저장된 질문 검색"
          placeholder="질문 이름이나 내용으로 검색"
        />
        {error && (
          <div role="alert" className="text-sm text-destructive">
            {error}{' '}
            <Button variant="ghost" size="sm" onClick={refresh}>
              다시 불러오기
            </Button>
          </div>
        )}
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              질문을 불러오고 있어요.
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {questions.length
                ? '검색 결과가 없어요.'
                : '저장된 질문이 없어요. 질문 관리에서 먼저 질문을 만들어 주세요.'}
            </p>
          ) : (
            filtered.map((q) => (
              <div
                key={q.id}
                className="flex items-center gap-4 rounded-xl border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {questionName(q)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {richTextPlainText(q.prompt)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    답변 열 {q.fields.length}개
                    {q.condition ? ' · 조건 있음' : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={placedIds.has(q.id) || !!error}
                  onClick={() => onAdd(q.id)}
                >
                  {placedIds.has(q.id) ? '배치됨' : '배치'}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
