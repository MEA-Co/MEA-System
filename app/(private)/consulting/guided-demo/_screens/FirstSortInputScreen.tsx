'use client';

import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

function FirstSortInputScreen({
  environment,
  error,
}: {
  environment: GuidedConsultingScreenRenderEnvironment;
  error?: string;
}) {
  const { draftValue, onDraftChange, send } = environment;

  return (
    <ConsultingScreenView>
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

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end border-t pt-5">
              <Button type="submit">
                <ArrowRight aria-hidden="true" />
                입력 완료
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
      <ConsultingPrompter
        message={{
          label: 'INPUT',
          title: error
            ? '입력 내용을 다시 확인해 주세요'
            : '첫 번째 숫자 10개를 입력해 주세요',
          segments: [
            {
              text:
                error ??
                '쉼표 또는 공백으로 숫자를 구분한 뒤 입력 완료를 눌러주세요.',
            },
          ],
        }}
      />
    </ConsultingScreenView>
  );
}

export const firstSortInputScreen = {
  mode: 'static',
  render: (_request, environment) => (
    <FirstSortInputScreen environment={environment} />
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;

function isFirstSortInputErrorData(value: unknown): value is { error: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string'
  );
}

export const firstSortInputErrorScreen = {
  mode: 'dynamic',
  validateData: isFirstSortInputErrorData,
  render: (request, environment) => (
    <FirstSortInputScreen
      environment={environment}
      error={(request.data as { error: string }).error}
    />
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
