'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { FormEvent } from 'react';

import { ConsultingProgressButton } from '@/app/(private)/consulting/_components/ConsultingProgressButton';
import { Input } from '@/components/ui/input';

export function KeywordInput({
  majors,
  keyword,
  validationMessage,
  onKeywordChange,
  onSubmit,
}: {
  majors: ReadonlyArray<string>;
  keyword: string;
  validationMessage: string | null;
  onKeywordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-4xl">
      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="rounded-2xl border bg-background/90 p-5 shadow-sm md:p-6"
      >
        <p className="text-sm font-semibold">희망 전공</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {majors.map((major, index) => (
            <div
              key={`${index}-${major}`}
              className="rounded-xl border border-blue-500/20 bg-blue-500/6 px-4 py-3"
            >
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                {index + 1}순위
              </p>
              <p className="mt-1 font-semibold">{major}</p>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.38,
          delay: shouldReduceMotion ? 0 : 0.2,
          ease: 'easeOut',
        }}
        className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/6 p-5 md:p-6"
      >
        <label htmlFor="detail-keyword" className="text-sm font-semibold">
          나의 세부 키워드
        </label>
        <p className="mt-1 text-sm text-muted-foreground">
          관심 있는 세부 분야나 탐구하고 싶은 주제를 입력해주세요.
        </p>
        <Input
          id="detail-keyword"
          value={keyword}
          autoFocus
          maxLength={80}
          onChange={(event) => onKeywordChange(event.target.value)}
          className="mt-4 bg-background"
          placeholder="예: 인공지능 검색 모델"
        />

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
