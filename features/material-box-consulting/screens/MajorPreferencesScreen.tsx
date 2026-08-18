'use client';

import { ArrowRight, CircleAlert, CircleHelp } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type FormEvent, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ConsultingProgressButton } from '@/features/consulting/ui/ConsultingProgressButton';
import type {
  MajorPreference,
  MajorPreferenceScreen,
} from '@/features/material-box-consulting/model/types';
import { cn } from '@/lib/utils';

type MajorPreferencesScreenProps = {
  screen: MajorPreferenceScreen;
  isInteractive: boolean;
  materialBoxHighlight: 'major' | 'keyword';
  materialBoxKeyword: string;
  showMajorHelpButton: boolean;
  showSavedPreferences: boolean;
  submittedPreferences: Array<MajorPreference>;
  onAnimationComplete: () => void;
  onSubmit: (preferences: Array<MajorPreference>) => void;
};

type PreferenceValidationResult =
  | { success: true; preferences: Array<MajorPreference> }
  | { success: false; message: string };

type MajorHelpPath = 'field' | 'keyword';

const majorHelpPathGuidance: Record<MajorHelpPath, string> = {
  field:
    '좋아하거나 자신 있는 과목이 어느 계열에 가까운지 살펴보고, 그 계열 안의 전공부터 찾아보세요.',
  keyword:
    '최근 가장 궁금했던 주제나 해결하고 싶은 문제를 한 단어로 적고, 그 키워드를 다루는 전공부터 찾아보세요.',
};

function createPreferences(submittedPreferences: Array<MajorPreference>) {
  return Array.from(
    { length: 3 },
    (_, index) => submittedPreferences[index] ?? { major: '' },
  );
}

const animationDurations: Record<
  Exclude<MajorPreferenceScreen, 'major-input'>,
  number
> = {
  'major-one': 450,
  'three-majors': 1_250,
};

function validatePreferences(
  preferences: Array<MajorPreference>,
): PreferenceValidationResult {
  const startedPreferences = preferences
    .map((preference) => ({ major: preference.major.trim() }))
    .filter((preference) => preference.major);

  if (startedPreferences.length === 0) {
    return {
      success: false,
      message: '희망 전공을 한 개 이상 작성해 주세요.',
    };
  }

  return { success: true, preferences: startedPreferences };
}

type MajorMaterialBoxTableProps = {
  compact: boolean;
  expanded: boolean;
  highlight: 'major' | 'keyword' | null;
  keyword: string;
  preferences: Array<MajorPreference>;
  showSavedPreferences: boolean;
  shouldReduceMotion: boolean;
};

export function MaterialBoxProgressTable({
  compact,
  expanded,
  highlight,
  keyword,
  preferences,
  showSavedPreferences,
  shouldReduceMotion,
}: MajorMaterialBoxTableProps) {
  const majorRowCount = expanded ? 3 : 1;
  const highlightAnimation = (active: boolean, index: number) => ({
    initial:
      active && !shouldReduceMotion
        ? { backgroundColor: 'rgba(59, 130, 246, 0)' }
        : false,
    animate: {
      backgroundColor: active
        ? 'rgba(59, 130, 246, 0.1)'
        : 'rgba(59, 130, 246, 0)',
    },
    transition: {
      duration: shouldReduceMotion ? 0 : 0.9,
      delay: shouldReduceMotion ? 0 : 0.08 + index * 0.18,
      ease: 'easeOut' as const,
    },
  });

  return (
    <motion.div
      layout={!shouldReduceMotion}
      transition={{
        layout: { type: 'spring', stiffness: 320, damping: 32 },
      }}
      className="overflow-hidden"
    >
      <table
        className={cn(
          'w-full table-fixed border-separate border-spacing-0 overflow-hidden border text-left text-xs',
          compact
            ? 'rounded-lg'
            : 'rounded-lg sm:min-w-160 sm:table-auto sm:rounded-xl sm:text-sm',
        )}
        aria-label={`${highlight === 'keyword' ? '키워드' : '전공'} 칸이 강조된 재료함`}
      >
        <tbody>
          {Array.from({ length: majorRowCount }, (_, index) => (
            <motion.tr
              layout={!shouldReduceMotion}
              key={`major-row-${index}`}
              initial={
                index === 0 || shouldReduceMotion
                  ? false
                  : { opacity: 0, y: -10 }
              }
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.32,
                delay: shouldReduceMotion ? 0 : index * 0.18,
              }}
            >
              {index === 0 && (
                <th
                  scope="rowgroup"
                  rowSpan={majorRowCount + 1}
                  className={cn(
                    'border-r border-b bg-muted/35 font-bold',
                    compact
                      ? 'w-[42%] px-2 py-3 text-[11px] leading-5 whitespace-nowrap sm:w-[40%] sm:text-xs'
                      : 'w-[38%] px-2.5 py-3 leading-5 sm:w-56 sm:px-5 sm:py-5 sm:text-sm',
                  )}
                >
                  전공 세부 분야 키워드
                </th>
              )}
              <motion.th
                {...highlightAnimation(highlight === 'major', index)}
                scope="row"
                className={cn(
                  'border-r border-b font-semibold',
                  compact
                    ? 'w-[35%] px-2 py-3 sm:w-[36%]'
                    : 'w-[29%] px-2.5 py-3 sm:w-44 sm:px-5 sm:py-5 sm:text-sm',
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {showSavedPreferences && preferences[index]?.major ? (
                    <motion.span
                      key={preferences[index].major}
                      initial={
                        shouldReduceMotion ? false : { opacity: 0, y: 4 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.25,
                      }}
                      className="block"
                    >
                      <span className="block text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                        {index + 1}순위
                      </span>
                      <span
                        className="mt-0.5 block truncate"
                        title={preferences[index].major}
                      >
                        {preferences[index].major}
                      </span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="placeholder"
                      initial={
                        shouldReduceMotion ? false : { opacity: 0, y: 3 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      className="block"
                    >
                      {expanded ? `${index + 1}순위 전공` : '전공'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.th>
              <motion.td
                {...highlightAnimation(highlight === 'keyword', index)}
                className={cn(
                  'border-b text-muted-foreground',
                  compact
                    ? 'px-2.5 py-3'
                    : 'px-2.5 py-3 sm:px-5 sm:py-5 sm:text-sm',
                )}
              >
                <span
                  className="block truncate"
                  title={keyword && index === 0 ? keyword : undefined}
                >
                  {keyword && index === 0 ? keyword : '키워드'}
                </span>
              </motion.td>
            </motion.tr>
          ))}

          <motion.tr layout={!shouldReduceMotion}>
            <th
              scope="row"
              colSpan={2}
              className={cn(
                'border-b font-semibold',
                compact
                  ? 'px-2.5 py-3'
                  : 'px-2.5 py-3 sm:px-5 sm:py-5 sm:text-sm',
              )}
            >
              학생의 스토리
            </th>
          </motion.tr>

          <tr>
            <th
              scope="row"
              className={cn(
                'border-r border-b bg-muted/35 font-bold',
                compact
                  ? 'px-2.5 py-3 leading-5'
                  : 'px-2.5 py-3 leading-5 sm:px-5 sm:py-5 sm:text-sm',
              )}
            >
              전공 가치관
            </th>
            <td colSpan={2} className="border-b" />
          </tr>
          <tr>
            <th
              scope="row"
              className={cn(
                'border-r bg-muted/35 font-bold',
                compact
                  ? 'px-2.5 py-3 leading-5'
                  : 'px-2.5 py-3 leading-5 sm:px-5 sm:py-5 sm:text-sm',
              )}
            >
              계열 적합 역량
            </th>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>
    </motion.div>
  );
}

export function MajorPreferencesScreen({
  screen,
  isInteractive,
  materialBoxHighlight,
  materialBoxKeyword,
  showMajorHelpButton,
  showSavedPreferences,
  submittedPreferences,
  onAnimationComplete,
  onSubmit,
}: MajorPreferencesScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const [preferences, setPreferences] = useState(() =>
    createPreferences(submittedPreferences),
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [showMajorHelp, setShowMajorHelp] = useState(false);
  const [majorHelpPath, setMajorHelpPath] = useState<MajorHelpPath | null>(
    null,
  );
  const visiblePreferences = preferences;
  const showPriorities = screen === 'three-majors' || screen === 'major-input';
  const showInputs = screen === 'major-input';

  useEffect(() => {
    if (screen === 'major-input') return;

    const completionTimer = window.setTimeout(
      onAnimationComplete,
      shouldReduceMotion ? 0 : animationDurations[screen],
    );
    return () => window.clearTimeout(completionTimer);
  }, [onAnimationComplete, screen, shouldReduceMotion]);

  const updatePreference = (index: number, value: string) => {
    setValidationMessage(null);
    setPreferences((current) =>
      current.map((preference, preferenceIndex) =>
        preferenceIndex === index ? { major: value } : preference,
      ),
    );
  };

  const submitPreferences = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isInteractive) return;

    const validation = validatePreferences(preferences);
    if (!validation.success) {
      setValidationMessage(validation.message);
      return;
    }

    setValidationMessage(null);
    onSubmit(validation.preferences);
  };

  return (
    <motion.form
      layout={!shouldReduceMotion && !showInputs}
      onSubmit={submitPreferences}
      className="relative isolate mx-auto min-h-112 w-full pt-6 pb-56 md:pt-8 md:pb-48"
    >
      {showInputs && !shouldReduceMotion && (
        <motion.div
          key="major-input-whiteout"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.34, delay: 0.2, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0 z-20 bg-background"
          aria-hidden="true"
        />
      )}

      <motion.div
        layout={!shouldReduceMotion && !showInputs}
        transition={{
          layout: { type: 'spring', stiffness: 300, damping: 32 },
        }}
        className={cn(
          'mx-auto w-full',
          showInputs
            ? 'grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start'
            : 'max-w-4xl',
        )}
      >
        <motion.div
          key={showInputs ? 'compact-material-box' : 'full-material-box'}
          layout={!shouldReduceMotion && !showInputs}
          initial={showInputs && !shouldReduceMotion ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={
            showInputs
              ? {
                  opacity: {
                    duration: shouldReduceMotion ? 0 : 0.38,
                    delay: shouldReduceMotion ? 0 : 0.32,
                    ease: 'easeOut',
                  },
                }
              : {
                  layout: { type: 'spring', stiffness: 300, damping: 32 },
                }
          }
          className={cn(
            showInputs &&
              'lg:col-start-2 lg:row-start-1 lg:w-96 lg:justify-self-end',
          )}
        >
          <MaterialBoxProgressTable
            compact={showInputs}
            expanded={showPriorities}
            highlight={materialBoxHighlight}
            keyword={materialBoxKeyword}
            preferences={submittedPreferences}
            showSavedPreferences={showSavedPreferences}
            shouldReduceMotion={Boolean(shouldReduceMotion)}
          />
        </motion.div>

        <AnimatePresence>
          {showInputs && (
            <motion.section
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.38,
                delay: shouldReduceMotion ? 0 : 0.32,
                ease: 'easeOut',
              }}
              className="rounded-2xl border bg-background/95 p-5 shadow-sm lg:col-start-1 lg:row-start-1 md:p-6"
            >
              <div className="mb-5">
                <p className="text-xs font-bold tracking-[0.12em] text-blue-600 dark:text-blue-400">
                  MAJOR
                </p>
                <h2 className="mt-1 text-lg font-bold">희망 전공 입력</h2>
              </div>

              <div className="space-y-3">
                {visiblePreferences.map((preference, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3"
                  >
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                      {index + 1}순위
                    </span>
                    <label htmlFor={`major-${index}`} className="sr-only">
                      {index + 1}순위 희망 전공
                    </label>
                    <Input
                      id={`major-${index}`}
                      value={preference.major}
                      readOnly={!isInteractive}
                      onChange={(event) =>
                        updatePreference(index, event.target.value)
                      }
                      placeholder={`${index + 1}순위 희망 전공`}
                    />
                  </div>
                ))}
              </div>

              {isInteractive && (
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <AnimatePresence mode="wait">
                    {validationMessage ? (
                      <motion.p
                        key={validationMessage}
                        role="alert"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-start gap-2 text-sm text-destructive"
                      >
                        <CircleAlert className="mt-0.5 size-4 shrink-0" />
                        {validationMessage}
                      </motion.p>
                    ) : (
                      <span />
                    )}
                  </AnimatePresence>
                  <ConsultingProgressButton
                    type="submit"
                    className="self-end"
                  />
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showInputs && showMajorHelpButton && (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.3,
                delay: shouldReduceMotion ? 0 : 0.46,
              }}
              className="flex flex-col items-center lg:col-span-2"
            >
              <Dialog open={showMajorHelp} onOpenChange={setShowMajorHelp}>
                <DialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 gap-2 bg-background px-4 text-foreground shadow-xs"
                    />
                  }
                >
                  <CircleHelp className="size-4" aria-hidden="true" />
                  희망 전공이 없으면 어떻게 하나요?
                  <ArrowRight className="size-4" aria-hidden="true" />
                </DialogTrigger>
                <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
                  <DialogHeader className="pr-8">
                    <DialogTitle className="text-xl font-bold leading-tight">
                      희망 전공이 아직 없다면
                    </DialogTitle>
                    <DialogDescription>
                      희망 전공을 정하는 두 가지 출발 방법을 안내합니다.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 text-sm leading-7 text-foreground/85">
                    <p>
                      희망 전공은 여러분의 생활기록부를 여러분만의 것으로 만들기
                      위한 가장 기본적인 배경이 됩니다. 탐구활동뿐만 아니라
                      선택과목 역시 희망 전공의 영향을 받게 됩니다.
                    </p>
                    <p>
                      희망 전공은 학교를 다니며 얼마든지 바뀔 수 있고, 바뀌어도
                      괜찮은 경우가 대부분입니다. 지금 여러분이 어디에 관심이 더
                      가는지 생각해보세요!
                    </p>
                    <p className="font-semibold text-foreground">
                      그래도 어렵다면, 아래 두 가지 방법을 참고해보세요.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant={
                        majorHelpPath === 'field' ? 'default' : 'outline'
                      }
                      aria-pressed={majorHelpPath === 'field'}
                      onClick={() => setMajorHelpPath('field')}
                      className="h-11 justify-between px-4"
                    >
                      계열에서 출발하기
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant={
                        majorHelpPath === 'keyword' ? 'default' : 'outline'
                      }
                      aria-pressed={majorHelpPath === 'keyword'}
                      onClick={() => setMajorHelpPath('keyword')}
                      className="h-11 justify-between px-4"
                    >
                      키워드에서 출발하기
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  </div>

                  <AnimatePresence mode="wait">
                    {majorHelpPath && (
                      <motion.p
                        key={majorHelpPath}
                        initial={
                          shouldReduceMotion ? false : { opacity: 0, y: 6 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{
                          duration: shouldReduceMotion ? 0 : 0.2,
                        }}
                        className="rounded-xl bg-muted/60 px-4 py-3 text-sm leading-6 text-muted-foreground"
                      >
                        {majorHelpPathGuidance[majorHelpPath]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </DialogContent>
              </Dialog>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.form>
  );
}
