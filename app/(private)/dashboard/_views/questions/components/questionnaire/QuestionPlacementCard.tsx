'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { type QuestionBlockRow, questionName } from '../../lib/question-blocks';
import { hasQuestionDetailContent } from '../../lib/question-details';
import {
  questionExplanationClass,
  questionPromptClass,
} from '../question/question-styles';
import { RichTextContent } from '../question/RichTextContent';

const labels = {
  text: '서술형',
  scale: '척도형',
  single: '단일선택형',
  multiple: '다수선택형',
  exploration: '탐구활동 참조형',
  study: '학습법 참조형',
};

export function QuestionPlacementCard({
  question,
  showPrivate = true,
  showSourceLink = true,
}: {
  question: QuestionBlockRow;
  showPrivate?: boolean;
  showSourceLink?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="sr-only">{questionName(question)}</span>
        {showSourceLink && (
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link
                href={`/dashboard?view=questions&question=${question.id}`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
            nativeButton={false}
          >
            원본 질문 열기
          </Button>
        )}
      </div>
      <div className={questionPromptClass}>
        <RichTextContent value={question.prompt} />
      </div>
      <div className="flex flex-wrap gap-2">
        {question.purpose === 'study_registration' && (
          <Button type="button" variant="outline" size="sm" disabled>
            {question.button_label || '학습법 추가'}
          </Button>
        )}
        {question.fields.map((field) => (
          <span key={field.id} className="text-xs text-muted-foreground">
            {field.label} · {labels[field.kind]}
          </span>
        ))}
        {question.condition && <Badge variant="outline">조건부 질문</Badge>}
      </div>
      {(question.details ?? [])
        .filter(
          (detail) =>
            hasQuestionDetailContent(detail) &&
            (showPrivate || detail.visibleToConsultants),
        )
        .map((detail) => (
          <div key={detail.id} className={questionExplanationClass}>
            <div className="mb-2 flex items-center gap-2">
              <strong>{detail.title || '설명'}</strong>
              <span className="text-xs text-muted-foreground">
                {detail.visibleToConsultants ? '공개' : '비공개'}
              </span>
            </div>
            <RichTextContent value={detail.text} />
          </div>
        ))}
    </div>
  );
}
