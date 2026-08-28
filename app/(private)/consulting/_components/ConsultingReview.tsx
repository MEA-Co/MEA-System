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
  ConsultingReviewScene,
  ConsultingReviewSourcePlan,
} from '@/features/consulting/core/review';
import type { ConsultingUserAction } from '@/features/consulting/core/user';
import { cn } from '@/lib/utils';

type ConsultingReviewProps = {
  plan: ConsultingReviewSourcePlan;
  review: ConsultingReviewPlan;
  renderer: ConsultingRenderer<ConsultingScreenRenderEnvironment, ReactNode>;
};

function findScene(
  scenes: ReadonlyArray<ConsultingReviewScene>,
  sceneId: string,
) {
  return scenes.find((scene) => scene.id === sceneId);
}

export function ConsultingReview({
  plan,
  review,
  renderer,
}: ConsultingReviewProps) {
  const scenario = review.scenarios[0];
  const [sceneId, setSceneId] = useState(() => scenario?.scenes[0]?.id ?? '');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!scenario || scenario.scenes.length === 0) {
    return (
      <p
        role="alert"
        className="rounded-xl bg-destructive/8 p-4 text-sm text-destructive"
      >
        검토할 컨설팅 화면이 없습니다.
      </p>
    );
  }

  const scene = findScene(scenario.scenes, sceneId) ?? scenario.scenes[0];
  const sceneIndex = scenario.scenes.findIndex(
    (candidate) => candidate.id === scene.id,
  );
  const previousScene = scene.previousSceneId
    ? findScene(scenario.scenes, scene.previousSceneId)
    : undefined;
  const nextScene = scene.nextSceneId
    ? findScene(scenario.scenes, scene.nextSceneId)
    : undefined;
  const rendererError = renderer.validate(scene.renderTarget);
  const getSceneLabel = (candidate: ConsultingReviewScene) =>
    plan.nodes[candidate.nodeId]?.label ?? candidate.nodeId;

  const selectScene = (nextSceneId: string) => {
    if (findScene(scenario.scenes, nextSceneId)) setSceneId(nextSceneId);
  };

  const handleScreenAction = (action: ConsultingUserAction) => {
    const targetSceneId = scene.on?.[action.type];
    if (targetSceneId) selectScene(targetSceneId);
  };

  const renderedScreen = rendererError ? (
    <section
      role="alert"
      className="mx-auto w-full max-w-2xl rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive"
    >
      {rendererError.message}
    </section>
  ) : (
    renderer.render(scene.renderTarget, {
      draftValue: drafts[scene.id] ?? '',
      onDraftChange: (value) =>
        setDrafts((current) => ({ ...current, [scene.id]: value })),
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

          <div className="flex items-center gap-2 md:hidden">
            <Select
              value={scene.id}
              onValueChange={(value) => selectScene(String(value))}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scenario.scenes.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {getSceneLabel(candidate)}
                    {candidate.stateLabel ? ` · ${candidate.stateLabel}` : ''}
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
            화면 탐색
          </div>
          <nav className="mt-1" aria-label="컨설팅 검토 화면">
            {scenario.scenes.map((candidate, candidateIndex) => {
              const showSection =
                candidate.section !==
                scenario.scenes[candidateIndex - 1]?.section;
              const isSelected = candidate.id === scene.id;

              return (
                <div key={candidate.id}>
                  {showSection && candidate.section ? (
                    <p className="mt-3 px-2 pb-1.5 text-[0.68rem] font-semibold tracking-widest text-muted-foreground first:mt-0">
                      {candidate.section}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    aria-current={isSelected ? 'page' : undefined}
                    onClick={() => selectScene(candidate.id)}
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
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {getSceneLabel(candidate)}
                      </span>
                      {candidate.stateLabel ? (
                        <span
                          className={cn(
                            'block text-[0.68rem]',
                            isSelected
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground',
                          )}
                        >
                          {candidate.stateLabel}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </div>
              );
            })}
          </nav>
        </Card>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-col gap-3 rounded-xl border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 px-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{getSceneLabel(scene)}</p>
                {scene.stateLabel ? (
                  <Badge variant="secondary">{scene.stateLabel}</Badge>
                ) : null}
              </div>
              {scene.description ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {scene.description}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!previousScene}
                onClick={() => previousScene && selectScene(previousScene.id)}
              >
                <ArrowLeft aria-hidden="true" />
                이전 화면
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!nextScene}
                onClick={() => nextScene && selectScene(nextScene.id)}
              >
                다음 화면
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div key={scene.id}>
            <ConsultingFrame
              title={`${plan.title} · 검토`}
              currentStep={sceneIndex + 1}
              stepCount={scenario.scenes.length}
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
