'use client';

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { GuidedConsultingDefinition } from '@/features/guided-consulting/core/types';
import { useGuidedConsultingSession } from '@/features/guided-consulting/runtime/useGuidedConsultingSession';

type GuidedConsultingFlowProps<Context extends object, Tools extends object> = {
  definition: GuidedConsultingDefinition<Context, Tools>;
  tools: Tools;
  renderComplete: (context: Context) => ReactNode;
};

export function GuidedConsultingFlow<
  Context extends object,
  Tools extends object,
>({
  definition,
  tools,
  renderComplete,
}: GuidedConsultingFlowProps<Context, Tools>) {
  const session = useGuidedConsultingSession(definition, tools);
  const [draft, setDraft] = useState({ stepId: '', value: '' });
  const stepId = session.step?.id ?? null;
  const value =
    stepId && draft.stepId === stepId
      ? draft.value
      : stepId
        ? (session.answers[stepId] ?? '')
        : '';

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    session.submit(value);
  };

  if (session.isComplete) {
    return (
      <Card className="overflow-hidden rounded-2xl py-0 shadow-sm ring-0">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  컨설팅 완료
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em]">
                  나만의 결과가 완성됐어요
                </h1>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={session.reset}>
              <RotateCcw aria-hidden="true" />
              다시 체험하기
            </Button>
          </div>

          <div className="mt-7">{renderComplete(session.context)}</div>

          <div className="mt-7 border-t pt-5">
            <Button
              type="button"
              variant="ghost"
              disabled={!session.canGoBack}
              onClick={session.back}
            >
              <ArrowLeft aria-hidden="true" />
              마지막 입력 수정하기
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!session.step || !session.guide) return null;

  const running = session.phase === 'running-action';
  const progress = ((session.stepIndex + 1) / session.stepCount) * 100;
  const Field = session.step.input.multiline ? Textarea : Input;

  return (
    <Card className="overflow-hidden rounded-2xl py-0 shadow-sm ring-0">
      <div className="h-1.5 bg-muted" aria-hidden="true">
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <CardContent className="p-0">
        <div className="grid min-h-128 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="border-b bg-muted/35 p-6 md:border-r md:border-b-0 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-bold tracking-[0.14em] text-primary">
                {session.guide.eyebrow ?? `STEP ${session.stepIndex + 1}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {session.stepIndex + 1} / {session.stepCount}
              </p>
            </div>

            <h1 className="mt-6 text-2xl font-bold tracking-[-0.03em] md:text-3xl">
              {session.guide.title}
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
              {session.guide.description}
            </p>

            {session.guide.tips && session.guide.tips.length > 0 && (
              <div className="mt-7 rounded-xl border border-primary/15 bg-background/80 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Lightbulb
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  입력 가이드
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  {session.guide.tips.map((tip) => (
                    <li key={tip}>· {tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <form onSubmit={submit} className="flex flex-col p-6 md:p-8">
            <div className="flex-1">
              <label
                htmlFor={`guided-input-${session.step.id}`}
                className="text-sm font-semibold"
              >
                {session.step.input.label}
              </label>
              <Field
                id={`guided-input-${session.step.id}`}
                value={value}
                readOnly={running}
                maxLength={session.step.input.maxLength}
                placeholder={session.step.input.placeholder}
                onChange={(event) =>
                  setDraft({
                    stepId: session.step!.id,
                    value: event.target.value,
                  })
                }
                className={
                  session.step.input.multiline
                    ? 'mt-3 min-h-36 resize-none'
                    : 'mt-3'
                }
              />

              {session.error && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
                >
                  {session.error.message}
                </p>
              )}

              {running && (
                <div
                  role="status"
                  className="mt-5 flex items-center gap-3 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground"
                >
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                  입력을 바탕으로 다음 단계를 준비하고 있어요.
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
              <Button
                type="button"
                variant="ghost"
                disabled={!session.canGoBack}
                onClick={session.back}
              >
                <ArrowLeft aria-hidden="true" />
                이전 Step
              </Button>

              <Button type="submit" disabled={running}>
                {running ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight aria-hidden="true" />
                )}
                {running ? '처리 중' : '입력 완료'}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
