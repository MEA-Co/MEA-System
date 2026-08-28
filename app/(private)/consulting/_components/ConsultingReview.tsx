'use client';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  FlaskConical,
  PanelsTopLeft,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { ConsultingFrame } from '@/app/(private)/consulting/_components/ConsultingFrame';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ConsultingRenderer } from '@/features/consulting/core/renderer';
import type {
  ConsultingReviewPlan,
  ConsultingReviewSourcePlan,
  ConsultingReviewStep,
  ConsultingReviewTarget,
} from '@/features/consulting/core/review';
import type { ConsultingUserAction } from '@/features/consulting/core/user';
import type { MemberRole } from '@/lib/profile';
import { cn } from '@/lib/utils';

type ConsultingReviewProps = {
  plan: ConsultingReviewSourcePlan;
  review: ConsultingReviewPlan;
  renderer: ConsultingRenderer<ConsultingScreenRenderEnvironment, ReactNode>;
  viewerRole: MemberRole;
};

function findStep(steps: ReadonlyArray<ConsultingReviewStep>, stepId: string) {
  return steps.find((step) => step.id === stepId);
}

export function ConsultingReview({
  plan,
  review,
  renderer,
  viewerRole,
}: ConsultingReviewProps) {
  const scenario = review.scenarios[0];
  const [stepId, setStepId] = useState(() => scenario?.steps[0]?.id ?? '');
  const [selectedStateIds, setSelectedStateIds] = useState<
    Record<string, string>
  >({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!scenario || scenario.steps.length === 0) {
    return (
      <p
        role="alert"
        className="rounded-xl bg-destructive/8 p-4 text-sm text-destructive"
      >
        검토할 컨설팅 화면이 없습니다.
      </p>
    );
  }

  const step = findStep(scenario.steps, stepId) ?? scenario.steps[0];
  const stepIndex = scenario.steps.findIndex(
    (candidate) => candidate.id === step.id,
  );
  const selectedStateId = selectedStateIds[step.id];
  const state =
    step.states.find((candidate) => candidate.id === selectedStateId) ??
    step.states[0];
  const previousStep = scenario.steps[stepIndex - 1];
  const nextStep = scenario.steps[stepIndex + 1];
  const rendererError = state
    ? renderer.validate(state.renderTarget)
    : {
        code: 'INVALID_REQUEST' as const,
        message: `${step.id} 단계에 검토 상태가 없습니다.`,
      };
  const stepLabel = (candidate: ConsultingReviewStep) =>
    plan.nodes[candidate.nodeId]?.label ?? candidate.nodeId;

  const selectStep = (nextStepId: string) => {
    if (findStep(scenario.steps, nextStepId)) setStepId(nextStepId);
  };

  const selectState = (nextStateId: string) => {
    if (!step.states.some((candidate) => candidate.id === nextStateId)) return;
    setSelectedStateIds((current) => ({
      ...current,
      [step.id]: nextStateId,
    }));
  };

  const followTarget = (target: ConsultingReviewTarget) => {
    const nextStepId = typeof target === 'string' ? target : target.stepId;
    const nextStep = findStep(scenario.steps, nextStepId);
    if (!nextStep) return;

    if (typeof target === 'object' && target.stateId) {
      if (
        !nextStep.states.some((candidate) => candidate.id === target.stateId)
      ) {
        return;
      }
      setSelectedStateIds((current) => ({
        ...current,
        [nextStep.id]: target.stateId as string,
      }));
    }
    setStepId(nextStep.id);
  };

  const handleScreenAction = (action: ConsultingUserAction) => {
    const target = state?.on?.[action.type];
    if (target) followTarget(target);
  };

  const draftKey = state ? `${step.id}:${state.id}` : step.id;
  const renderedScreen =
    rendererError || !state ? (
      <section
        role="alert"
        className="mx-auto w-full max-w-2xl rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive"
      >
        {rendererError?.message}
      </section>
    ) : (
      renderer.render(state.renderTarget, {
        draftValue: drafts[draftKey] ?? '',
        viewerRole,
        onDraftChange: (value) =>
          setDrafts((current) => ({ ...current, [draftKey]: value })),
        send: handleScreenAction,
      })
    );

  return (
    <div className="space-y-4">
      <Card className="gap-0 rounded-2xl border-primary/15 bg-primary/4 p-4 shadow-none ring-0 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FlaskConical className="size-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">전체 검토 모드</p>
                <Badge
                  variant="outline"
                  className="border-primary/20 bg-background"
                >
                  샘플 데이터
                </Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {scenario.description}
              </p>
            </div>
          </div>

          <div className="md:hidden">
            <Select
              value={step.id}
              onValueChange={(value) => selectStep(String(value))}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scenario.steps.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {stepLabel(candidate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-4 md:grid-cols-[15rem_minmax(0,1fr)]">
        <Card className="sticky top-4 hidden gap-0 rounded-2xl p-3 shadow-none ring-0 md:block">
          <div className="flex items-center gap-2 px-2 py-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground">
            <PanelsTopLeft className="size-4" aria-hidden="true" />
            단계 탐색
          </div>
          <nav className="mt-1" aria-label="컨설팅 검토 단계">
            {scenario.steps.map((candidate, candidateIndex) => {
              const showSection =
                candidate.section !==
                scenario.steps[candidateIndex - 1]?.section;
              const isSelected = candidate.id === step.id;

              return (
                <div key={candidate.id}>
                  {showSection && candidate.section ? (
                    <p className="mt-3 px-2 pb-1.5 text-[0.68rem] font-semibold tracking-widest text-muted-foreground first:mt-0">
                      {candidate.section}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    aria-current={isSelected ? 'step' : undefined}
                    onClick={() => selectStep(candidate.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold',
                        isSelected
                          ? 'border-primary-foreground/30'
                          : 'border-border bg-background',
                      )}
                    >
                      {isSelected ? (
                        <Check className="size-3" />
                      ) : (
                        candidateIndex + 1
                      )}
                    </span>
                    <span className="truncate font-medium">
                      {stepLabel(candidate)}
                    </span>
                  </button>
                </div>
              );
            })}
          </nav>
        </Card>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-col gap-3 rounded-xl border bg-background px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 px-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{stepLabel(step)}</p>
                {state?.label ? (
                  <Badge variant="secondary">{state.label}</Badge>
                ) : null}
              </div>
              {(state?.description ?? step.description) ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {state?.description ?? step.description}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {step.states.length > 1 ? (
                <div
                  className="mr-auto flex rounded-lg bg-muted p-1 lg:mr-2"
                  role="group"
                  aria-label={`${stepLabel(step)} 화면 상태`}
                >
                  {step.states.map((candidate) => (
                    <Button
                      key={candidate.id}
                      type="button"
                      variant={candidate.id === state?.id ? 'default' : 'ghost'}
                      size="sm"
                      aria-pressed={candidate.id === state?.id}
                      onClick={() => selectState(candidate.id)}
                    >
                      {candidate.label ?? candidate.id}
                    </Button>
                  ))}
                </div>
              ) : null}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!previousStep}
                onClick={() => previousStep && selectStep(previousStep.id)}
              >
                <ArrowLeft aria-hidden="true" />
                이전 단계
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!nextStep}
                onClick={() => nextStep && selectStep(nextStep.id)}
              >
                다음 단계
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div key={`${step.id}:${state?.id ?? 'missing'}`}>
            <ConsultingFrame
              title={`${plan.title} · 검토`}
              currentStep={stepIndex + 1}
              stepCount={scenario.steps.length}
              headerStatus={<Badge variant="outline">{scenario.label}</Badge>}
            >
              {renderedScreen}
            </ConsultingFrame>
          </div>
        </div>
      </div>
    </div>
  );
}
