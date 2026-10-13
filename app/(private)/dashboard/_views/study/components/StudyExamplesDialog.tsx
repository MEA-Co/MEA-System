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

import { StudyActivityDetails } from './StudyActivityDetails';

export function StudyExamplesDialog() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const example = studyExamples[index];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant="default" size="lg" />}
      >
        <BookOpen className="size-4" /> 학습법 예시 보기
      </DialogTrigger>
      <DialogContent className="flex h-[90dvh] w-[96vw] max-w-[1200px] flex-col gap-3 rounded-lg p-4 sm:max-w-[1200px] md:p-6">
        <DialogHeader className="shrink-0 pr-10">
          <DialogTitle>학습법 작성 예시</DialogTitle>
          <DialogDescription>
            예시를 참고해 문제 상황에 맞는 솔루션을 작성해 주세요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b pb-3">
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
            <p className="font-semibold">{example.title}</p>
            <p className="text-xs text-muted-foreground">
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
        <StudyActivityDetails
          key={example.activity.clientKey}
          activity={example.activity}
          notice=""
          hideEmptyFields
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
