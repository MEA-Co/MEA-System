'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ExplorationCompetencyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const competencies = value.split('\n').filter(Boolean);

  function addCompetency() {
    const competency = text.trim().replace(/\s+/g, ' ');
    if (!competency) return;
    if (
      competencies.some(
        (item) =>
          item.normalize('NFKC').toLowerCase() ===
          competency.normalize('NFKC').toLowerCase(),
      )
    ) {
      setError('이미 추가한 역량입니다.');
      return;
    }
    onChange([...competencies, competency].join('\n'));
    setText('');
    setError('');
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <Label htmlFor="activity-competencies">역량</Label>
      <p
        id="activity-competencies-description"
        className="text-sm leading-6 text-muted-foreground"
      >
        탐구활동에서 강조하려 한, 또는 실제로 강조된 역량을 입력해주세요
        <br />
        예: 실험 역량, 데이터 활용 역량, 비판적 사고 역량 등
      </p>
      {competencies.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {competencies.map((competency, index) => (
            <Badge
              key={competency}
              variant="secondary"
              className="max-w-full gap-1.5 px-3 py-1.5 text-sm whitespace-normal"
            >
              <span className="min-w-0 break-words">{competency}</span>
              <button
                type="button"
                aria-label={`${competency} 삭제`}
                className="shrink-0 rounded-full p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() =>
                  onChange(
                    competencies.filter((_, i) => i !== index).join('\n'),
                  )
                }
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex max-w-lg items-center gap-2">
        <Input
          id="activity-competencies"
          aria-describedby={`activity-competencies-description${error ? ' activity-competencies-error' : ''}`}
          aria-invalid={!!error}
          placeholder="역량을 하나씩 입력해 주세요"
          value={text}
          className="min-w-0 rounded-xl"
          onChange={(event) => {
            setText(event.target.value);
            setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (
                !event.nativeEvent.isComposing &&
                event.nativeEvent.keyCode !== 229
              )
                addCompetency();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!text.trim()}
          onClick={addCompetency}
        >
          <Plus aria-hidden="true" />
          추가
        </Button>
      </div>
      {error && (
        <p
          id="activity-competencies-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
