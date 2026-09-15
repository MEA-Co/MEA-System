'use client';

import cloud from 'd3-cloud';
import { useEffect, useRef, useState } from 'react';

import type { MajorKeyword } from '@/features/keywords/major-overview/types';

export type CloudWord = {
  id: string;
  groupId: string;
  text: string;
  main: boolean;
  colorIndex: number;
  size: number;
  x?: number;
  y?: number;
  rotate?: number;
};
type Layout = {
  words: CloudWord[];
  width: number;
  height: number;
  font: string;
  missing: CloudWord[];
};

export function useMajorCloudLayout(keywords: MajorKeyword[]) {
  const container = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let engine: ReturnType<typeof cloud<CloudWord>> | undefined;
    let timer: ReturnType<typeof setTimeout>;
    let previousWidth = 0;
    let generation = 0;
    const draw = async () => {
      await document.fonts.ready;
      if (disposed) return;
      const width = Math.max(
        640,
        Math.round(element.getBoundingClientRect().width),
      );
      if (width === previousWidth) return;
      previousWidth = width;
      const version = ++generation;
      engine?.stop();
      const font = getComputedStyle(element).fontFamily;
      const context = document.createElement('canvas').getContext('2d')!;
      const groups: {
        words: CloudWord[];
        width: number;
        height: number;
        x: number;
        y: number;
      }[] = [];
      const missing: CloudWord[] = [];
      for (const [i, keyword] of keywords.entries()) {
        if (disposed || version !== generation) return;
        const words: CloudWord[] = [
          {
            id: keyword.id,
            groupId: keyword.id,
            text: keyword.name,
            main: true,
            colorIndex: i,
            size: 25 + (i % 4) * 3,
          },
          ...keyword.examples.map((example, j) => ({
            id: example.id,
            groupId: keyword.id,
            text: example.label,
            main: false,
            colorIndex: i,
            size: 14 + (j % 3) * 2,
          })),
        ];
        const measure = (word: CloudWord) => {
          context.font = `${word.main ? 700 : 400} ${word.size}px ${font}`;
          return context.measureText(word.text).width;
        };
        // Each related family is laid out together, before packing the families.
        for (const word of words) {
          const measured = measure(word);
          if (measured > width - 64) word.size *= (width - 64) / measured;
        }
        const localWidth = Math.min(
          width,
          Math.ceil(Math.max(260, ...words.map(measure)) / 32) * 32 + 32,
        );
        let placed: CloudWord[] = [];
        for (let attempt = 0; attempt < 5; attempt++) {
          let seed = 71 + i * 137;
          let randomCalls = 0;
          placed = await new Promise<CloudWord[]>((resolve) => {
            engine = cloud<CloudWord>()
              .size([localWidth, 180 + attempt * 80])
              .words(words.map((word) => ({ ...word })))
              .text((word) => word.text)
              .font(font)
              .fontWeight((word) => (word.main ? 700 : 400))
              .fontSize((word) => word.size)
              .padding(3)
              .rotate(0)
              .spiral('archimedean')
              .random(() => {
                if (randomCalls++ < 3) return 0.5;
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                return seed / 4294967296;
              })
              .timeInterval(12)
              .on('end', resolve);
            engine.start();
          });
          if (disposed || version !== generation) return;
          if (placed.length === words.length) break;
        }
        const found = new Set(placed.map((word) => word.id));
        missing.push(...words.filter((word) => !found.has(word.id)));
        if (!placed.length) continue;
        const left =
          Math.min(...placed.map((word) => word.x! - measure(word) / 2)) - 10;
        const right =
          Math.max(...placed.map((word) => word.x! + measure(word) / 2)) + 10;
        const top = Math.min(...placed.map((word) => word.y! - word.size)) - 10;
        const bottom =
          Math.max(...placed.map((word) => word.y! + word.size * 0.3)) + 10;
        groups.push({
          words: placed.map((word) => ({
            ...word,
            x: word.x! - (left + right) / 2,
            y: word.y! - (top + bottom) / 2,
          })),
          width: right - left,
          height: bottom - top,
          x: 0,
          y: 0,
        });
      }
      // Interlock the actual word outlines: family rectangles may overlap.
      // This fills the gaps between families while preserving parent proximity.
      const packed: typeof groups = [];
      const occupied: {
        left: number;
        right: number;
        top: number;
        bottom: number;
      }[] = [];
      const rectangles = (
        group: (typeof groups)[number],
        x: number,
        y: number,
      ) =>
        group.words.map((word) => {
          context.font = `${word.main ? 700 : 400} ${word.size}px ${font}`;
          const metrics = context.measureText(word.text);
          return {
            left: x + word.x! - metrics.width / 2 - 3,
            right: x + word.x! + metrics.width / 2 + 3,
            top:
              y +
              word.y! -
              (metrics.actualBoundingBoxAscent || word.size * 0.85) -
              3,
            bottom:
              y +
              word.y! +
              (metrics.actualBoundingBoxDescent || word.size * 0.15) +
              3,
          };
        });
      // Larger families anchor the centre; smaller ones fill the remaining gaps.
      groups.sort((a, b) => b.width * b.height - a.width * a.height);
      for (const group of groups) {
        const local = rectangles(group, 0, 0);
        let fits = false;
        for (let step = 0; step < 40000; step++) {
          const angle = step * 0.075;
          const radius = angle * 1.6;
          const x = Math.cos(angle) * radius * 1.3;
          const y = Math.sin(angle) * radius * 0.8;
          const boxes = local.map((box) => ({
            left: box.left + x,
            right: box.right + x,
            top: box.top + y,
            bottom: box.bottom + y,
          }));
          if (
            boxes.some(
              (box) => box.left < -width / 2 + 10 || box.right > width / 2 - 10,
            )
          )
            continue;
          if (
            boxes.some((box) =>
              occupied.some(
                (other) =>
                  box.left < other.right &&
                  box.right > other.left &&
                  box.top < other.bottom &&
                  box.bottom > other.top,
              ),
            )
          )
            continue;
          group.x = x;
          group.y = y;
          fits = true;
          occupied.push(...boxes);
          break;
        }
        if (!fits) {
          group.x = 0;
          group.y =
            Math.max(0, ...occupied.map((box) => box.bottom)) +
            group.height / 2 +
            8;
          occupied.push(...rectangles(group, group.x, group.y));
        }
        packed.push(group);
      }
      const top = Math.min(
        0,
        ...packed.map((group) => group.y - group.height / 2),
      );
      const bottom = Math.max(
        0,
        ...packed.map((group) => group.y + group.height / 2),
      );
      const height = Math.max(300, Math.ceil(bottom - top + 32));
      const center = (top + bottom) / 2;
      if (!disposed && version === generation)
        setLayout({
          width,
          height,
          font,
          missing,
          words: packed.flatMap((group) =>
            group.words.map((word) => ({
              ...word,
              x: word.x! + group.x,
              y: word.y! + group.y - center,
              rotate: 0,
            })),
          ),
        });
    };
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void draw(), 120);
    });
    observer.observe(element);
    void draw();
    return () => {
      disposed = true;
      observer.disconnect();
      clearTimeout(timer);
      engine?.stop();
    };
  }, [keywords]);
  return { container, layout };
}
