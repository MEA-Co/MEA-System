'use client';

import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

import type { GuidedConsultingMainRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

function FirstSortInputScreen({
  environment,
}: {
  environment: GuidedConsultingMainRenderEnvironment;
}) {
  const { draftValue, onDraftChange, send } = environment;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send({ type: 'user.submit', value: draftValue });
      }}
      className="mx-auto w-full max-w-2xl"
    >
      <Card className="gap-0 rounded-2xl bg-background/90 py-0 shadow-sm ring-0">
        <CardContent className="p-5 md:p-7">
          <p className="text-xs font-bold tracking-[0.12em] text-primary">
            INPUT 1
          </p>
          <label
            htmlFor="guided-input-first-sort"
            className="mt-2 block text-lg font-bold tracking-[-0.02em]"
          >
            첫 번째 숫자 10개
          </label>

          <Input
            id="guided-input-first-sort"
            value={draftValue}
            maxLength={160}
            placeholder="예: 42, 7, 19, 3, 88, 14, 1, 55, 26, 9"
            autoFocus
            onChange={(event) => onDraftChange(event.target.value)}
            className="mt-5 h-11 bg-background"
          />

          <div className="mt-6 flex justify-end border-t pt-5">
            <Button type="submit">
              <ArrowRight aria-hidden="true" />
              입력 완료
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

export const firstSortInputScreen = {
  mode: 'static',
  render: (_request, environment) => (
    <FirstSortInputScreen environment={environment} />
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingMainRenderEnvironment,
  ReactNode
>;
