'use client';

import { motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import { useState } from 'react';

export function ResearchIllustration({ era }: { era: 'past' | 'ai' }) {
  const ai = era === 'ai';
  const reduceMotion = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  return (
    <motion.figure
      initial={{ opacity: 0 }}
      animate={{ opacity: loaded ? 1 : 0 }}
      transition={{ duration: reduceMotion ? 0 : 1.4, ease: 'easeOut' }}
      className="overflow-hidden rounded-2xl border border-violet-100 bg-white"
    >
      <Image
        src={
          ai
            ? '/images/branding/research-ai.png'
            : '/images/branding/research-past.png'
        }
        alt={
          ai
            ? 'AI의 시각적인 설명을 보며 탐구를 구상하는 학생'
            : '여러 책과 자료를 살펴보며 탐구 주제를 고민하는 학생'
        }
        width={1536}
        height={1024}
        sizes="(max-width: 768px) 100vw, 768px"
        className="mx-auto max-h-96 w-full object-contain"
        onLoad={() => setLoaded(true)}
      />
    </motion.figure>
  );
}
