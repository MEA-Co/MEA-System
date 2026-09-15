'use client';

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { BrandingMajorSearchInput } from '@/app/(private)/consulting/branding/_components/BrandingMajorSearchInput';
import { parseAdditionalMajors } from '@/app/(private)/consulting/branding/_lib/plan';
import { Button } from '@/components/ui/button';
import { parseMajorDraft } from '@/features/keywords/major-search/domain';

export function BrandingMajorScreen({
  additional = false,
  environment,
}: {
  additional?: boolean;
  environment: ConsultingScreenRenderEnvironment;
}) {
  const [ready, setReady] = useState(false);
  const { draftValue, onDraftChange, send } = environment;
  const others = parseAdditionalMajors(draftValue) ?? { second: '', third: '' };
  const valid = additional
    ? [others.second, others.third].every(
        (value) =>
          !value ||
          (!!parseMajorDraft(value) &&
            (!parseMajorDraft(value)!.input.trim() ||
              !!parseMajorDraft(value)!.confirmed)),
      )
    : !!parseMajorDraft(draftValue)?.confirmed;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ConsultingPrompter
        appearance="flat"
        animateTyping
        onTypingComplete={() => setReady(true)}
        message={{
          segments: [
            {
              text: additional
                ? '혹시 고민 중이거나 가고 싶은 다른 전공이 있지는 않나요?'
                : '먼저 희망 전공에서 출발해봅시다. 여러분의 희망 전공은 무엇인가요?',
            },
          ],
        }}
      />
      <form
        className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-violet-100 bg-white p-6 md:p-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && valid)
            send({
              type: 'user.submit',
              value: additional ? JSON.stringify(others) : draftValue.trim(),
            });
        }}
      >
        <h1 className="text-lg font-semibold text-slate-900">
          {additional ? '함께 고민 중인 전공' : '가장 가고 싶은 전공'}
        </h1>
        {additional ? (
          <>
            <p className="text-sm text-muted-foreground">
              없다면 비워두고 넘어가도 괜찮아요.
            </p>
            {(['second', 'third'] as const).map((key, index) => (
              <div key={key} className="space-y-2">
                <BrandingMajorSearchInput
                  label={`${index + 2}순위 희망 전공 (선택)`}
                  value={others[key]}
                  onChange={(value) =>
                    onDraftChange(JSON.stringify({ ...others, [key]: value }))
                  }
                />
              </div>
            ))}
          </>
        ) : (
          <div className="space-y-2">
            <BrandingMajorSearchInput
              label="1순위 희망 전공"
              value={draftValue}
              onChange={onDraftChange}
              onConfirmed={(value) => send({ type: 'user.submit', value })}
            />
          </div>
        )}
        <div className="flex justify-end border-t pt-5">
          <Button
            type="submit"
            disabled={!ready || !valid}
            className="rounded-xl bg-violet-700 text-white hover:bg-violet-800"
          >
            {additional && !others.second && !others.third
              ? '건너뛰기'
              : '다음'}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </form>
    </div>
  );
}
