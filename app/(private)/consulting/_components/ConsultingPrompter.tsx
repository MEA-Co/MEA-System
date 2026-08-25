'use client';

import { SkipForward } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type ConsultingPrompterMessageEmphasis = 'strong' | 'accent' | 'muted';

export type ConsultingPrompterMessageSegment = {
  text: string;
  emphasis?: ConsultingPrompterMessageEmphasis;
};

export type ConsultingPrompterMessage = {
  label?: string;
  title?: string;
  segments: ReadonlyArray<ConsultingPrompterMessageSegment>;
};

type ConsultingPrompterProps = {
  message: ConsultingPrompterMessage;
  animateTyping?: boolean;
  children?: ReactNode;
  onTypingComplete?: () => void;
};

const emphasisClassNames: Record<ConsultingPrompterMessageEmphasis, string> = {
  strong: 'font-bold',
  accent: 'font-bold text-blue-600 dark:text-blue-400',
  muted: 'text-muted-foreground',
};

function getTypingDelay(character: string) {
  if (/[.!?。！？]/.test(character)) return 180;
  if (/[,，]/.test(character)) return 90;
  if (character === ' ') return 30;
  return 24;
}

function FormattedMessage({
  segments,
  visibleCount,
}: {
  segments: ReadonlyArray<ConsultingPrompterMessageSegment>;
  visibleCount: number;
}) {
  let remainingCharacters = visibleCount;

  return segments.map((segment, index) => {
    const characters = Array.from(segment.text);
    const visibleText = characters
      .slice(0, Math.max(remainingCharacters, 0))
      .join('');
    remainingCharacters -= characters.length;

    if (!visibleText) return null;

    return (
      <span
        key={`${index}-${segment.text}`}
        className={cn(segment.emphasis && emphasisClassNames[segment.emphasis])}
      >
        {visibleText}
      </span>
    );
  });
}

function ConsultingPrompterContent({
  message,
  typeImmediately,
  reduceMotion,
  children,
  onTypingComplete,
}: Omit<ConsultingPrompterProps, 'animateTyping'> & {
  typeImmediately: boolean;
  reduceMotion: boolean;
}) {
  const plainMessage = message.segments.map((segment) => segment.text).join('');
  const characters = useMemo(() => Array.from(plainMessage), [plainMessage]);
  const [visibleCount, setVisibleCount] = useState(
    typeImmediately ? characters.length : 0,
  );
  const timeoutIdRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);
  const onTypingCompleteRef = useRef(onTypingComplete);
  const isTyping = visibleCount < characters.length;

  useEffect(() => {
    onTypingCompleteRef.current = onTypingComplete;
  }, [onTypingComplete]);

  const finishTyping = useCallback(() => {
    if (hasCompletedRef.current) return;

    hasCompletedRef.current = true;
    onTypingCompleteRef.current?.();
  }, []);

  useEffect(() => {
    hasCompletedRef.current = false;

    if (typeImmediately || characters.length === 0) {
      timeoutIdRef.current = window.setTimeout(finishTyping, 0);

      return () => {
        if (timeoutIdRef.current !== null) {
          window.clearTimeout(timeoutIdRef.current);
        }
      };
    }

    let nextIndex = 0;

    const typeNextCharacter = () => {
      nextIndex += 1;
      setVisibleCount(nextIndex);

      if (nextIndex < characters.length) {
        timeoutIdRef.current = window.setTimeout(
          typeNextCharacter,
          getTypingDelay(characters[nextIndex - 1]),
        );
      } else {
        timeoutIdRef.current = null;
        finishTyping();
      }
    };

    timeoutIdRef.current = window.setTimeout(typeNextCharacter, 350);

    return () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
      }
    };
  }, [characters, finishTyping, typeImmediately]);

  const skipTyping = useCallback(() => {
    if (timeoutIdRef.current !== null) {
      window.clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    setVisibleCount(characters.length);
    finishTyping();
  }, [characters.length, finishTyping]);

  useEffect(() => {
    if (!isTyping) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== 'Space' ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)
      ) {
        return;
      }

      event.preventDefault();
      skipTyping();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTyping, skipTyping]);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Card className="gap-0 overflow-hidden rounded-xl border bg-card/95 py-0 shadow-xl ring-0 backdrop-blur-md supports-backdrop-filter:bg-card/90">
        <CardContent className="p-5 md:p-6">
          <div className="flex min-h-5 items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="h-px w-6 bg-primary/70" aria-hidden="true" />
              <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground">
                메아 (MEA)
              </p>
            </div>

            <div className="flex items-center gap-3">
              {message.label && (
                <p className="text-xs font-bold tracking-[0.12em] text-primary">
                  {message.label}
                </p>
              )}
              <AnimatePresence>
                {isTyping && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={skipTyping}
                    className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[0.7rem] font-medium tracking-wide text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="타이핑 애니메이션 건너뛰기"
                    aria-keyshortcuts="Space"
                  >
                    <SkipForward className="size-3" aria-hidden="true" />
                    skip
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-4">
            {message.title && (
              <h2 className="text-lg font-bold tracking-[-0.02em] md:text-xl">
                {message.title}
              </h2>
            )}
            <p
              aria-live={isTyping ? 'off' : 'polite'}
              aria-atomic="true"
              className={cn(
                'leading-7 tracking-[-0.01em]',
                message.title
                  ? 'mt-2 text-sm text-muted-foreground md:text-[0.95rem]'
                  : 'text-[1.05rem] font-medium text-foreground md:text-lg md:leading-8',
              )}
            >
              <FormattedMessage
                segments={message.segments}
                visibleCount={visibleCount}
              />
              {isTyping && (
                <motion.span
                  className="ml-0.5 inline-block h-[1.05em] w-0.5 translate-y-0.5 rounded-full bg-primary"
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </p>
          </div>

          {children && (
            <div className="mt-4 flex items-center justify-end gap-2 border-t pt-4">
              {children}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ConsultingPrompter({
  message,
  animateTyping = false,
  children,
  onTypingComplete,
}: ConsultingPrompterProps) {
  const shouldReduceMotion = useReducedMotion();
  const reduceMotion = Boolean(shouldReduceMotion);
  const typeImmediately = reduceMotion || !animateTyping;
  const messageKey = JSON.stringify(message.segments);

  return (
    <ConsultingPrompterContent
      key={`${messageKey}-${typeImmediately}`}
      message={message}
      typeImmediately={typeImmediately}
      reduceMotion={reduceMotion}
      onTypingComplete={onTypingComplete}
    >
      {children}
    </ConsultingPrompterContent>
  );
}
