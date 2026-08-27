'use client';

import type { FormEvent, ReactNode } from 'react';

import { ConsultingProgressButton } from '@/app/(private)/consulting/_components/ConsultingProgressButton';
import { MaterialBoxTable } from '@/app/(private)/consulting/material-box/_screens/_components/MaterialBoxTable';
import { Input } from '@/components/ui/input';

export function KeywordInput({
  isReviewing,
  majors,
  keywords,
  validationMessage,
  onKeywordChange,
  onSubmit,
  keywordSuggestionAction,
}: {
  isReviewing: boolean;
  majors: ReadonlyArray<string>;
  keywords: ReadonlyArray<string>;
  validationMessage: string | null;
  onKeywordChange: (index: number, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  keywordSuggestionAction?: ReactNode;
}) {
  const majorRowCount = majors.length === 1 ? 1 : majors.length === 2 ? 2 : 3;

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-4xl">
      <MaterialBoxTable
        focus="keyword"
        majorRowCount={majorRowCount}
        majors={majors}
        keywords={keywords}
        renderKeywordCell={
          isReviewing
            ? undefined
            : (index) => {
                const major = majors[index];
                const inputId = `detail-keyword-${index}`;

                return (
                  <div className="min-w-0" key={`${index}-${major}`}>
                    <label htmlFor={inputId} className="sr-only">
                      {major} 세부 키워드
                    </label>
                    <Input
                      id={inputId}
                      value={keywords[index] ?? ''}
                      autoFocus={index === 0}
                      maxLength={120}
                      aria-invalid={Boolean(validationMessage)}
                      onChange={(event) =>
                        onKeywordChange(index, event.target.value)
                      }
                      className="h-9 min-w-0 bg-background font-medium shadow-none"
                      placeholder="세부 키워드 입력"
                    />
                  </div>
                );
              }
        }
      />

      {!isReviewing && validationMessage && (
        <p
          className="mt-3 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {validationMessage}
        </p>
      )}

      {!isReviewing && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {keywordSuggestionAction ?? <span />}
          <ConsultingProgressButton type="submit">
            입력 확인하기
          </ConsultingProgressButton>
        </div>
      )}
    </form>
  );
}
