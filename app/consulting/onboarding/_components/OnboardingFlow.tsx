'use client';

import { ArrowRight, CheckCircle2, FileText, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import {
  type OnboardingAnswer,
  onboardingConsulting,
} from '@/app/consulting/onboarding/_lib/onboardingConsulting';
import { Button } from '@/components/ui/button';
import { ConsultingMain } from '@/features/consulting/components/ConsultingMain';
import { ConsultingPrompter } from '@/features/consulting/components/ConsultingPrompter';
import { useConsultingSequence } from '@/features/consulting/hooks/useConsultingSequence';
import { cn } from '@/lib/utils';

const choices: Array<{ answer: OnboardingAnswer; label: string }> = [
  { answer: 'well-written', label: '잘쓴 글' },
  { answer: 'poorly-written', label: '못쓴 글' },
];

export function OnboardingFlow() {
  const consulting = useConsultingSequence(onboardingConsulting);
  const showChoices = consulting.view.screen === 'writing-comparison';
  const selectedAnswer = consulting.context.answer;
  const canContinue =
    consulting.currentAction?.type === 'prompter' &&
    consulting.currentAction.waitFor === 'continue';

  return (
    <ConsultingMain
      prompterPlacement={consulting.view.prompterPlacement}
      prompterSize={consulting.view.prompterSize}
      onPrompterTransitionComplete={consulting.completePrompterLayout}
      prompter={
        <ConsultingPrompter
          message={consulting.view.message}
          onTypingComplete={consulting.completePrompterTyping}
        >
          {canContinue && (
            <Button
              variant="outline"
              size="lg"
              onClick={consulting.continueSequence}
              className="group/progress h-11 border-border/80 bg-background/90 pr-2 pl-5 text-foreground shadow-sm hover:border-foreground/20 hover:bg-muted"
            >
              진행하기
              <span className="ml-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover/progress:translate-x-0.5">
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </Button>
          )}
        </ConsultingPrompter>
      }
    >
      <AnimatePresence initial={false}>
        {showChoices && (
          <motion.div
            key="writing-comparison"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mx-auto grid min-h-96 w-full max-w-3xl grid-cols-1 content-start gap-4 pt-10 pb-52 md:grid-cols-2 md:gap-5 md:pt-14 md:pb-44"
          >
            {choices.map((choice, index) => {
              const isSelected = selectedAnswer === choice.answer;
              const isCorrect = choice.answer === 'well-written';

              return (
                <motion.button
                  key={choice.answer}
                  type="button"
                  disabled={consulting.turn !== 'user'}
                  aria-pressed={isSelected}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.08 }}
                  whileHover={
                    consulting.turn === 'user' ? { y: -4 } : undefined
                  }
                  whileTap={
                    consulting.turn === 'user' ? { scale: 0.985 } : undefined
                  }
                  onClick={() =>
                    consulting.completeScreen({ answer: choice.answer })
                  }
                  className={cn(
                    'group relative flex min-h-40 cursor-pointer flex-col items-start justify-between overflow-hidden rounded-2xl border bg-background/85 p-5 text-left shadow-sm transition-[border-color,background-color,box-shadow,opacity] outline-none hover:border-foreground/25 hover:shadow-md focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-default md:min-h-48 md:p-6',
                    consulting.turn !== 'user' && !isSelected && 'opacity-50',
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
        )}
      </AnimatePresence>
    </ConsultingMain>
  );
}
