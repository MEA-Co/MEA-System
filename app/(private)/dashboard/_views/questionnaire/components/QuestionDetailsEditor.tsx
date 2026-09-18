'use client';

import { Plus, Trash2 } from 'lucide-react';

import type { QuestionDetail } from '@/app/(private)/dashboard/_views/questionnaire/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

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
    <div className="mt-4 space-y-3 border-l-2 border-muted pl-4">
      {details.map((detail, index) => (
        <div key={detail.id} className="rounded-xl border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor={`detail-title-${detail.id}`}
              className="text-xs font-medium text-muted-foreground"
            >
              설명 항목 {index + 1}
            </label>
            <div className="flex items-center gap-1">
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
            </div>
          </div>
          <Input
            id={`detail-title-${detail.id}`}
            value={detail.title}
            placeholder="항목 제목 (예: 질문 의도, 예상되는 어려움)"
            className="rounded-lg border-border bg-muted"
            onChange={(event) =>
              update(detail.id, { title: event.target.value })
            }
          />
          <label htmlFor={`detail-text-${detail.id}`} className="sr-only">
            설명 항목 {index + 1} 내용
          </label>
          <Textarea
            id={`detail-text-${detail.id}`}
            value={detail.text}
            placeholder="내용을 작성하세요"
            rows={3}
            className="mt-3 rounded-lg border-border bg-muted"
            onChange={(event) =>
              update(detail.id, { text: event.target.value })
            }
          />
        </div>
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
