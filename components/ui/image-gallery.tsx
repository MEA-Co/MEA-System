'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type GalleryImage = { id: string; src: string; alt: string };

/** Same-origin authenticated images must bypass Next's unauthenticated image optimizer. */
export function ImageGallery({
  images,
  label = '첨부 사진',
}: {
  images: GalleryImage[];
  label?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const pointer = useRef<number | null>(null);
  const index = Math.max(
    0,
    images.findIndex((image) => image.id === selected),
  );
  const current = images[index];
  if (!current) return null;
  const multiple = images.length > 1;
  function move(direction: number) {
    const target =
      images[Math.max(0, Math.min(images.length - 1, index + direction))];
    if (target) setSelected(target.id);
  }
  function controls() {
    if (!multiple) return null;
    return (
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="이전 사진"
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          <ChevronLeft />
        </Button>
        <div
          className="flex flex-wrap justify-center gap-1"
          aria-label="사진 선택"
        >
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              aria-label={`${i + 1}번째 사진`}
              aria-current={i === index ? 'true' : undefined}
              className="flex size-6 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => setSelected(image.id)}
            >
              <span
                className={cn(
                  'size-2 rounded-full bg-muted-foreground/30',
                  i === index && 'bg-primary',
                )}
              />
            </button>
          ))}
        </div>
        <span
          className="min-w-10 text-center text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {index + 1} / {images.length}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="다음 사진"
          disabled={index === images.length - 1}
          onClick={() => move(1)}
        >
          <ChevronRight />
        </Button>
      </div>
    );
  }
  const gestures = {
    onPointerDown: (event: React.PointerEvent) => {
      pointer.current = event.pointerType === 'touch' ? event.clientX : null;
    },
    onPointerUp: (event: React.PointerEvent) => {
      if (
        pointer.current !== null &&
        Math.abs(event.clientX - pointer.current) > 50
      ) {
        move(event.clientX < pointer.current ? 1 : -1);
      }
      pointer.current = null;
    },
    onPointerCancel: () => {
      pointer.current = null;
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      if (!multiple || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    },
  };
  return (
    <>
      <div
        className={
          multiple
            ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
            : undefined
        }
        role="region"
        aria-label={label}
      >
        {images.map((image, i) => (
          <button
            key={image.id}
            type="button"
            className={cn(
              'flex w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border bg-muted transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-ring',
              multiple && 'aspect-[4/3]',
            )}
            aria-label={`${label} ${i + 1} 크게 보기`}
            onClick={() => {
              setSelected(image.id);
              setOpen(true);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={image.alt}
              loading="lazy"
              draggable={false}
              className={cn(
                'w-full object-contain',
                multiple ? 'h-full' : 'max-h-[32rem]',
              )}
            />
          </button>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[95dvh] gap-3 p-3 sm:max-w-[min(90vw,80rem)] sm:p-5"
          {...gestures}
        >
          <DialogHeader className="pr-12">
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription className="sr-only">
              사진을 크게 보는 화면입니다. 여러 사진은 좌우 화살표로 넘길 수
              있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 touch-pan-y items-center justify-center overflow-auto rounded-lg bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.src}
              alt={current.alt}
              draggable={false}
              className="max-h-[75dvh] w-full object-contain"
            />
          </div>
          {controls()}
        </DialogContent>
      </Dialog>
    </>
  );
}
