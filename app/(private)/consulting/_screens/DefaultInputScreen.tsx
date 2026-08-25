'use client';

import { ArrowRight, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { GuidedConsultingDynamicRenderTarget } from '@/features/guided-consulting/core/protocol';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';
import type { GuidedConsultingInput } from '@/features/guided-consulting/core/types';

type InputScreenData = {
  stepId: string;
  stepIndex: number;
  input: GuidedConsultingInput;
  status: 'ready' | 'validating' | 'running' | 'error';
  error: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInputScreenData(value: unknown): value is InputScreenData {
  const statuses = ['ready', 'validating', 'running', 'error'];
  return (
    isRecord(value) &&
    typeof value.stepId === 'string' &&
    typeof value.stepIndex === 'number' &&
    isRecord(value.input) &&
    typeof value.input.label === 'string' &&
    typeof value.status === 'string' &&
    statuses.includes(value.status) &&
    (typeof value.error === 'string' || value.error === null)
  );
}

function DefaultInputScreen({
  request,
  environment,
}: {
  request: GuidedConsultingDynamicRenderTarget;
  environment: GuidedConsultingScreenRenderEnvironment;
}) {
  const { draftValue, onDraftChange, send } = environment;
  const data = request.data as InputScreenData;
  const running = data.status === 'validating' || data.status === 'running';
  const Field = data.input.multiline ? Textarea : Input;

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
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.12em] text-primary">
                  INPUT {data.stepIndex + 1}
                </p>
                <label
                  htmlFor={`guided-input-${data.stepId}`}
                  className="mt-2 block text-lg font-bold tracking-[-0.02em]"
                >
                  {data.input.label}
                </label>
              </div>
              {data.input.maxLength && (
                <p className="shrink-0 text-xs text-muted-foreground">
                  {draftValue.length} / {data.input.maxLength}
                </p>
              )}
            </div>

            <Field
              id={`guided-input-${data.stepId}`}
              value={draftValue}
              readOnly={running}
              maxLength={data.input.maxLength}
              placeholder={data.input.placeholder}
              autoFocus={!running}
              onChange={(event) => onDraftChange(event.target.value)}
              className={
                data.input.multiline
                  ? 'mt-5 min-h-32 resize-none bg-background'
                  : 'mt-5 h-11 bg-background'
              }
            />

            {data.error && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
              >
                {data.error}
              </p>
            )}

            {running && (
              <div
                role="status"
                className="mt-4 flex items-center gap-3 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground"
              >
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
                {data.status === 'validating'
                  ? '중심 에이전트가 입력 검증 결과를 기다리고 있어요.'
                  : '중심 에이전트가 Tool Agent의 결과를 기다리고 있어요.'}
              </div>
            )}

            <div className="mt-6 flex justify-end border-t pt-5">
              <Button type="submit" disabled={running}>
                {running ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight aria-hidden="true" />
                )}
                {running
                  ? '처리 중'
                  : data.status === 'error'
                    ? '다시 시도'
                    : '입력 완료'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
      <ConsultingPrompter
        message={{
          eyebrow: 'INPUT',
          title:
            data.status === 'validating'
              ? '입력 내용을 확인하고 있어요'
              : data.status === 'running'
                ? '입력을 바탕으로 작업하고 있어요'
                : data.status === 'error'
                  ? '입력 내용을 다시 확인해 주세요'
                  : '이제 직접 입력해보세요',
          description:
            data.status === 'validating' || data.status === 'running'
              ? '작업이 끝나면 중심 에이전트가 다음 화면을 요청합니다.'
              : (data.error ??
                `‘${data.input.label}’을 작성한 뒤 입력 완료를 눌러주세요.`),
        }}
      />
    </ConsultingScreenView>
  );
}

export const defaultInputScreen = {
  mode: 'dynamic',
  validateData: isInputScreenData,
  render: (request, environment) => (
    <DefaultInputScreen request={request} environment={environment} />
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
