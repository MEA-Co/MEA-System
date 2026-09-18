'use client';

import {
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type { MajorKeyword } from '@/features/keywords/major-overview/types';

import {
  type CloudWord,
  useMajorCloudLayout,
} from '../_hooks/useMajorCloudLayout';

import { KeywordTooltip } from './KeywordTooltip';

import styles from './MajorKeywordCloud.module.css';

const colors = [
  '#7c3aed',
  '#2563eb',
  '#0f766e',
  '#be185d',
  '#b45309',
  '#4f46e5',
];
export function MajorKeywordCloud({ keywords }: { keywords: MajorKeyword[] }) {
  const descriptionId = useId();
  const { container, layout } = useMajorCloudLayout(keywords);
  const [tip, setTip] = useState<{
    wordId: string;
    groupId: string;
    x: number;
    y: number;
    mode: 'hover' | 'tap' | 'keyboard';
  } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const activeId = tip?.groupId;
  const active = keywords.find((k) => k.id === activeId);
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const closeHover = () => {
    cancelClose();
    closeTimer.current = setTimeout(
      () => setTip((current) => (current?.mode === 'hover' ? null : current)),
      160,
    );
  };
  useEffect(() => {
    const outside = (event: globalThis.PointerEvent) => {
      const target = event.target as Element;
      if (
        tooltipRef.current?.contains(target) ||
        (container.current?.contains(target) &&
          target.closest('[data-cloud-word]'))
      )
        return;
      setTip(null);
    };
    const dismiss = () => setTip(null);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    const scroll = (event: Event) => {
      if (
        !(event.target instanceof Node) ||
        !tooltipRef.current?.contains(event.target)
      )
        dismiss();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', dismiss);
    return () => {
      cancelClose();
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [container]);
  const handlers = (word: CloudWord) => ({
    'data-cloud-word': true,
    'aria-describedby': tip?.wordId === word.id ? descriptionId : undefined,
    'aria-pressed': tip?.wordId === word.id && tip.mode === 'tap',
    onPointerEnter: (event: PointerEvent<Element>) => {
      if (event.pointerType === 'mouse') {
        cancelClose();
        setTip({
          wordId: word.id,
          groupId: word.groupId,
          x: event.clientX,
          y: event.clientY,
          mode: 'hover',
        });
      }
    },
    onPointerMove: (event: PointerEvent<Element>) => {
      if (event.pointerType === 'mouse')
        setTip({
          wordId: word.id,
          groupId: word.groupId,
          x: event.clientX,
          y: event.clientY,
          mode: 'hover',
        });
    },
    onPointerLeave: closeHover,
    onFocus: (event: FocusEvent<Element>) => {
      if (event.currentTarget.matches(':focus-visible')) {
        const box = event.currentTarget.getBoundingClientRect();
        setTip({
          wordId: word.id,
          groupId: word.groupId,
          x: box.x + box.width / 2,
          y: box.top,
          mode: 'keyboard',
        });
      }
    },
    onBlur: () =>
      setTip((current) => (current?.mode === 'keyboard' ? null : current)),
    onClick: (event: MouseEvent<Element>) => {
      cancelClose();
      const box = event.currentTarget.getBoundingClientRect();
      setTip((current) =>
        current?.wordId === word.id && current.mode === 'tap'
          ? null
          : {
              wordId: word.id,
              groupId: word.groupId,
              x: event.detail ? event.clientX : box.x + box.width / 2,
              y: event.detail ? event.clientY : box.top,
              mode: 'tap',
            },
      );
    },
  });
  return (
    <div className={styles.explorer}>
      <div ref={container} className={styles.cloud}>
        {!layout ? (
          <p role="status" className={styles.loading}>
            키워드를 펼치고 있어요…
          </p>
        ) : (
          <>
            <div className={styles.viewport}>
              <svg
                width={layout.width}
                height={layout.height}
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                role="group"
                aria-label="전공 키워드 워드클라우드"
                style={{ fontFamily: layout.font }}
              >
                <g
                  transform={`translate(${layout.width / 2},${layout.height / 2})`}
                >
                  {layout.words.map((word) => (
                    <text
                      key={word.id}
                      role="button"
                      tabIndex={0}
                      textAnchor="middle"
                      transform={`translate(${word.x},${word.y}) rotate(${word.rotate})`}
                      fontSize={word.size}
                      fontWeight={word.main ? 700 : 400}
                      className={styles.word}
                      style={{
                        fill:
                          activeId && activeId !== word.groupId
                            ? '#a1a1aa'
                            : activeId === word.groupId || word.main
                              ? colors[word.colorIndex % colors.length]
                              : '#64748b',
                      }}
                      aria-label={`${word.text}${word.main ? '' : ` · ${keywords.find((k) => k.id === word.groupId)?.name}`}`}
                      {...handlers(word)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.currentTarget.dispatchEvent(
                            new window.MouseEvent('click', { bubbles: true }),
                          );
                        }
                      }}
                    >
                      {word.text}
                    </text>
                  ))}
                </g>
              </svg>
            </div>
            {layout.missing.length > 0 && (
              <div className={styles.overflow} aria-label="추가 키워드">
                {layout.missing.map((word: CloudWord) => (
                  <button key={word.id} type="button" {...handlers(word)}>
                    {word.text}
                  </button>
                ))}
              </div>
            )}
            <p className={styles.mobileHint}>
              좌우로 움직여 키워드 전체를 살펴보세요.
            </p>
          </>
        )}
      </div>
      {tip &&
        active &&
        createPortal(
          <KeywordTooltip
            ref={tooltipRef}
            id={descriptionId}
            x={tip.x}
            y={tip.y}
            keyword={active}
            onPointerEnter={cancelClose}
            onPointerLeave={closeHover}
          />,
          document.body,
        )}
    </div>
  );
}
