'use client';

import { Eye } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { ConsultingDebugConsole } from '@/app/(private)/consulting/_components/ConsultingDebugConsole';
import { ConsultingFrame } from '@/app/(private)/consulting/_components/ConsultingFrame';
import { useConsultingAgent } from '@/app/(private)/consulting/_hooks/useConsultingAgent';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { Button } from '@/components/ui/button';
import type { ConsultingPlan } from '@/features/consulting/core/plan';
import type { ConsultingRenderer } from '@/features/consulting/core/renderer';
import type { ConsultingToolsRuntime } from '@/features/consulting/core/tools';

type ConsultingFlowProps<
  Context extends object,
  Tools extends ConsultingToolsRuntime,
> = {
  plan: ConsultingPlan<Context, Tools>;
  tools: Tools;
  renderer: ConsultingRenderer<ConsultingScreenRenderEnvironment, ReactNode>;
  debug?: boolean;
};

export function ConsultingFlow<
  Context extends object,
  Tools extends ConsultingToolsRuntime,
>({
  plan,
  tools,
  renderer,
  debug = false,
}: ConsultingFlowProps<Context, Tools>) {
  const { snapshot, memory, logs, send } = useConsultingAgent(
    plan,
    tools,
    renderer,
  );
  const [drafts, setDrafts] = useState<{
    sessionId: number;
    values: Record<string, string>;
  }>({ sessionId: snapshot.sessionId, values: {} });
  const screen = snapshot.screen;
  const draftKey = screen?.draftKey ?? screen?.nodeId ?? '';
  const draftValue =
    drafts.sessionId === snapshot.sessionId
      ? (drafts.values[draftKey] ?? '')
      : '';

  const debugConsole = debug ? (
    <ConsultingDebugConsole snapshot={snapshot} memory={memory} logs={logs} />
  ) : null;

  if (!screen) return debugConsole;

  const rendererError = renderer.validate(screen.renderTarget);
  const renderedScreen = !rendererError ? (
    renderer.render(screen.renderTarget, {
      draftValue,
      onDraftChange: (value) =>
        setDrafts((current) => ({
          sessionId: snapshot.sessionId,
          values: {
            ...(current.sessionId === snapshot.sessionId ? current.values : {}),
            [draftKey]: value,
          },
        })),
      send,
    })
  ) : (
    <section
      role="alert"
      className="mx-auto w-full max-w-2xl rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive"
    >
      {rendererError.message}
    </section>
  );

  const canGoBack = screen.availableActions.includes('user.back');
  const canReviewExplanation = screen.availableActions.includes(
    'user.review-explanation',
  );

  return (
    <div>
      <ConsultingFrame
        title={screen.title}
        currentStep={screen.progress?.current}
        stepCount={screen.progress?.total}
        onBack={canGoBack ? () => send({ type: 'user.back' }) : undefined}
        topRightAction={
          canReviewExplanation ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => send({ type: 'user.review-explanation' })}
            >
              <Eye aria-hidden="true" />
              설명 다시 보기
            </Button>
          ) : undefined
        }
      >
        {renderedScreen}
      </ConsultingFrame>
      {debugConsole}
    </div>
  );
}
