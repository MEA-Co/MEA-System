'use client';

import { Quote } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';

const examples = [
  [
    { text: '나는 F1 엔지니어들처럼 ' },
    { text: '모터 스포츠용 엔진', emphasis: true },
    { text: '을 만들어보고 싶어.' },
  ],
  [
    {
      text: '나는 새로운 제품의 광고를 볼 때 사람들이 왜 마음을 빼앗기는지 궁금해서, ',
    },
    { text: '소비자 심리를 활용한 마케팅', emphasis: true },
    { text: '을 공부해보고 싶어.' },
  ],
  [
    {
      text: '나는 검색할 때 원하는 답이 바로 나오지 않는 게 불편해서, 질문의 의도를 이해하는 ',
    },
    { text: '인공지능 검색 모델', emphasis: true },
    { text: '을 만들어보고 싶어.' },
  ],
  [
    {
      text: '나는 친구들이 같은 말을 상황마다 다르게 쓰는 게 신기해서, 온라인에서 변하는 ',
    },
    { text: '청소년 언어', emphasis: true },
    { text: '를 연구해보고 싶어.' },
  ],
] as const;

type KeywordExamplesScreenProps = {
  onAnimationComplete: () => void;
};

export function KeywordExamplesScreen({
  onAnimationComplete,
}: KeywordExamplesScreenProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const completionTimer = window.setTimeout(
      onAnimationComplete,
      shouldReduceMotion ? 0 : 1_050,
    );
    return () => window.clearTimeout(completionTimer);
  }, [onAnimationComplete, shouldReduceMotion]);

  return (
    <div className="mx-auto min-h-112 w-full max-w-4xl pt-8 pb-56 md:pt-10 md:pb-48">
      <div className="grid gap-4 md:grid-cols-2">
        {examples.map((example, index) => {
          return (
            <motion.section
              key={index}
              initial={
                shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.4,
                delay: shouldReduceMotion ? 0 : index * 0.16,
                ease: 'easeOut',
              }}
              className="relative flex min-h-36 flex-col rounded-2xl border bg-background/90 p-5 shadow-sm md:p-6"
            >
              <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span className="flex size-7 items-center justify-center rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300">
                  <Quote className="size-3.5" aria-hidden="true" />
                </span>
                예시 {index + 1}
              </div>
              <p className="text-[0.98rem] leading-7 text-foreground/90">
                {example.map((segment, segmentIndex) =>
                  'emphasis' in segment && segment.emphasis ? (
                    <strong
                      key={segmentIndex}
                      className="font-bold text-blue-700 dark:text-blue-300"
                    >
                      {segment.text}
                    </strong>
                  ) : (
                    <span key={segmentIndex}>{segment.text}</span>
                  ),
                )}
              </p>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}
