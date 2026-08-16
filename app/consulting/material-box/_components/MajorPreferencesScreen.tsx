'use client';

import { CircleAlert } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type FormEvent, useEffect, useState } from 'react';

import type {
  MajorPreference,
  MaterialBoxScreen,
} from '@/app/consulting/material-box/_lib/materialBoxConsulting';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConsultingProgressButton } from '@/features/consulting/components/ConsultingProgressButton';
import { cn } from '@/lib/utils';

type MajorPreferencesScreenProps = {
  screen: MaterialBoxScreen;
  isInteractive: boolean;
  submittedPreferences: Array<MajorPreference>;
  onAnimationComplete: () => void;
  onSubmit: (preferences: Array<MajorPreference>) => void;
};

type PreferenceValidationResult =
  | { success: true; preferences: Array<MajorPreference> }
  | { success: false; message: string };

const emptyPreferences: Array<MajorPreference> = Array.from(
  { length: 3 },
  () => ({ major: '', reason: '' }),
);

const animationDurations: Record<
  Exclude<MaterialBoxScreen, 'major-input'>,
  number
> = {
  'major-one': 450,
  'major-one-with-reason': 500,
  'three-majors': 1_250,
};

function validatePreferences(
  preferences: Array<MajorPreference>,
): PreferenceValidationResult {
  const startedPreferences = preferences
    .map((preference) => ({
      major: preference.major.trim(),
      reason: preference.reason.trim(),
    }))
    .filter((preference) => preference.major || preference.reason);

  if (startedPreferences.length === 0) {
    return {
      success: false,
      message: '희망 전공과 희망 이유를 한 세트 이상 작성해 주세요.',
    };
  }

  if (
    startedPreferences.some(
      (preference) => !preference.major || !preference.reason,
    )
  ) {
    return {
      success: false,
      message: '작성 중인 항목에는 희망 전공과 희망 이유를 모두 입력해 주세요.',
    };
  }

  return { success: true, preferences: startedPreferences };
}

export function MajorPreferencesScreen({
  screen,
  isInteractive,
  submittedPreferences,
  onAnimationComplete,
  onSubmit,
}: MajorPreferencesScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const [preferences, setPreferences] = useState(emptyPreferences);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const isReviewing =
    screen === 'major-input' &&
    !isInteractive &&
    submittedPreferences.length > 0;
  const visibleCount =
    screen === 'major-one' || screen === 'major-one-with-reason'
      ? 1
      : isReviewing
        ? submittedPreferences.length
        : 3;
  const visiblePreferences = isReviewing
    ? submittedPreferences
    : preferences.slice(0, visibleCount);
  const showReasons = screen !== 'major-one';
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

  const updatePreference = (
    index: number,
    field: keyof MajorPreference,
    value: string,
  ) => {
    setValidationMessage(null);
    setPreferences((current) =>
      current.map((preference, preferenceIndex) =>
        preferenceIndex === index
          ? { ...preference, [field]: value }
          : preference,
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
      layout
      onSubmit={submitPreferences}
      className="mx-auto min-h-112 w-full max-w-5xl pt-8 pb-56 md:pt-10 md:pb-48"
    >
      <motion.div
        layout
        className={cn(
          'grid grid-cols-1 gap-4',
          visibleCount === 1
            ? 'mx-auto max-w-xl'
            : 'md:grid-cols-2 lg:grid-cols-3',
        )}
      >
        <AnimatePresence mode="popLayout">
          {visiblePreferences.map((preference, index) => (
            <motion.section
              layout
              key={index}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: {
                  duration: shouldReduceMotion ? 0 : 0.35,
                  delay: shouldReduceMotion ? 0 : index * 0.22,
                  ease: 'easeOut',
                },
              }}
              exit={{
                opacity: 0,
                y: -6,
                scale: 0.985,
                transition: {
                  duration: shouldReduceMotion ? 0 : 0.16,
                  delay: 0,
                  ease: 'easeOut',
                },
              }}
              transition={{
                layout: {
                  type: 'spring',
                  stiffness: 380,
                  damping: 34,
                },
              }}
              className="relative rounded-2xl border bg-background/90 p-5 shadow-sm"
            >
              <AnimatePresence initial={false}>
                {showPriorities && (
                  <motion.p
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.25,
                      delay: shouldReduceMotion ? 0 : 0.72 + index * 0.08,
                    }}
                    className="mb-4 text-sm font-semibold text-blue-600 dark:text-blue-400"
                  >
                    {index + 1}순위
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <label
                  htmlFor={`major-${index}`}
                  className="text-sm font-semibold"
                >
                  희망 전공
                </label>
                {showInputs ? (
                  <Input
                    id={`major-${index}`}
                    value={preference.major}
                    readOnly={!isInteractive}
                    onChange={(event) =>
                      updatePreference(index, 'major', event.target.value)
                    }
                    placeholder="예: 심리학과"
                  />
                ) : (
                  <div
                    className="h-10 rounded-xl border border-dashed bg-muted/30"
                    aria-hidden="true"
                  />
                )}
              </div>

              <AnimatePresence initial={false}>
                {showReasons && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: 8 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.35 }}
                    className="mt-5 space-y-2 overflow-hidden"
                  >
                    <label
                      htmlFor={`reason-${index}`}
                      className="text-sm font-semibold"
                    >
                      희망 이유
                    </label>
                    {showInputs ? (
                      <Textarea
                        id={`reason-${index}`}
                        value={preference.reason}
                        readOnly={!isInteractive}
                        onChange={(event) =>
                          updatePreference(index, 'reason', event.target.value)
                        }
                        className="min-h-24 resize-y"
                        placeholder="이 전공을 희망하는 이유를 적어 주세요."
                      />
                    ) : (
                      <div
                        className="h-24 rounded-xl border border-dashed bg-muted/30"
                        aria-hidden="true"
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          ))}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showInputs && isInteractive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
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
            <ConsultingProgressButton type="submit" className="self-end" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  );
}
