'use client';

import { Check, CircleAlert, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { type FormEvent, useState } from 'react';

import type {
  MajorPreference,
  MentorAdvice,
  MentorAdviceQuestion,
} from '@/app/consulting/material-box/_lib/materialBoxConsulting';
import { Input } from '@/components/ui/input';
import { ConsultingAdvice } from '@/features/consulting/components/ConsultingAdvice';
import { ConsultingProgressButton } from '@/features/consulting/components/ConsultingProgressButton';
import type { ConsultingResourceStatus } from '@/features/consulting/runner/types';
import { cn } from '@/lib/utils';

const questions: ReadonlyArray<{
  id: MentorAdviceQuestion;
  title: string;
}> = [
  {
    id: 'mentor-interests',
    title: '멘토들은 어떤 관심사를 가졌는지 궁금해요!',
  },
  {
    id: 'keyword-help',
    title: '세부 키워드를 도저히 정하지 못하겠으면 어떻게 하나요?',
  },
];

type KeywordExplorationScreenProps = {
  advice: Array<MentorAdvice>;
  adviceStatus: ConsultingResourceStatus;
  isInteractive: boolean;
  preferences: Array<MajorPreference>;
  submittedKeyword: string;
  onSubmit: (keyword: string) => void;
};

export function KeywordExplorationScreen({
  advice,
  adviceStatus,
  isInteractive,
  preferences,
  submittedKeyword,
  onSubmit,
}: KeywordExplorationScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const [keyword, setKeyword] = useState(submittedKeyword);
  const [openQuestion, setOpenQuestion] = useState<MentorAdviceQuestion | null>(
    null,
  );
  const [selectedAdviceId, setSelectedAdviceId] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  const selectAdvice = (mentorAdvice: MentorAdvice) => {
    setKeyword(mentorAdvice.keyword);
    setSelectedAdviceId(mentorAdvice.id);
    setValidationMessage(null);
    setOpenQuestion(null);
  };

  const submitKeyword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isInteractive) return;

    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) {
      setValidationMessage('관심 가는 세부 키워드를 한 개 작성해 주세요.');
      return;
    }

    setValidationMessage(null);
    onSubmit(normalizedKeyword);
  };

  return (
    <motion.form
      onSubmit={submitKeyword}
      className="mx-auto min-h-112 w-full max-w-4xl pt-6 pb-56 md:pt-8 md:pb-48"
    >
      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="rounded-2xl border bg-background/90 p-5 shadow-sm md:p-6"
      >
        <p className="text-sm font-semibold">희망 전공</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {preferences.map((preference, index) => (
            <div
              key={`${index}-${preference.major}`}
              className="rounded-xl border border-blue-500/20 bg-blue-500/6 px-4 py-3"
            >
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                {index + 1}순위
              </p>
              <p className="mt-1 font-semibold">{preference.major}</p>
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
          직접 입력하거나 아래 멘토의 조언에서 하나를 선택해보세요.
        </p>
        <Input
          id="detail-keyword"
          value={keyword}
          readOnly={!isInteractive}
          onChange={(event) => {
            setKeyword(event.target.value);
            setSelectedAdviceId(null);
            setValidationMessage(null);
          }}
          className="mt-4 bg-background"
          placeholder="예: 인공지능 검색 모델"
        />

        {isInteractive && validationMessage && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 text-sm text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {validationMessage}
          </p>
        )}
      </motion.section>

      <div className="mt-5 space-y-3">
        {questions.map((question, index) => {
          const questionAdvice = advice.filter(
            (mentorAdvice) => mentorAdvice.question === question.id,
          );

          return (
            <motion.section
              key={question.id}
              initial={
                shouldReduceMotion ? false : { opacity: 0, y: 16, scale: 0.99 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.38,
                delay: shouldReduceMotion ? 0 : 0.48 + index * 0.2,
                ease: 'easeOut',
              }}
              className="flex flex-col gap-4 rounded-2xl border bg-background/90 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between md:p-6"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm font-bold text-blue-700 dark:text-blue-300">
                  {index + 1}
                </span>
                <h2 className="font-semibold leading-7">{question.title}</h2>
              </div>

              <ConsultingAdvice
                open={openQuestion === question.id}
                onOpenChange={(open) =>
                  setOpenQuestion(open ? question.id : null)
                }
                title="멘토의 조언"
                description={question.title}
                triggerLabel={
                  adviceStatus === 'loading'
                    ? '조언 준비 중'
                    : adviceStatus === 'error'
                      ? '조언 불러오기 실패'
                      : '멘토의 조언'
                }
                triggerDisabled={!isInteractive || adviceStatus !== 'success'}
                highlightTrigger={adviceStatus === 'success'}
                triggerLoading={adviceStatus === 'loading'}
                triggerClassName="shrink-0 self-end sm:self-auto"
              >
                <div className="space-y-3">
                  {questionAdvice.map((mentorAdvice) => {
                    const isSelected = selectedAdviceId === mentorAdvice.id;

                    return (
                      <button
                        key={mentorAdvice.id}
                        type="button"
                        onClick={() => selectAdvice(mentorAdvice)}
                        className={cn(
                          'w-full rounded-2xl border bg-background p-4 text-left shadow-sm transition-[border-color,background-color,box-shadow] outline-none hover:border-blue-500/40 hover:shadow-md focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30',
                          isSelected && 'border-blue-500/60 bg-blue-500/10',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {mentorAdvice.mentorName}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {mentorAdvice.mentorMajor}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-white">
                              <Check className="size-3.5" aria-hidden="true" />
                            </span>
                          )}
                        </div>
                        <p className="mt-4 text-sm leading-6 text-foreground/85">
                          {mentorAdvice.message}
                        </p>
                        <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                            <Sparkles className="size-3" aria-hidden="true" />
                            {mentorAdvice.keyword}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">
                            이 조언 선택하기
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ConsultingAdvice>
            </motion.section>
          );
        })}
      </div>

      {isInteractive && (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.3,
            delay: shouldReduceMotion ? 0 : 0.92,
          }}
          className="mt-5 flex justify-end"
        >
          <ConsultingProgressButton type="submit" />
        </motion.div>
      )}
    </motion.form>
  );
}
