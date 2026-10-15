'use client';

import { Plus, Trash2 } from 'lucide-react';

import type { QuestionDetail } from '@/app/(private)/dashboard/_views/questions/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { QUESTION_DETAIL_LIMITS } from '../../lib/question-details';

import { questionExplanationClass } from './question-styles';
import { QuestionAnnotationEditor } from './QuestionAnnotationEditor';

export function QuestionDetailsEditor({
  details,
  onChange,
}: {
  details: QuestionDetail[];
  onChange: (details: QuestionDetail[]) => void;
}) {
  function update(id: string, patch: Partial<QuestionDetail>) {
    onChange(
      details.map((detail) =>
        detail.id === id ? { ...detail, ...patch } : detail,
      ),
    );
  }

  return (
    <div className="space-y-3">
      {details.map((detail, index) => (
        <QuestionAnnotationEditor
          key={detail.id}
          id={`detail-${detail.id}`}
          label={`설명 항목 ${index + 1}`}
          titleMaxLength={QUESTION_DETAIL_LIMITS.title}
          textMaxLength={QUESTION_DETAIL_LIMITS.text}
          authoring
          title={detail.title}
          text={detail.text}
          onTitleChange={(title) => update(detail.id, { title })}
          onTextChange={(text) => update(detail.id, { text })}
          actions={
            <>
              <Label
                htmlFor={`detail-visible-${detail.id}`}
                className={`mr-2 cursor-pointer text-xs leading-normal font-medium ${detail.visibleToConsultants ? 'text-blue-600' : 'text-muted-foreground'}`}
              >
                {detail.visibleToConsultants
                  ? '컨설턴트 공개'
                  : '컨설턴트 비공개'}
              </Label>
              <Switch
                id={`detail-visible-${detail.id}`}
                checked={detail.visibleToConsultants}
                className="data-checked:bg-blue-600 focus-visible:ring-blue-500/50"
                aria-label={`${detail.title || `설명 항목 ${index + 1}`} 컨설턴트 공개`}
                onCheckedChange={(checked) =>
                  update(detail.id, {
                    visibleToConsultants: checked,
                  })
                }
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`설명 항목 ${index + 1} 삭제`}
                onClick={() =>
                  onChange(details.filter((item) => item.id !== detail.id))
                }
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </>
          }
        />
      ))}
      <Button
        type="button"
        variant="ghost"
        className={`${questionExplanationClass} h-auto min-h-12 w-full justify-start rounded-l-none border-y-0 border-r-0 hover:bg-neutral-100 dark:hover:bg-neutral-800`}
        disabled={details.length >= QUESTION_DETAIL_LIMITS.count}
        onClick={() =>
          onChange([
            ...details,
            {
              id: crypto.randomUUID(),
              title: '',
              text: '',
              visibleToConsultants: false,
            },
          ])
        }
      >
        <Plus aria-hidden="true" />
        설명 항목 추가
      </Button>
    </div>
  );
}
