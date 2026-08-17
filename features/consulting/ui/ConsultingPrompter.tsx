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
import type {
  ConsultingMessage,
  ConsultingMessageEmphasis,
  ConsultingMessageSegment,
} from '@/features/consulting/ui/message';
import { cn } from '@/lib/utils';

type ConsultingPrompterProps = {
  message: ConsultingMessage;
  children?: ReactNode;
  onTypingComplete?: () => void;
};

const emphasisClassNames: Record<ConsultingMessageEmphasis, string> = {
  strong: 'font-bold',
  accent: 'font-bold text-blue-600 dark:text-blue-400',
  muted: 'text-muted-foreground',
};

function FormattedMessage({
  segments,
  visibleCount,
}: {
  segments: ReadonlyArray<ConsultingMessageSegment>;
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

type TypewriterMessageProps = ConsultingPrompterProps & {
  reduceMotion: boolean;
};

function getTypingDelay(character: string) {
  if (/[.!?。！？]/.test(character)) return 180;
  if (/[,，]/.test(character)) return 90;
  if (character === ' ') return 30;
  return 24;
}

function TypewriterMessage({
  message,
  children,
  reduceMotion,
  onTypingComplete,
}: TypewriterMessageProps) {
  const segments = useMemo<ReadonlyArray<ConsultingMessageSegment>>(
    () => (typeof message === 'string' ? [{ text: message }] : message),
    [message],
  );
  const plainMessage = useMemo(
    () => segments.map((segment) => segment.text).join(''),
    [segments],
  );
  const characters = useMemo(() => Array.from(plainMessage), [plainMessage]);
  const [visibleCount, setVisibleCount] = useState(
    reduceMotion ? characters.length : 0,
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
    if (reduceMotion || characters.length === 0) {
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
  }, [characters, finishTyping, reduceMotion]);

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
    <>
      <AnimatePresence>
        {isTyping && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={skipTyping}
            className="absolute top-5 right-5 z-10 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[0.7rem] font-medium tracking-wide text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:top-7 md:right-7"
            aria-label="타이핑 애니메이션 건너뛰기"
            aria-keyshortcuts="Space"
          >
            <SkipForward className="size-3" aria-hidden="true" />
            skip
          </motion.button>
        )}
      </AnimatePresence>

      <div className="min-h-14 w-full">
        <p
          aria-live={isTyping ? 'off' : 'polite'}
          aria-atomic="true"
          className="text-[1.05rem] font-medium leading-8 tracking-[-0.01em] text-foreground md:text-lg md:leading-8"
        >
          <FormattedMessage segments={segments} visibleCount={visibleCount} />
          {isTyping && (
            <motion.span
              className="ml-0.5 inline-block h-[1.05em] w-0.5 translate-y-0.5 rounded-full bg-primary"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
        </p>
      </div>

      <AnimatePresence initial={false}>
        {!isTyping && children && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.25 }}
            className="flex justify-end pt-5"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function ConsultingPrompter({
  message,
  children,
  onTypingComplete,
}: ConsultingPrompterProps) {
  const shouldReduceMotion = useReducedMotion();
  const reduceMotion = Boolean(shouldReduceMotion);
  const messageKey = JSON.stringify(message);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Card className="relative gap-0 overflow-hidden rounded-xl border bg-card/95 py-0 shadow-xl ring-0 backdrop-blur-md supports-backdrop-filter:bg-card/90">
        <CardContent className="p-5 md:p-7">
          <div className="mb-4 flex items-center gap-2.5 pr-16">
            <span className="h-px w-6 bg-primary/70" aria-hidden="true" />
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground">
              메아 (MEA)
            </p>
          </div>

          <TypewriterMessage
            key={`${messageKey}-${reduceMotion}`}
            message={message}
            reduceMotion={reduceMotion}
            onTypingComplete={onTypingComplete}
          >
            {children}
          </TypewriterMessage>
        </CardContent>
      </Card>
    </motion.div>
  );
}
