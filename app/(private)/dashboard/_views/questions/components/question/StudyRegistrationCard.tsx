'use client';

import { Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { QuestionBlockDocument } from '../../lib/question-blocks';

import {
  questionExplanationClass,
  questionNumberClass,
  questionPromptClass,
  questionSurfaceClass,
} from './question-styles';
import { RichTextContent } from './RichTextContent';
import { StudyRegistrationAction } from './StudyRegistrationAction';

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
    <div className={questionSurfaceClass}>
      <div className={questionPromptClass}>
        <span className={questionNumberClass}>{questionNumber}</span>
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
          <div key={detail.id} className={questionExplanationClass}>
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
