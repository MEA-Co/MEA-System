'use client';
import { Check, RotateCcw, SearchX } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { useBrandingMajorSearch } from '@/app/(private)/consulting/branding/_hooks/useBrandingMajorSearch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Candidate } from '@/features/keywords/major-search/domain';
import { normalizeMajorInput } from '@/features/keywords/major-search/domain';

import styles from './MajorOverviews.module.css';

function Details({ major }: { major: Candidate }) {
  return (
    <>
      <span className="block font-semibold text-slate-900">{major.name}</span>
      <span className="block text-xs text-violet-700">{major.field_name}</span>
      <span className="mt-1 block text-sm text-slate-600">
        {major.description}
      </span>
      {major.matched_alias && (
        <span className="mt-2 block text-xs text-slate-500">
          {major.matched_alias.alias_type === 'group_member'
            ? `${major.matched_alias.name}을 포함하는 전공군`
            : `검색된 명칭: ${major.matched_alias.name}`}
        </span>
      )}
      {major.item_type === 'major_group' && (
        <span className="mt-2 block text-xs text-slate-500">
          여러 교과별 전공을 묶은 통합 전공군입니다.
        </span>
      )}
    </>
  );
}
export function BrandingMajorSearchInput({
  value,
  onChange,
  onConfirmed,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onConfirmed?: (value: string) => void;
  label: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const {
    draft,
    result,
    selected,
    state,
    error,
    noMatch,
    waiting,
    changeInput,
    retrySearch,
    feedback: recordFeedback,
  } = useBrandingMajorSearch(value, onChange, onConfirmed);
  useEffect(() => {
    if (selected) confirmRef.current?.focus();
  }, [selected]);
  async function feedback(
    action: 'selected' | 'confirmed' | 'rejected' | 'no_match',
    candidate: Candidate | null,
  ) {
    const saved = await recordFeedback(action, candidate);
    if (saved && (action === 'rejected' || action === 'no_match'))
      inputRef.current?.focus();
  }
  return (
    <section className="space-y-3" aria-label={label}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <p id={`${id}-hint`} className="text-sm text-slate-600">
        관심 있는 학과를 입력해 주세요
      </p>
      <Input
        ref={inputRef}
        id={id}
        value={draft.input}
        maxLength={120}
        autoComplete="off"
        aria-describedby={`${id}-hint ${id}-status`}
        className="h-12 rounded-xl focus-visible:border-violet-500 focus-visible:ring-violet-200"
        onCompositionEnd={(event) => changeInput(event.currentTarget.value)}
        onChange={(event) => changeInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing)
            event.preventDefault();
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            document.getElementById(`${id}-candidate-0`)?.focus();
          }
        }}
      />
      <div
        id={`${id}-status`}
        role="status"
        aria-live="polite"
        className="text-sm text-slate-600"
      >
        {draft.confirmed ? (
          `${draft.confirmed.name} 선택이 완료되었어요.`
        ) : !normalizeMajorInput(draft.input) ? null : state === 'searching' ||
          state === 'db' ? (
          <span className={styles.loadingText}>전공을 찾고있어요</span>
        ) : state === 'saving-no-match' ? (
          '찾는 학과 없음 기록을 저장하고 있어요…'
        ) : state === 'saving' ? (
          '선택을 저장하고 있어요…'
        ) : noMatch ? (
          '찾는 학과가 없다는 의견을 기록했어요. 다른 학과명이나 별칭으로 다시 찾아보세요.'
        ) : state === 'ready' && !result?.candidates.length ? (
          '일치하는 전공을 찾지 못했어요. 정확한 이름으로 다시 검색해 주세요.'
        ) : null}
      </div>
      {error && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{error}</p>
          {state === 'error' && (
            <Button type="button" variant="outline" onClick={retrySearch}>
              다시 시도
            </Button>
          )}
        </div>
      )}
      {!draft.confirmed && selected ? (
        <div className="space-y-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <h2 className="font-semibold">이 학과가 맞나요?</h2>
          <div>
            <Details major={selected} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              ref={confirmRef}
              type="button"
              disabled={waiting}
              className="h-11 rounded-xl bg-violet-700 px-5 text-white shadow-sm shadow-violet-200 transition-colors hover:bg-violet-800 focus-visible:border-violet-500 focus-visible:ring-violet-300"
              onClick={() => void feedback('confirmed', selected)}
            >
              <Check aria-hidden="true" className="size-4" />
              네, 이 학과예요
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={waiting}
              className="h-11 rounded-xl border-violet-200 bg-white/80 px-5 text-violet-700 shadow-none transition-colors hover:border-violet-300 hover:bg-violet-100 hover:text-violet-900 focus-visible:border-violet-500 focus-visible:ring-violet-200"
              onClick={() => void feedback('rejected', selected)}
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              아니요, 다시 찾을게요
            </Button>
          </div>
        </div>
      ) : (
        !draft.confirmed &&
        !noMatch &&
        result &&
        (state === 'ready' ||
          state === 'saving' ||
          state === 'saving-no-match') && (
          <>
            <ul className="space-y-2" aria-label="전공 후보">
              {result.candidates.map((candidate, index) => (
                <li key={candidate.id}>
                  <button
                    id={`${id}-candidate-${index}`}
                    type="button"
                    disabled={waiting}
                    className="w-full rounded-xl border p-4 text-left hover:border-violet-400 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:opacity-50"
                    onClick={() => void feedback('selected', candidate)}
                    onKeyDown={(event) => {
                      const target =
                        event.key === 'ArrowDown'
                          ? index + 1
                          : event.key === 'ArrowUp'
                            ? index - 1
                            : null;
                      if (target !== null) {
                        event.preventDefault();
                        document
                          .getElementById(
                            `${id}-candidate-${Math.max(0, Math.min(result.candidates.length - 1, target))}`,
                          )
                          ?.focus();
                      }
                      if (event.key === 'Escape') inputRef.current?.focus();
                    }}
                  >
                    <Details major={candidate} />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-lg border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
              disabled={waiting}
              onClick={() => void feedback('no_match', null)}
            >
              <SearchX aria-hidden="true" className="size-3.5" />
              찾는 학과가 없어요
            </Button>
          </>
        )
      )}
    </section>
  );
}
