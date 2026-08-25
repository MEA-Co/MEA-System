'use client';

import { ArrowRight, BookOpen, LoaderCircle, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { GuidedConsultingUserAction } from '@/features/guided-consulting/core/protocol';
import type { GuidedConsultingScreen } from '@/features/guided-consulting/core/types';

export type GuidedConsultingMainRenderEnvironment<Context extends object> = {
  screen: GuidedConsultingScreen<Context>;
  draftValue: string;
  onDraftChange: (value: string) => void;
  send: (input: GuidedConsultingUserAction) => void;
};

function RendererMismatch({ expected }: { expected: string }) {
  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
      이 Renderer는 {expected} 화면만 처리할 수 있습니다.
    </section>
  );
}

export function renderDefaultTutorialMain<Context extends object>(
  _request: { id: string; data?: unknown },
  environment: GuidedConsultingMainRenderEnvironment<Context>,
): ReactNode {
  const { screen } = environment;
  if (screen.kind !== 'explanation') {
    return <RendererMismatch expected="explanation" />;
  }

  return (
    <section className="mx-auto flex min-h-64 w-full max-w-2xl flex-col items-center justify-center rounded-2xl border border-dashed bg-background/50 px-6 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <BookOpen className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-5 text-xs font-bold tracking-[0.14em] text-primary">
        {screen.main.id}
      </p>
      <h1 className="mt-2 text-xl font-bold tracking-[-0.03em] md:text-2xl">
        화면 렌더러가 표시한 설명 화면
      </h1>
      <div
        className="mt-5 flex items-center gap-2"
        aria-label={`설명 ${screen.explanationIndex + 1}/${screen.explanationCount}`}
      >
        {Array.from({ length: screen.explanationCount }, (_, index) => (
          <span
            key={index}
            className={
              index === screen.explanationIndex
                ? 'h-2 w-6 rounded-full bg-primary'
                : 'size-2 rounded-full bg-muted-foreground/25'
            }
            aria-hidden="true"
          />
        ))}
      </div>
    </section>
  );
}

export function renderDefaultInputMain<Context extends object>(
  _request: { id: string; data?: unknown },
  environment: GuidedConsultingMainRenderEnvironment<Context>,
): ReactNode {
  const { screen, draftValue, onDraftChange, send } = environment;
  if (screen.kind !== 'input') {
    return <RendererMismatch expected="input" />;
  }

  const running = screen.status === 'validating' || screen.status === 'running';
  const Field = screen.input.multiline ? Textarea : Input;

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
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-primary">
                INPUT {screen.stepIndex + 1}
              </p>
              <label
                htmlFor={`guided-input-${screen.stepId}`}
                className="mt-2 block text-lg font-bold tracking-[-0.02em]"
              >
                {screen.input.label}
              </label>
            </div>
            {screen.input.maxLength && (
              <p className="shrink-0 text-xs text-muted-foreground">
                {draftValue.length} / {screen.input.maxLength}
              </p>
            )}
          </div>

          <Field
            id={`guided-input-${screen.stepId}`}
            value={draftValue}
            readOnly={running}
            maxLength={screen.input.maxLength}
            placeholder={screen.input.placeholder}
            autoFocus={!running}
            onChange={(event) => onDraftChange(event.target.value)}
            className={
              screen.input.multiline
                ? 'mt-5 min-h-32 resize-none bg-background'
                : 'mt-5 h-11 bg-background'
            }
          />

          {screen.error && (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
            >
              {screen.error}
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
              {screen.status === 'validating'
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
                : screen.status === 'error'
                  ? '다시 시도'
                  : '입력 완료'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

export function GuidedConsultingResultCard({
  children,
  onReset,
}: {
  children: ReactNode;
  onReset: () => void;
}) {
  return (
    <Card className="mx-auto w-full max-w-3xl gap-0 rounded-2xl bg-background/90 py-0 shadow-sm ring-0">
      <CardContent className="p-5 md:p-7">
        <div className="flex items-center justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
              컨설팅 완료
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-[-0.03em] md:text-2xl">
              컨설팅 결과
            </h1>
          </div>
          <Button type="button" variant="outline" onClick={onReset}>
            <RotateCcw aria-hidden="true" />
            다시 체험하기
          </Button>
        </div>
        <div className="mt-5">{children}</div>
      </CardContent>
    </Card>
  );
}
