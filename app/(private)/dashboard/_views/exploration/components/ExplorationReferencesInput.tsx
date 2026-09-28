import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { type ActivityReference } from '../lib/fields';

import { ExplorationFieldIcon } from './ExplorationFieldIcon';

export function ExplorationReferencesInput({
  references,
  onChange,
}: {
  references: ActivityReference[];
  onChange: (references: ActivityReference[]) => void;
}) {
  function updateReference(
    clientKey: string,
    patch: Partial<ActivityReference>,
  ) {
    onChange(
      references.map((reference) =>
        reference.clientKey === clientKey
          ? { ...reference, ...patch }
          : reference,
      ),
    );
  }

  return (
    <section
      aria-labelledby="activity-references-heading"
      className="min-w-0 space-y-4 md:col-span-2"
    >
      <div className="space-y-2">
        <h3
          id="activity-references-heading"
          className="flex items-center gap-2 text-base font-semibold text-foreground"
        >
          <ExplorationFieldIcon field="references" />
          <span>
            참고 자료{' '}
            <span className="text-sm font-normal text-muted-foreground">
              (선택)
            </span>
          </span>
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">
          이 탐구에서 참고한 자료가 있다면 작성해 주세요.
        </p>
      </div>
      {references.map((reference, index) => {
        const id = `activity-reference-${reference.clientKey}`;
        return (
          <div
            key={reference.clientKey}
            role="group"
            aria-labelledby={`${id}-heading`}
            className="min-w-0 space-y-4 rounded-xl border p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h4 id={`${id}-heading`} className="text-sm font-medium">
                참고자료 {index + 1}
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`참고자료 ${index + 1} 삭제`}
                onClick={() =>
                  onChange(
                    references.filter(
                      (item) => item.clientKey !== reference.clientKey,
                    ),
                  )
                }
              >
                <Trash2 aria-hidden="true" />
                삭제
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`${id}-title`}>
                  <ExplorationFieldIcon field="title" />
                  참고 자료명
                </Label>
                <Input
                  id={`${id}-title`}
                  value={reference.title}
                  placeholder="예) 논문명, 도서명, 기사명 등"
                  className="rounded-xl"
                  onChange={(event) =>
                    updateReference(reference.clientKey, {
                      title: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-selection`}>
                  <ExplorationFieldIcon field="selection" />
                  자료 선정 과정/방법/선택 이유
                </Label>
                <Textarea
                  id={`${id}-selection`}
                  value={reference.selection}
                  placeholder="이 자료를 선택한 과정이나 방법, 선택 이유를 작성해 주세요."
                  className="min-h-24 resize-y rounded-xl"
                  onChange={(event) =>
                    updateReference(reference.clientKey, {
                      selection: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-usage`}>
                  <ExplorationFieldIcon field="usage" />
                  탐구 내 자료 활용법
                </Label>
                <Textarea
                  id={`${id}-usage`}
                  value={reference.usage}
                  placeholder="이 자료를 탐구 과정에서 어떻게 활용했는지 작성해 주세요."
                  className="min-h-24 resize-y rounded-xl"
                  onChange={(event) =>
                    updateReference(reference.clientKey, {
                      usage: event.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...references,
            {
              clientKey: crypto.randomUUID(),
              title: '',
              selection: '',
              usage: '',
            },
          ])
        }
      >
        <Plus aria-hidden="true" />
        참고자료 추가
      </Button>
    </section>
  );
}
