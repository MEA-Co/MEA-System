import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { type ActivityReference } from '../lib/fields';

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
        <h3 id="activity-references-heading" className="text-sm font-medium">
          참고자료와 각각의 활용 방안
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">
          참고자료를 하나씩 추가하고 활용 방안을 작성해 주세요. 링크가 있으면
          함께 입력해 주세요.
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${id}-title`}>자료명</Label>
                <Input
                  id={`${id}-title`}
                  value={reference.title}
                  placeholder="책, 논문, 기사 등의 자료명"
                  className="rounded-xl"
                  onChange={(event) =>
                    updateReference(reference.clientKey, {
                      title: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-link`}>
                  링크{' '}
                  <span className="text-xs text-muted-foreground">선택</span>
                </Label>
                <Input
                  id={`${id}-link`}
                  inputMode="url"
                  value={reference.link}
                  placeholder="https://"
                  className="rounded-xl"
                  onChange={(event) =>
                    updateReference(reference.clientKey, {
                      link: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`${id}-usage`}>활용 방안</Label>
                <Textarea
                  id={`${id}-usage`}
                  value={reference.usage}
                  placeholder="이 자료를 탐구활동에 어떻게 활용했거나 활용할지 작성해 주세요"
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
            { clientKey: crypto.randomUUID(), title: '', link: '', usage: '' },
          ])
        }
      >
        <Plus aria-hidden="true" />
        참고자료 추가
      </Button>
    </section>
  );
}
