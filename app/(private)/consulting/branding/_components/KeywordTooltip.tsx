'use client';

import { type RefObject, useLayoutEffect, useState } from 'react';

import type { MajorKeyword } from '@/features/keywords/major-overview/types';

import styles from './MajorKeywordCloud.module.css';

export function KeywordTooltip({
  ref,
  id,
  x,
  y,
  keyword,
  onPointerEnter,
  onPointerLeave,
}: {
  ref: RefObject<HTMLDivElement | null>;
  id: string;
  x: number;
  y: number;
  keyword: MajorKeyword;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    arrow: number;
    below: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      const left = Math.max(
        12,
        Math.min(x - width / 2, window.innerWidth - width - 12),
      );
      const below = y - height - 16 < 12;
      const top = Math.max(
        12,
        Math.min(
          below ? y + 20 : y - height - 16,
          window.innerHeight - height - 12,
        ),
      );
      setPosition({
        left,
        top,
        arrow: Math.max(16, Math.min(x - left, width - 16)),
        below,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, x, y, keyword]);
  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className={styles.tooltip}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <span
        aria-hidden="true"
        className={styles.tooltipArrow}
        style={{
          left: position?.arrow,
          top: position?.below ? -5 : undefined,
          bottom: position?.below ? undefined : -5,
        }}
      />
      <div className={styles.tooltipContent}>
        <p className="font-semibold text-violet-900">{keyword.name}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {keyword.description || '이 키워드의 설명은 아직 준비 중이에요.'}
        </p>
      </div>
    </div>
  );
}
