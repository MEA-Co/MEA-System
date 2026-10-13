'use client';

import { Plus } from 'lucide-react';

import { useStudyList } from '@/app/(private)/dashboard/_views/study/hooks/useStudyList';
import { StudyView } from '@/app/(private)/dashboard/_views/study/StudyView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { QuestionBlockDocument } from '../../lib/question-blocks';

import { RichTextContent } from './RichTextContent';

function StudyRegistrationAction({ label }: { label: string }) {
  const { data, error, mutate } = useStudyList('own', true, undefined, {
    identityOnly: true,
  });
  if (error && !data)
    return (
      <div role="alert" className="space-y-2 text-sm text-destructive">
        <p>학습법 등록 화면을 불러오지 못했어요.</p>
        <Button type="button" variant="outline" onClick={() => void mutate()}>
          다시 시도
        </Button>
      </div>
    );
  if (!data)
    return (
      <div className="space-y-2">
        <Button
          type="button"
          disabled
          className="h-auto min-h-9 max-w-full text-left whitespace-normal wrap-anywhere"
        >
          <Plus aria-hidden="true" />
          {label}
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          학습법 등록 화면을 준비하고 있어요.
        </p>
      </div>
    );
  return (
    <StudyView
      userId={data.userId}
      registrationOnly
      registrationLabel={label}
    />
  );
}

export function StudyRegistrationCard({
  document,
  questionNumber = 1,
  showPrivateDetails = false,
  disabled = false,
}: {
  document: QuestionBlockDocument;
  questionNumber?: number;
  showPrivateDetails?: boolean;
  disabled?: boolean;
}) {
  const buttonLabel = document.buttonLabel?.trim() || '학습법 추가';
  return (
    <div className="min-w-0 max-w-full space-y-6 rounded-2xl border border-neutral-200 bg-background p-5 sm:p-8 dark:border-neutral-700">
      <div className="flex items-start gap-3">
        <span className="w-6 shrink-0 text-sm font-semibold">
          {questionNumber}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          {document.title.trim() && (
            <h3 className="font-semibold whitespace-pre-wrap wrap-anywhere">
              {document.title}
            </h3>
          )}
          <RichTextContent
            value={document.prompt || '학습법 등록 안내를 입력하세요'}
            className="min-w-0"
          />
        </div>
      </div>
      {(document.details ?? [])
        .filter((detail) => showPrivateDetails || detail.visibleToConsultants)
        .map((detail) => (
          <div
            key={detail.id}
            className="rounded-lg border-l-2 border-neutral-300 bg-muted/40 p-4"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <h4 className="min-w-0 flex-1 text-sm font-semibold wrap-anywhere">
                {detail.title}
              </h4>
              {showPrivateDetails && (
                <Badge
                  className={
                    detail.visibleToConsultants
                      ? 'shrink-0 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'shrink-0 border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                  }
                >
                  {detail.visibleToConsultants
                    ? '컨설턴트 공개'
                    : '컨설턴트 비공개'}
                </Badge>
              )}
            </div>
            <RichTextContent value={detail.text} />
          </div>
        ))}
      {disabled ? (
        <Button
          type="button"
          disabled
          className="h-auto min-h-9 max-w-full text-left whitespace-normal wrap-anywhere"
        >
          <Plus aria-hidden="true" />
          {buttonLabel}
        </Button>
      ) : (
        <StudyRegistrationAction label={buttonLabel} />
      )}
    </div>
  );
}
