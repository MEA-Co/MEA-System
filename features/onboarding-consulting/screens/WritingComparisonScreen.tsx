'use client';

import { CheckCircle2, FileText, XCircle } from 'lucide-react';
import { motion } from 'motion/react';

import type { OnboardingAnswer } from '@/features/onboarding-consulting/model/types';
import { cn } from '@/lib/utils';

const choices: Array<{ answer: OnboardingAnswer; label: string }> = [
  { answer: 'well-written', label: '잘쓴 글' },
  { answer: 'poorly-written', label: '못쓴 글' },
];

type WritingComparisonScreenProps = {
  selectedAnswer: OnboardingAnswer | null;
  isInteractive: boolean;
  onAnimationComplete: () => void;
  onSelect: (answer: OnboardingAnswer) => void;
};

export function WritingComparisonScreen({
  selectedAnswer,
  isInteractive,
  onAnimationComplete,
  onSelect,
}: WritingComparisonScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      onAnimationComplete={onAnimationComplete}
      className="mx-auto grid min-h-96 w-full max-w-3xl grid-cols-1 content-start gap-4 pt-10 pb-52 md:grid-cols-2 md:gap-5 md:pt-14 md:pb-44"
    >
      {choices.map((choice, index) => {
        const isSelected = selectedAnswer === choice.answer;
        const isCorrect = choice.answer === 'well-written';

        return (
          <motion.button
            key={choice.answer}
            type="button"
            disabled={!isInteractive}
            aria-pressed={isSelected}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
            whileHover={isInteractive ? { y: -4 } : undefined}
            whileTap={isInteractive ? { scale: 0.985 } : undefined}
            onClick={() => onSelect(choice.answer)}
            className={cn(
              'group relative flex min-h-40 cursor-pointer flex-col items-start justify-between overflow-hidden rounded-2xl border bg-background/85 p-5 text-left shadow-sm transition-[border-color,background-color,box-shadow,opacity] outline-none hover:border-foreground/25 hover:shadow-md focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-default md:min-h-48 md:p-6',
              !isInteractive && !isSelected && 'opacity-50',
              isSelected &&
                isCorrect &&
                'border-emerald-500/60 bg-emerald-500/10 shadow-md',
              isSelected &&
                !isCorrect &&
                'border-destructive/60 bg-destructive/10 shadow-md',
            )}
          >
            <div className="flex w-full items-start justify-between gap-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <FileText className="size-5" />
              </div>

              {isSelected &&
                (isCorrect ? (
                  <CheckCircle2 className="size-6 text-emerald-600" />
                ) : (
                  <XCircle className="size-6 text-destructive" />
                ))}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                선택지 {index + 1}
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">
                {choice.label}
              </p>
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
