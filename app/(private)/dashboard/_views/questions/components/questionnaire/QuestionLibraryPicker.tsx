'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type QuestionBlockRow, questionName } from '../../lib/question-blocks';
import { richTextPlainText } from '../../lib/rich-text';

export function QuestionLibraryPicker({
  questions,
  placedIds,
  onAdd,
  error,
  loading,
  refresh,
}: {
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
    <section
      aria-label="저장된 질문 불러오기"
      className="space-y-4 rounded-xl border p-5"
    >
      <header>
        <h2 className="font-semibold">저장된 질문 불러오기</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          질문 관리에서 만든 질문을 고르세요. 참조하는 앞선 질문도 함께
          추가됩니다.
        </p>
      </header>
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
      <div className="space-y-2">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            질문을 불러오고 있어요.
          </p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {questions.length
              ? '검색 결과가 없어요.'
              : '저장된 질문이 없어요. 새 질문 만들기에서 질문을 작성해 주세요.'}
          </p>
        ) : (
          filtered.map((q) => (
            <button
              key={q.id}
              type="button"
              disabled={placedIds.has(q.id) || !!error}
              onClick={() => onAdd(q.id)}
              aria-label={`${questionName(q)} ${placedIds.has(q.id) ? '배치됨' : '불러오기'}`}
              className="flex cursor-pointer w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors enabled:hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {questionName(q)}
                </span>
                <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {richTextPlainText(q.prompt)}
                </span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  답변 열 {q.fields.length}개{q.condition ? ' · 조건 있음' : ''}
                </span>
              </span>
              {placedIds.has(q.id) && (
                <span className="text-xs text-muted-foreground">배치됨</span>
              )}
            </button>
          ))
        )}
      </div>
    </section>
  );
}
