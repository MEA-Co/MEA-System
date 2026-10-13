'use client';

import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { studyExamples } from '../lib/examples';

import { StudyDetails } from './StudyDetails';

export function StudyExamplesDialog({
  onOpenChange,
}: {
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const example = studyExamples[index];
  function changeOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen} disablePointerDismissal>
      <DialogTrigger
        render={<Button type="button" variant="default" size="lg" />}
      >
        <BookOpen className="size-4" /> 학습법 예시 보기
      </DialogTrigger>
      <DialogContent
        nested
        className="flex h-[90dvh] w-[96vw] max-w-[1200px] flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-[1200px]"
      >
        <DialogHeader className="shrink-0 border-b px-4 py-4 pr-14 md:px-6 md:pr-14">
          <DialogTitle className="text-xl font-extrabold">
            학습법 작성 예시
          </DialogTitle>
          <DialogDescription>
            예시를 참고해 문제 상황에 맞는 솔루션을 작성해 주세요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-muted px-4 py-3 md:px-6">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
            aria-label="이전 예시"
          >
            <ChevronLeft />
          </Button>
          <div className="min-w-0 text-center" aria-live="polite">
            <p className="font-bold break-keep">{example.title}</p>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {index + 1} / {studyExamples.length}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={index === studyExamples.length - 1}
            onClick={() => setIndex(index + 1)}
            aria-label="다음 예시"
          >
            <ChevronRight />
          </Button>
        </div>
        <StudyDetails
          key={example.study.clientKey}
          study={example.study}
          notice=""
          hideEmptyFields
          onClose={() => changeOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
