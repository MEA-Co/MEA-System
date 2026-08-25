'use client';

import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { ConsultingDebugConsole } from '@/app/(private)/consulting/_components/ConsultingDebugConsole';
import { ConsultingFrame } from '@/app/(private)/consulting/_components/ConsultingFrame';
import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { useGuidedConsultingAgent } from '@/app/(private)/consulting/_hooks/useGuidedConsultingAgent';
import type { GuidedConsultingMainRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { Button } from '@/components/ui/button';
import type { GuidedConsultingRenderer } from '@/features/guided-consulting/core/renderer';
import type { GuidedConsultingDefinition } from '@/features/guided-consulting/core/types';

type GuidedConsultingFlowProps<
  Context extends object,
  Services extends object,
> = {
  definition: GuidedConsultingDefinition<Context, Services>;
  services: Services;
  renderer: GuidedConsultingRenderer<
    GuidedConsultingMainRenderEnvironment,
    ReactNode
  >;
  debug?: boolean;
};

export function GuidedConsultingFlow<
  Context extends object,
  Services extends object,
>({
  definition,
  services,
  renderer,
  debug = false,
}: GuidedConsultingFlowProps<Context, Services>) {
  const agent = useGuidedConsultingAgent(definition, services, renderer);
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

  const rendererError = renderer.validate(screen.main);
  const main = !rendererError ? (
    renderer.render(screen.main, {
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

  if (screen.kind === 'explanation') {
    const isFirstExplanation = screen.explanationIndex === 0;
    const isLastExplanation =
      screen.explanationIndex === screen.explanationCount - 1;

    return (
      <div className="space-y-6">
        <ConsultingFrame
          title={screen.title}
          currentStep={screen.stepIndex + 1}
          stepCount={screen.stepCount}
          canGoBack={screen.canGoBack}
          onBack={() => agent.send({ type: 'user.back' })}
          prompter={
            <ConsultingPrompter
              explanation={screen.prompter}
              pageLabel={`${screen.prompter.eyebrow ?? '설명'} · ${screen.explanationIndex + 1}/${screen.explanationCount}`}
            >
              {!isFirstExplanation && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    agent.send({ type: 'user.previous-explanation' })
                  }
                >
                  <ChevronLeft aria-hidden="true" />
                  이전 설명
                </Button>
              )}
              <Button
                type="button"
                onClick={() =>
                  agent.send({
                    type: isLastExplanation
                      ? 'user.start-input'
                      : 'user.next-explanation',
                  })
                }
              >
                {isLastExplanation ? '입력하기' : '다음 설명'}
                <ChevronRight aria-hidden="true" />
              </Button>
            </ConsultingPrompter>
          }
        >
          {main}
        </ConsultingFrame>
        {debugConsole}
      </div>
    );
  }

  if (screen.kind === 'input') {
    const running =
      screen.status === 'validating' || screen.status === 'running';

    return (
      <div className="space-y-6">
        <ConsultingFrame
          title={screen.title}
          currentStep={screen.stepIndex + 1}
          stepCount={screen.stepCount}
          canGoBack={screen.canGoBack}
          onBack={() => agent.send({ type: 'user.back' })}
          topRightAction={
            <Button
              type="button"
              variant="outline"
              disabled={running}
              onClick={() => agent.send({ type: 'user.review-explanation' })}
            >
              <Eye aria-hidden="true" />
              설명 다시 보기
            </Button>
          }
          prompter={
            <ConsultingPrompter
              pageLabel={screen.prompter.eyebrow}
              explanation={screen.prompter}
            />
          }
        >
          {main}
        </ConsultingFrame>
        {debugConsole}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConsultingFrame
        title={screen.title}
        currentStep={screen.stepCount}
        stepCount={screen.stepCount}
        canGoBack={screen.canGoBack}
        onBack={() => agent.send({ type: 'user.back' })}
        prompter={
          <ConsultingPrompter
            complete
            pageLabel={screen.prompter.eyebrow}
            explanation={screen.prompter}
          />
        }
      >
        {main}
      </ConsultingFrame>
      {debugConsole}
    </div>
  );
}
