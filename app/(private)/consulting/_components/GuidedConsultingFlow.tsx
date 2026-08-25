'use client';

import { Eye } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { ConsultingDebugConsole } from '@/app/(private)/consulting/_components/ConsultingDebugConsole';
import { ConsultingFrame } from '@/app/(private)/consulting/_components/ConsultingFrame';
import { useGuidedConsultingAgent } from '@/app/(private)/consulting/_hooks/useGuidedConsultingAgent';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { Button } from '@/components/ui/button';
import type { GuidedConsultingPlan } from '@/features/guided-consulting/core/plan';
import type { GuidedConsultingRenderer } from '@/features/guided-consulting/core/renderer';
import type { GuidedConsultingToolsRuntime } from '@/features/guided-consulting/core/tools';

type GuidedConsultingFlowProps<
  Context extends object,
  Tools extends GuidedConsultingToolsRuntime,
> = {
  plan: GuidedConsultingPlan<Context, Tools>;
  tools: Tools;
  renderer: GuidedConsultingRenderer<
    GuidedConsultingScreenRenderEnvironment,
    ReactNode
  >;
  debug?: boolean;
};

export function GuidedConsultingFlow<
  Context extends object,
  Tools extends GuidedConsultingToolsRuntime,
>({
  plan,
  tools,
  renderer,
  debug = false,
}: GuidedConsultingFlowProps<Context, Tools>) {
  const agent = useGuidedConsultingAgent(plan, tools, renderer);
  const [drafts, setDrafts] = useState<{
    sessionId: number;
    values: Record<string, string>;
  }>({ sessionId: agent.sessionId, values: {} });
  const screen = agent.screen;
  const draftKey = screen?.draftKey ?? screen?.nodeId ?? '';
  const draftValue =
    drafts.sessionId === agent.sessionId ? (drafts.values[draftKey] ?? '') : '';

  const debugConsole = debug ? (
    <ConsultingDebugConsole
      planId={agent.planId}
      phase={agent.phase}
      currentNodeId={agent.currentNodeId}
      node={agent.node}
      screen={screen}
      context={agent.context}
      actions={agent.actions}
      toolResults={agent.toolResults}
      toolErrors={agent.toolErrors}
      error={agent.error}
      pendingModuleCalls={agent.pendingModuleCalls}
      logs={agent.logs}
    />
  ) : null;

  if (!screen) return debugConsole;

  const rendererError = renderer.validate(screen.renderTarget);
  const renderedScreen = !rendererError ? (
    renderer.render(screen.renderTarget, {
      draftValue,
      onDraftChange: (value) =>
        setDrafts((current) => ({
          sessionId: agent.sessionId,
          values: {
            ...(current.sessionId === agent.sessionId ? current.values : {}),
            [draftKey]: value,
          },
        })),
      send: agent.send,
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
        canGoBack={canGoBack}
        onBack={() => agent.send({ type: 'user.back' })}
        topRightAction={
          canReviewExplanation ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => agent.send({ type: 'user.review-explanation' })}
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
