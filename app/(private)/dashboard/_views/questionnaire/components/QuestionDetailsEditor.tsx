'use client';

import { Plus, Trash2 } from 'lucide-react';

import type { QuestionDetail } from '@/app/(private)/dashboard/_views/questionnaire/lib/types';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

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
    <div className="mt-4 space-y-3 border-l-2 border-neutral-300 pl-4 dark:border-neutral-700">
      {details.map((detail, index) => (
        <QuestionAnnotationEditor
          key={detail.id}
          id={`detail-${detail.id}`}
          label={`설명 항목 ${index + 1}`}
          title={detail.title}
          text={detail.text}
          onTitleChange={(title) => update(detail.id, { title })}
          onTextChange={(text) => update(detail.id, { text })}
          actions={
            <>
              <label
                htmlFor={`detail-visible-${detail.id}`}
                className={`mr-2 cursor-pointer text-xs font-medium ${detail.visibleToConsultants ? 'text-blue-600' : 'text-muted-foreground'}`}
              >
                {detail.visibleToConsultants
                  ? '컨설턴트 공개'
                  : '컨설턴트 비공개'}
              </label>
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
        variant="ghost"
        size="sm"
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
