'use client';

import { Check, Plus, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function BrandingKeywordInput({
  major,
  keywords,
  onChange,
}: {
  major: string;
  keywords: string[];
  onChange: (keywords: string[]) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const submit = () => {
    const keyword = text.trim().replace(/\s+/g, ' ');
    if (!keyword) return;
    if (
      keywords.some(
        (value) =>
          value.normalize('NFKC').toLowerCase() ===
          keyword.normalize('NFKC').toLowerCase(),
      )
    ) {
      setError('이미 추가한 키워드예요.');
      return;
    }
    onChange([...keywords, keyword]);
    setText('');
    setAdding(false);
    setError('');
  };
  return (
    <section
      className="mb-7 space-y-3 border-b border-violet-100 pb-7"
      aria-label={`${major} 키워드 입력`}
    >
      <label htmlFor={id} className="block font-semibold text-violet-900">
        나의 세부 키워드
      </label>
      <p className="text-sm leading-6 text-slate-500">
        관심 있는 키워드를 하나씩 추가해 주세요. 키워드는 구체적일수록 좋아요.
        예: F1, 생성형 인공지능, 프로이트 등
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {keywords.map((keyword, index) => (
          <span
            key={keyword}
            className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-100 px-3 py-2 text-sm font-medium text-violet-800"
          >
            {keyword}
            <button
              type="button"
              aria-label={`${keyword} 삭제`}
              className="rounded-full p-0.5 hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-violet-500"
              onClick={() => onChange(keywords.filter((_, i) => i !== index))}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        {!!keywords.length && !adding && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`${major} 키워드 추가`}
            className="rounded-full border-dashed border-violet-300 text-violet-700 hover:bg-violet-50"
            onClick={() => {
              setAdding(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {(!keywords.length || adding) && (
        <div className="flex max-w-lg items-center gap-2">
          <Input
            ref={inputRef}
            id={id}
            value={text}
            maxLength={80}
            placeholder="키워드 하나를 입력해 주세요"
            className="h-11 rounded-xl border-violet-200 focus-visible:ring-violet-200"
            onChange={(event) => {
              setText(event.target.value);
              setError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (!event.nativeEvent.isComposing) submit();
              }
            }}
          />
          <Button
            type="button"
            aria-label="키워드 등록"
            disabled={!text.trim()}
            className="h-11 rounded-xl bg-violet-700 text-white hover:bg-violet-800"
            onClick={submit}
          >
            <Check className="size-4" aria-hidden="true" />
            추가
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </section>
  );
}
