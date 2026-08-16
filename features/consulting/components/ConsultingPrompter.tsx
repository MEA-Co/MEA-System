'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';

type ConsultingPrompterProps = {
  message: string;
  children?: ReactNode;
  onTypingComplete?: () => void;
};

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
  const characters = useMemo(() => Array.from(message), [message]);
  const [visibleCount, setVisibleCount] = useState(
    reduceMotion ? characters.length : 0,
  );
  const isTyping = visibleCount < characters.length;

  useEffect(() => {
    if (reduceMotion || characters.length === 0) {
      const completionTimer = window.setTimeout(() => onTypingComplete?.(), 0);

      return () => window.clearTimeout(completionTimer);
    }

    let nextIndex = 0;
    let timeoutId: number;

    const typeNextCharacter = () => {
      nextIndex += 1;
      setVisibleCount(nextIndex);

      if (nextIndex < characters.length) {
        timeoutId = window.setTimeout(
          typeNextCharacter,
          getTypingDelay(characters[nextIndex - 1]),
        );
      } else {
        onTypingComplete?.();
      }
    };

    timeoutId = window.setTimeout(typeNextCharacter, 350);

    return () => window.clearTimeout(timeoutId);
  }, [characters, onTypingComplete, reduceMotion]);

  return (
    <>
      <div className="min-h-14 max-w-4xl">
        <p className="sr-only" aria-live="polite">
          {message}
        </p>
        <p
          aria-hidden="true"
          className="text-[1.05rem] font-medium leading-8 tracking-[-0.01em] text-foreground md:text-lg md:leading-8"
        >
          {characters.slice(0, visibleCount).join('')}
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
            className="pt-5"
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

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Card className="relative gap-0 overflow-hidden rounded-xl border bg-card/95 py-0 shadow-xl ring-0 backdrop-blur-md supports-backdrop-filter:bg-card/90">
        <div
          className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-primary via-primary/60 to-transparent"
          aria-hidden="true"
        />
        <CardContent className="p-5 md:p-7">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="h-px w-6 bg-primary/70" aria-hidden="true" />
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground">
              메아 (MEA)
            </p>
          </div>

          <TypewriterMessage
            key={`${message}-${reduceMotion}`}
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
