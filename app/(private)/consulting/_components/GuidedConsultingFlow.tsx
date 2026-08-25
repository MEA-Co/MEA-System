'use client';

import { Eye } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { ConsultingDebugConsole } from '@/app/(private)/consulting/_components/ConsultingDebugConsole';
import { ConsultingFrame } from '@/app/(private)/consulting/_components/ConsultingFrame';
import { useGuidedConsultingAgent } from '@/app/(private)/consulting/_hooks/useGuidedConsultingAgent';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { Button } from '@/components/ui/button';
import type { GuidedConsultingRenderer } from '@/features/guided-consulting/core/renderer';
import type { GuidedConsultingToolsRuntime } from '@/features/guided-consulting/core/tools';
import type { GuidedConsultingDefinition } from '@/features/guided-consulting/core/types';

type GuidedConsultingFlowProps<
  Context extends object,
  Tools extends GuidedConsultingToolsRuntime,
> = {
  definition: GuidedConsultingDefinition<Context, Tools>;
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
  definition,
  tools,
  renderer,
  debug = false,
}: GuidedConsultingFlowProps<Context, Tools>) {
  const agent = useGuidedConsultingAgent(definition, tools, renderer);
  const [draft, setDraft] = useState({ stepId: '', value: '' });
  const screen = agent.screen;
  const draftValue =
    screen?.kind === 'input' && draft.stepId === screen.stepId
      ? draft.value
      : screen?.kind === 'input'
        ? screen.value
        : '';

  const debugConsole = debug ? (
    <ConsultingDebugConsole
      definitionId={agent.definitionId}
      phase={agent.phase}
      screen={screen}
      draftValue={draftValue}
      context={agent.context}
      answers={agent.answers}
      error={agent.error}
      pendingToolCalls={agent.pendingToolCalls}
      logs={agent.logs}
    />
  ) : null;

  if (!screen) return debugConsole;

  const rendererError = renderer.validate(screen.renderTarget);
  const renderedScreen = !rendererError ? (
    renderer.render(screen.renderTarget, {
      draftValue,
      onDraftChange: (value) =>
        setDraft({
          stepId: screen.kind === 'input' ? screen.stepId : '',
          value,
        }),
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

  const running =
    screen.kind === 'input' &&
    (screen.status === 'validating' || screen.status === 'running');

  return (
    <div className="space-y-6">
      <ConsultingFrame
        title={screen.title}
        currentStep={
          screen.kind === 'complete' ? screen.stepCount : screen.stepIndex + 1
        }
        stepCount={screen.stepCount}
        canGoBack={screen.canGoBack}
        onBack={() => agent.send({ type: 'user.back' })}
        topRightAction={
          screen.kind === 'input' ? (
            <Button
              type="button"
              variant="outline"
              disabled={running}
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
