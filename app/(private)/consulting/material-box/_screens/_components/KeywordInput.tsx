'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { FormEvent } from 'react';

import { ConsultingProgressButton } from '@/app/(private)/consulting/_components/ConsultingProgressButton';
import { Input } from '@/components/ui/input';

export function KeywordInput({
  majors,
  keywords,
  validationMessage,
  onKeywordChange,
  onSubmit,
}: {
  majors: ReadonlyArray<string>;
  keywords: ReadonlyArray<string>;
  validationMessage: string | null;
  onKeywordChange: (index: number, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-4xl">
      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: 'easeOut' }}
        className="rounded-2xl border border-blue-500/20 bg-blue-500/6 p-5 md:p-6"
      >
        <h2 className="text-lg font-bold">전공별 세부 키워드</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          각 희망 전공에서 관심 있는 세부 분야나 탐구하고 싶은 주제를
          입력해주세요.
        </p>

        <div className="mt-5 space-y-4">
          {majors.map((major, index) => {
            const inputId = `detail-keyword-${index}`;

            return (
              <div
                key={`${index}-${major}`}
                className="rounded-2xl border border-blue-500/15 bg-background/90 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {index + 1}순위
                  </span>
                  <label htmlFor={inputId} className="font-semibold">
                    {major}
                  </label>
                </div>
                <Input
                  id={inputId}
                  value={keywords[index] ?? ''}
                  autoFocus={index === 0}
                  maxLength={80}
                  onChange={(event) =>
                    onKeywordChange(index, event.target.value)
                  }
                  className="mt-3 bg-background"
                  placeholder={`${major}에서 관심 있는 세부 분야`}
                />
              </div>
            );
          })}
        </div>

        {validationMessage && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {validationMessage}
          </p>
        )}
      </motion.section>

      <div className="mt-5 flex justify-end">
        <ConsultingProgressButton type="submit">
          키워드 입력하기
        </ConsultingProgressButton>
      </div>
    </form>
  );
}
