'use client';

import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { ConsultingFrame } from '@/app/(private)/consulting/_components/ConsultingFrame';
import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { useGuidedConsultingSession } from '@/app/(private)/consulting/_hooks/useGuidedConsultingSession';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  GuidedConsultingDefinition,
  GuidedConsultingExplanation,
  GuidedConsultingStep,
} from '@/features/guided-consulting/core/types';

type GuidedConsultingFlowProps<Context extends object, Tools extends object> = {
  definition: GuidedConsultingDefinition<Context, Tools>;
  tools: Tools;
  renderComplete: (context: Context) => ReactNode;
};

type StepEntryView = 'explanation' | 'input';

type GuidedStepViewProps<Context extends object, Tools extends object> = {
  title: string;
  step: GuidedConsultingStep<Context, Tools>;
  explanations: ReadonlyArray<GuidedConsultingExplanation>;
  stepIndex: number;
  stepCount: number;
  initialView: StepEntryView;
  value: string;
  running: boolean;
  failed: boolean;
  error: Error | null;
  canGoBack: boolean;
  onBack: () => void;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

function GuidedStepView<Context extends object, Tools extends object>({
  title,
  step,
  explanations,
  stepIndex,
  stepCount,
  initialView,
  value,
  running,
  failed,
  error,
  canGoBack,
  onBack,
  onValueChange,
  onSubmit,
}: GuidedStepViewProps<Context, Tools>) {
  const [view, setView] = useState<StepEntryView>(
    initialView === 'explanation' && explanations.length > 0
      ? 'explanation'
      : 'input',
  );
  const [explanationIndex, setExplanationIndex] = useState(0);
  const explanation = explanations[explanationIndex] ?? null;
  const Field = step.input.multiline ? Textarea : Input;

  const showInput = () => setView('input');
  const reviewExplanation = () => {
    setExplanationIndex(0);
    setView('explanation');
  };

  if (view === 'explanation' && explanation) {
    const isFirstExplanation = explanationIndex === 0;
    const isLastExplanation = explanationIndex === explanations.length - 1;

    return (
      <ConsultingFrame
        title={title}
        currentStep={stepIndex + 1}
        stepCount={stepCount}
        canGoBack={canGoBack}
        onBack={onBack}
        prompter={
          <ConsultingPrompter
            explanation={explanation}
            pageLabel={`${explanation.eyebrow ?? '설명'} · ${explanationIndex + 1}/${explanations.length}`}
          >
            {!isFirstExplanation && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setExplanationIndex((index) => index - 1)}
              >
                <ChevronLeft aria-hidden="true" />
                이전 설명
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                if (isLastExplanation) {
                  showInput();
                  return;
                }
                setExplanationIndex((index) => index + 1);
              }}
            >
              {isLastExplanation ? '입력하기' : '다음 설명'}
              <ChevronRight aria-hidden="true" />
            </Button>
          </ConsultingPrompter>
        }
      >
        <section className="mx-auto flex min-h-64 w-full max-w-2xl flex-col items-center justify-center rounded-2xl border border-dashed bg-background/50 px-6 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-5 text-xs font-bold tracking-[0.14em] text-primary">
            TUTORIAL
          </p>
          <h1 className="mt-2 text-xl font-bold tracking-[-0.03em] md:text-2xl">
            입력 전에 잠깐 알아볼게요
          </h1>
          <div
            className="mt-5 flex items-center gap-2"
            aria-label={`설명 ${explanationIndex + 1}/${explanations.length}`}
          >
            {explanations.map((page, index) => (
              <span
                key={`${page.title}-${index}`}
                className={
                  index === explanationIndex
                    ? 'h-2 w-6 rounded-full bg-primary'
                    : 'size-2 rounded-full bg-muted-foreground/25'
                }
                aria-hidden="true"
              />
            ))}
          </div>
        </section>
      </ConsultingFrame>
    );
  }

  return (
    <ConsultingFrame
      title={title}
      currentStep={stepIndex + 1}
      stepCount={stepCount}
      canGoBack={canGoBack}
      onBack={onBack}
      topRightAction={
        explanations.length > 0 ? (
          <Button type="button" variant="outline" onClick={reviewExplanation}>
            <Eye aria-hidden="true" />
            설명 다시 보기
          </Button>
        ) : undefined
      }
      prompter={
        <ConsultingPrompter
          pageLabel="INPUT"
          explanation={{
            title: '이제 직접 입력해보세요',
            description: `‘${step.input.label}’을 작성한 뒤 입력 완료를 눌러주세요.`,
          }}
        />
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(value);
        }}
        className="mx-auto w-full max-w-2xl"
      >
        <Card className="gap-0 rounded-2xl bg-background/90 py-0 shadow-sm ring-0">
          <CardContent className="p-5 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.12em] text-primary">
                  INPUT {stepIndex + 1}
                </p>
                <label
                  htmlFor={`guided-input-${step.id}`}
                  className="mt-2 block text-lg font-bold tracking-[-0.02em]"
                >
                  {step.input.label}
                </label>
              </div>
              {step.input.maxLength && (
                <p className="shrink-0 text-xs text-muted-foreground">
                  {value.length} / {step.input.maxLength}
                </p>
              )}
            </div>

            <Field
              id={`guided-input-${step.id}`}
              value={value}
              readOnly={running}
              maxLength={step.input.maxLength}
              placeholder={step.input.placeholder}
              autoFocus
              onChange={(event) => onValueChange(event.target.value)}
              className={
                step.input.multiline
                  ? 'mt-5 min-h-32 resize-none bg-background'
                  : 'mt-5 h-11 bg-background'
              }
            />

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
              >
                {error.message}
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
                입력을 바탕으로 다음 화면을 준비하고 있어요.
              </div>
            )}

            <div className="mt-6 flex justify-end border-t pt-5">
              <Button type="submit" disabled={running}>
                {running ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight aria-hidden="true" />
                )}
                {running ? '처리 중' : failed ? '다시 시도' : '입력 완료'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </ConsultingFrame>
  );
}

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
  const [nextEntryView, setNextEntryView] =
    useState<StepEntryView>('explanation');
  const stepId = session.step?.id ?? null;
  const value =
    stepId && draft.stepId === stepId
      ? draft.value
      : stepId
        ? (session.answers[stepId] ?? '')
        : '';

  const backToInput = () => {
    setNextEntryView('input');
    session.back();
  };

  const resetToExplanation = () => {
    setNextEntryView('explanation');
    session.reset();
  };

  if (session.isComplete) {
    return (
      <ConsultingFrame
        title={session.title}
        currentStep={session.stepCount}
        stepCount={session.stepCount}
        canGoBack={session.canGoBack}
        onBack={backToInput}
        prompter={
          <ConsultingPrompter
            complete
            pageLabel="COMPLETE"
            explanation={{
              title: '나만의 결과가 완성됐어요',
              description:
                '화면에 정리된 결과를 확인해보세요. 수정하고 싶다면 이전 단계로 돌아갈 수 있어요.',
            }}
          />
        }
      >
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
              <Button
                type="button"
                variant="outline"
                onClick={resetToExplanation}
              >
                <RotateCcw aria-hidden="true" />
                다시 체험하기
              </Button>
            </div>

            <div className="mt-5">{renderComplete(session.context)}</div>
          </CardContent>
        </Card>
      </ConsultingFrame>
    );
  }

  if (!session.step) return null;

  return (
    <GuidedStepView
      key={`${session.stepIndex}:${session.step.id}`}
      title={session.title}
      step={session.step}
      explanations={session.explanations}
      stepIndex={session.stepIndex}
      stepCount={session.stepCount}
      initialView={nextEntryView}
      value={value}
      running={session.phase === 'running-action'}
      failed={session.phase === 'error'}
      error={session.error}
      canGoBack={session.canGoBack}
      onBack={backToInput}
      onValueChange={(nextValue) =>
        setDraft({ stepId: session.step!.id, value: nextValue })
      }
      onSubmit={(submittedValue) => {
        setNextEntryView('explanation');
        session.submit(submittedValue);
      }}
    />
  );
}
