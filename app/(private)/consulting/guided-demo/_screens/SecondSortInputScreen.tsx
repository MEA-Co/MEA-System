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

function SecondSortInputScreen({
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
              INPUT 2
            </p>
            <label
              htmlFor="guided-input-second-sort"
              className="mt-2 block text-lg font-bold tracking-[-0.02em]"
            >
              두 번째 숫자 10개
            </label>

            <Input
              id="guided-input-second-sort"
              value={draftValue}
              maxLength={160}
              placeholder="예: 31 4 72 18 6 90 11 43 2 65"
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
            : '두 번째 숫자 10개를 입력해 주세요',
          segments: [
            {
              text:
                error ??
                '이번에는 대기 화면을 먼저 보여준 뒤 결과 화면으로 업데이트합니다.',
            },
          ],
        }}
      />
    </ConsultingScreenView>
  );
}

function isErrorData(value: unknown): value is { error: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string'
  );
}

export const secondSortInputScreen = {
  mode: 'static',
  render: (_request, environment) => (
    <SecondSortInputScreen environment={environment} />
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;

export const secondSortInputErrorScreen = {
  mode: 'dynamic',
  validateData: isErrorData,
  render: (request, environment) => (
    <SecondSortInputScreen
      environment={environment}
      error={(request.data as { error: string }).error}
    />
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
