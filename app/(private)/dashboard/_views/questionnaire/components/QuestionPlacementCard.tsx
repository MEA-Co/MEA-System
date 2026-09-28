'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { RichTextContent } from '../../questions/components/question/RichTextContent';
import {
  type QuestionBlockRow,
  questionName,
} from '../../questions/lib/question-blocks';
import { rowLimitLabel } from '../../questions/lib/question-list';

const labels = {
  text: '서술형',
  scale: '척도형',
  single: '단일선택형',
  multiple: '다수선택형',
};

export function QuestionPlacementCard({
  question,
  showPrivate = true,
}: {
  question: QuestionBlockRow;
  showPrivate?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{questionName(question)}</p>
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
      </div>
      <RichTextContent value={question.prompt} />
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{rowLimitLabel(question)}</Badge>
        {question.fields.map((field) => (
          <Badge key={field.id} variant="outline">
            {field.label} · {labels[field.kind]}
          </Badge>
        ))}
        {question.condition && <Badge variant="outline">조건부 질문</Badge>}
      </div>
      {(question.details ?? [])
        .filter((detail) => showPrivate || detail.visibleToConsultants)
        .map((detail) => (
          <div key={detail.id} className="rounded-lg bg-muted/40 p-3 text-sm">
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
