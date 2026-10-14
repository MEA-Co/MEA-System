import { Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type ContentReference } from '@/lib/exploration/fields';

export function ExplorationReferencesInput({
  references,
  onChange,
}: {
  references: ContentReference[];
  onChange: (references: ContentReference[]) => void;
}) {
  function updateReference(
    clientKey: string,
    patch: Partial<ContentReference>,
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
    <Card
      variant="accent"
      size="sm"
      aria-labelledby="activity-references-heading"
    >
      <CardHeader variant="emphasis">
        <h2
          id="activity-references-heading"
          className="flex items-center gap-2 text-base font-semibold text-foreground"
        >
          <span>
            참고 자료{' '}
            <span className="text-sm font-normal text-muted-foreground">
              (선택)
            </span>
          </span>
        </h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          이 탐구에서 참고한 자료가 있다면 작성해 주세요.
        </p>
        {references.map((reference, index) => {
          const id = `activity-reference-${reference.clientKey}`;
          return (
            <div
              key={reference.clientKey}
              role="group"
              aria-labelledby={`${id}-heading`}
              className="min-w-0 space-y-4 rounded-md border p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h4 id={`${id}-heading`} className="text-sm font-medium">
                  참고자료 {index + 1}
                </h4>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  aria-label={`참고자료 ${index + 1} 삭제`}
                  onClick={() =>
                    onChange(
                      references.filter(
                        (item) => item.clientKey !== reference.clientKey,
                      ),
                    )
                  }
                >
                  <Minus aria-hidden="true" />
                </Button>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor={`${id}-title`}>참고 자료명</Label>
                  <Input
                    id={`${id}-title`}
                    value={reference.title}
                    placeholder="예) 논문명, 도서명, 기사명 등"
                    onChange={(event) =>
                      updateReference(reference.clientKey, {
                        title: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-selection`}>
                    자료 선정 과정/방법/선택 이유
                  </Label>
                  <Textarea
                    id={`${id}-selection`}
                    value={reference.selection}
                    placeholder="이 자료를 선택한 과정이나 방법, 선택 이유를 작성해 주세요."
                    className="min-h-24 resize-y"
                    onChange={(event) =>
                      updateReference(reference.clientKey, {
                        selection: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-usage`}>탐구 내 자료 활용법</Label>
                  <Textarea
                    id={`${id}-usage`}
                    value={reference.usage}
                    placeholder="이 자료를 탐구 과정에서 어떻게 활용했는지 작성해 주세요."
                    className="min-h-24 resize-y"
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
          className="w-full"
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
      </CardContent>
    </Card>
  );
}
