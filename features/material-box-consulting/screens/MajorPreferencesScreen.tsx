'use client';

import { CircleAlert } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type FormEvent, useEffect, useState } from 'react';

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
  submittedPreferences: Array<MajorPreference>;
  onAnimationComplete: () => void;
  onSubmit: (preferences: Array<MajorPreference>) => void;
};

type PreferenceValidationResult =
  | { success: true; preferences: Array<MajorPreference> }
  | { success: false; message: string };

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

export function MajorPreferencesScreen({
  screen,
  isInteractive,
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
  const isReviewing =
    screen === 'major-input' &&
    !isInteractive &&
    submittedPreferences.length > 0;
  const visibleCount =
    screen === 'major-one' ? 1 : isReviewing ? submittedPreferences.length : 3;
  const visiblePreferences = isReviewing
    ? submittedPreferences
    : preferences.slice(0, visibleCount);
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
                      updatePreference(index, event.target.value)
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
